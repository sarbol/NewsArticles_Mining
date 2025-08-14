from sentence_transformers import SentenceTransformer
import hdbscan
from sklearn.cluster import KMeans
import numpy as np
import os
from dotenv import load_dotenv
import requests
import json

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
    

def context(article: str):
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


def openrouter_request(article: str):
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
                        "content": context(article)
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