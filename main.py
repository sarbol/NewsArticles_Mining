import os
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import hdbscan
from sklearn.cluster import KMeans
import umap
import pickle
import numpy as np
import requests
import json
import schemas
import utility

load_dotenv()

embedding_model = SentenceTransformer('all-mpnet-base-v2')
with open("./output/artefacts/inference_objects.pkl", "rb") as f:
    inference_obj = pickle.load(f)

def predict_category(article: schemas.Article):
    if article.title:
        content = article.title + "\n" + article.content
    else:
        content = article.content
    
    response = utility.news_classification(content, embedding_model, inference_obj)
    
    if response:
        return schemas.Category(main = response["category"], sub = response["sub_category"])
    
    return schemas.Category(main = None, sub = None)


if __name__ == "__main__":
    # Example usage
    content = utility.read_txt_file("news.txt")
    article = schemas.Article(content = content)
    category = predict_category(article)
    print(f"Main Category: {category.main}, Sub Category: {category.sub}")
