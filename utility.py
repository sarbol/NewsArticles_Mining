from sentence_transformers import SentenceTransformer
import hdbscan
from sklearn.cluster import KMeans
import numpy as np
import os
from dotenv import load_dotenv
import requests
import json
import re
from difflib import SequenceMatcher
from typing import List, Tuple, Optional

load_dotenv()


models = [
  "qwen/qwen3-coder:free",
  "deepseek/deepseek-r1-0528-qwen3-8b:free",
  "meta-llama/llama-3-8b-instruct"
  ]


def get_category_name(embeddings: np.ndarray, clusterer: hdbscan.HDBSCAN | KMeans, labels: dict) -> str:
  if isinstance(clusterer, hdbscan.HDBSCAN):
    id, score = hdbscan.approximate_predict(clusterer, embeddings)
  elif isinstance(clusterer, KMeans):
    id = clusterer.predict(embeddings)
  else:
    raise ValueError("Invalid clustering algorithm")
  
  if id.size > 0 and (w:=int(id[0])) != -1:
    return labels.get(str(w))

  return None

def news_classification(article: str, model: SentenceTransformer, inference: dict) -> dict:
  embeddings = model.encode([article])
  reduced_embeddings = inference["global"]["dimension_reducer"].transform(embeddings)
  clusterer = inference["global"]["clustering_algorithm"]
  labels = inference["global"]["labels"]
  category_name = get_category_name(reduced_embeddings, clusterer, labels)

  if category_name:
    reduced_embeddings = inference[category_name]["dimension_reducer"].transform(embeddings)
    clusterer = inference[category_name]["clustering_algorithm"]
    labels = inference[category_name]["labels"]
    sub_category_name = get_category_name(reduced_embeddings, clusterer, labels)
    if sub_category_name:
      return {
          "category": category_name,
          "sub_category": sub_category_name
      }
    return {
        "category": category_name,
        "sub_category": None
    }
  
  return None

def read_txt_file(file_path: str) -> str:
    with open(file_path, "r") as f:
      return f.read()
    

def context(article: str, task: str) -> str:
  if task == "entity":
     return f"""
                  Read and Comprehend the news article below.
                  <article>{article}</article>
                  
                  Perform the following tasks:
                  
                  1 - Extract names of people mentioned in the article.
                  2 - Determine the Job/Profession of the people mentioned in the article e.g Footballer, celebrity, politician, actor, musician, business man
                      politician etc
                  
                  >> Note: It is possible that the profession of some individuals might not be explicitly stated but quite possible to infer base on context and how they are described.
                  
                  3 - Extract the context describing the profession/job of the individuals as written in the article. Do not summarize or add any comment, just extract
                      the most important section of the article that states or describes the profession. Keep it as concise as possible.
                      Do not summarize or add comments, it is important this context is searchable for downstream analysis.
                      This means for each person you create an object with 4 fields (name: str, job: str, context: str, explicit: boolean). Return a list of these objects in JSON format
                      
                """
  else:
     return f""" Read and Comprehend the news article below
                <article>{article}</article>
                 Your main task is to extract events that are scheduled to happen or have already concluded.
                 Return a JSON object using this schema


                 {
                    {
                       "type": "array",
                       "items": {
                          "type": "object",
                          "properties": {
                             "eventContext": {
                                "type": "string",
                                "description": "Statement describing the event"
                             },
                             "eventDate": {
                                "type": "string",
                                "description": "Specified date of the event. As stated in the article"
                             },
                             "eventType": {
                                "type": "string",
                                "enum": ["upcoming", "concluded"],
                                "description": "If the event is in the future or concluded"
                             }
                          },
                          "required": [
                             "eventContext", "eventDate", "eventType"
                          ]
                       }
                    }
                 }
             """


def openrouter_request(article: str, task: str):
    response = requests.post(
        url = "https://openrouter.ai/api/v1/chat/completions",
        headers = {
            "Authorization": f"Bearer {os.environ.get('OPENROUTER_KEY')}",
            "Content-Type": "application/json"
        },
        data = json.dumps(
            {
                "models": models,
                "messages": [
                    {
                        "role": "user",
                        "content": context(article, task)
                    }
                ],
                "provider": {
                    "order": [
                        "chutes",
                        "groq"
                    ]
                }
            }
        )
    )
    
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.text}")
    
    return response.json()


def extract_entity(text: str):
    store = []
    for line in text.split("\n"):
        if ":" in line:
            store.append(line.strip())
    
    extraction = []
    d = dict()
    count = 0
    while count < len(store):
        for line in store:
            pos = line.find(":")
            if "name" in line[:pos].lower():
                if not d:
                    d["name"] = line[pos + 1:].strip().strip('"').strip(',').strip('"')
                else:
                    extraction.append(d)
                    d = dict()
                    d["name"] = line[pos + 1:].strip().strip('"').strip(',').strip('"')
            elif "job" in line[:pos].lower():
                value = line[pos+1:].strip()
                d["job"] = value.strip('"').strip(',').strip('"')
            elif "context" in line[:pos].lower():
                value = line[pos+1:].strip()
                d["context"] = value.strip('"').strip('"').strip(',').strip('"')
            elif "explicit" in line[:pos].lower():
                value = line[pos+1:].strip()
                d["explicit"] = value.strip('"').strip('"').strip(',').strip('"')
            count += 1
    extraction.append(d)
    return extraction


def extract_event(text: str):
    store = []
    for line in text.split("\n"):
        if ":" in line:
            store.append(line.strip())
    
    extraction = []
    d = dict()
    count = 0
    while count < len(store):
        for line in store:
            pos = line.find(":")
            if "eventcontext" in line[:pos].lower():
                if not d:
                    d["eventContext"] = line[pos + 1:].strip().strip('"').strip(',').strip('"')
                else:
                    extraction.append(d)
                    d = dict()
                    d["eventContext"] = line[pos + 1:].strip().strip('"').strip(',').strip('"')
            elif "eventdate" in line[:pos].lower():
                value = line[pos+1:].strip()
                d["eventDate"] = value.strip('"').strip(',').strip('"')
            elif "eventtype" in line[:pos].lower():
                value = line[pos+1:].strip()
                d["eventType"] = value.strip('"').strip('"').strip(',').strip('"')
            count += 1
    extraction.append(d)
    return extraction


def api_openai(article: str, task: str) -> dict:
    response = requests.post(
        url="https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {os.environ.get('OPENAI_KEY')}",
            "Content-Type": "application/json"
        },
        json = {
            "model": "gpt-4.1",
            "messages": [
                {
                    "role": "user",
                    "content": context(article, task)
                }
            ],
            "max_tokens": 1024
        }
    )
    if response.status_code == 200:
        return response.json()
    return None


def llm_wrapper(article: str, task: str = "entity") -> list:
  try:
     response = openrouter_request(article, task)
     if task == "entity":
        return extract_entity(response["choices"][0]["message"]["content"])
     else:
        return extract_event(response["choices"][0]["message"]["content"])
  except Exception:
    response = api_openai(article, task)
    if response:
      if task == "entity":
         return extract_entity(response["choices"][0]["message"]["content"])
      else:
         return extract_event(response["choices"][0]["message"]["content"])
    return None
  

def levenshtein_distance(s1: str, s2: str) -> float:
    """Calculate normalized Levenshtein distance between two strings."""
    if len(s1) == 0 or len(s2) == 0:
        return 1.0

    # Use SequenceMatcher for efficiency
    matcher = SequenceMatcher(None, s1.lower(), s2.lower())
    return 1.0 - matcher.ratio()

def tokenize_text(text: str) -> List[Tuple[str, int, int]]:
    """Tokenize text and return (word, start_pos, end_pos) tuples."""
    tokens = []
    for match in re.finditer(r'\b\w+\b', text.lower()):
        tokens.append((match.group(), match.start(), match.end()))
    return tokens

def find_fuzzy_sequence(query_tokens: List[str], text_tokens: List[Tuple[str, int, int]],
                       typo_threshold: float = 0.8) -> Optional[Tuple[int, int]]:
    """Find a fuzzy sequence allowing for gaps and typos."""
    if not query_tokens or not text_tokens:
        return None

    best_match = None
    best_score = float('inf')

    # Try starting from each position in the text
    for start_idx in range(len(text_tokens)):
        current_score = 0
        matched_positions = []
        query_idx = 0
        text_idx = start_idx

        while query_idx < len(query_tokens) and text_idx < len(text_tokens):
            query_word = query_tokens[query_idx]
            text_word = text_tokens[text_idx][0]

            # Calculate similarity
            distance = levenshtein_distance(query_word, text_word)
            similarity = 1.0 - distance

            if similarity >= typo_threshold:
                # Good match found
                matched_positions.append(text_idx)
                current_score += distance
                query_idx += 1
                text_idx += 1
            else:
                # No match, advance text position to allow for intervening words
                text_idx += 1

                # If we've gone too far without finding matches, break
                if text_idx - start_idx > len(query_tokens) * 3:
                    break

        # Check if we matched all query words
        if query_idx == len(query_tokens):
            avg_score = current_score / len(query_tokens)
            if avg_score < best_score:
                best_score = avg_score
                start_pos = text_tokens[matched_positions[0]][1]
                end_pos = text_tokens[matched_positions[-1]][2]
                best_match = (start_pos, end_pos)

    return best_match

def split_query_into_chunks(query: str) -> List[str]:
    """Split query into meaningful chunks, handling ellipsis and natural breaks."""
    # First, split by ellipsis or multiple dots
    chunks = re.split(r'\.{3,}', query)

    if len(chunks) > 1:
        # If we have ellipsis, treat as separate chunks
        return [chunk.strip() for chunk in chunks if chunk.strip()]

    # For continuous queries, we'll treat the whole thing as one chunk
    # but the fuzzy matching will handle gaps
    return [query.strip()]

def find_query_in_article(query: str, article: str, typo_threshold: float = 0.8) -> Optional[Tuple[int, int]]:
    """
    Find the location of a query in an article with smart fuzzy matching.

    Args:
        query: The text to search for
        article: The article text to search in
        typo_threshold: Similarity threshold for typo tolerance (0.0-1.0)

    Returns:
        Tuple of (start, end) character positions if found, None otherwise
    """
    if not query or not article:
        return None

    # Handle case insensitivity by working with lowercase versions
    query_lower = query.lower()
    article_lower = article.lower()

    # First try exact substring match (fastest)
    if query_lower in article_lower:
        start = article_lower.find(query_lower)
        return (start, start + len(query))

    # Split query into chunks
    query_chunks = split_query_into_chunks(query)

    if len(query_chunks) == 1:
        # Single chunk - use fuzzy sequence matching
        query_tokens = re.findall(r'\b\w+\b', query_chunks[0].lower())
        text_tokens = tokenize_text(article)
        return find_fuzzy_sequence(query_tokens, text_tokens, typo_threshold)

    else:
        # Multiple chunks - find each chunk and return span from first to last
        chunk_positions = []

        for chunk in query_chunks:
            chunk_tokens = re.findall(r'\b\w+\b', chunk.lower())
            text_tokens = tokenize_text(article)
            chunk_pos = find_fuzzy_sequence(chunk_tokens, text_tokens, typo_threshold)

            if chunk_pos:
                chunk_positions.append(chunk_pos)
            else:
                return None  # If any chunk is not found, return None

        if chunk_positions:
            # Return span from start of first chunk to end of last chunk
            return (chunk_positions[0][0], chunk_positions[-1][1])

    return None
     
    