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
import uvicorn
import utility
from fastapi import FastAPI, HTTPException, status, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import models
import database
import crud
import auth
from typing import Dict, Optional
import random

load_dotenv()

embedding_model = SentenceTransformer('all-mpnet-base-v2')
with open("./output/artefacts/inference_objects.pkl", "rb") as f:
    inference_obj = pickle.load(f)


app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_db():
    db = database.SessionLocal()
    
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        user_id = auth.decode_access_token(token)
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@app.get("/api/")
async def root():
    return {"message": "Welcome to the News Category Prediction API"}


@app.post("/api/category", status_code = status.HTTP_200_OK, response_model=schemas.Category)
def predict_category(article: schemas.Article):
    if article.title:
        content = article.title + "\n" + article.content
    else:
        content = article.content
    
    response = utility.news_classification(content, embedding_model, inference_obj)
    
    if response:
        return {
            "main": response.get("category"),
            "sub": response.get("sub_category")
        }
    
    return {
        "main": None,
        "sub": None
    }


@app.post("/api/register", response_model=schemas.Token)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if crud.get_user_by_email(db, user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_obj = crud.create_user(db, user)
    token = auth.create_access_token(data={"user_id": user_obj.id})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = auth.create_access_token(data={"user_id": user.id})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/api/articles/")
def create_article(article: schemas.ArticleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    publisher = db.query(models.Publisher).filter(models.Publisher.user_id == current_user.id).first()
    if not publisher:
        publisher = models.Publisher(user_id = current_user.id)
        db.add(publisher)
        db.commit()
        db.refresh(publisher)
    if article.main_category is not None and article.sub_category is not None:
        image_options = db.query(models.Image).filter(models.Image.main_category == article.main_category).filter(models.Image.sub_category == article.sub_category).all()
        image = random.choice(image_options)
    elif article.main_category is not None:
        image_options = db.query(models.Image).filter(models.Image.main_category == article.main_category).all()
        image = random.choice(image_options)
    else:
        image = db.query(models.Image).filter(models.Image.main_category == "general").first()
    return crud.create_article(db, publisher.id, image.id, article)

@app.post("/api/articles/vote/")
def vote_article(vote: schemas.VoteCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.make_vote(db, current_user.id, vote)

@app.get("/api/users/")
def read_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()


@app.get("/api/articles/paginated", response_model = schemas.PaginatedArticles)
def read_articles_paginated(main_category: str, limit: int = Query(10, ge=1, le=100),
                            offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
     
    return crud.get_articles_by_category(db, main_category, limit, offset)


if __name__ == "__main__":
    uvicorn.run("main:app", host = "0.0.0.0", port = 8000, log_level = "info", reload = True)
