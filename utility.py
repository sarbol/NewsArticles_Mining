from sentence_transformers import SentenceTransformer
import hdbscan
from sklearn.cluster import KMeans
import numpy as np


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