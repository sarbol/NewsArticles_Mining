from sqlalchemy.orm import Session
import models
import auth
from fastapi import HTTPException
import json

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user_data):
    hashed_pw = auth.hash_password(user_data.password)
    user = models.User(
        name = user_data.name,
        email = user_data.email,
        password = hashed_pw
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def create_article(db: Session, publisher_id: int, image_id: int, article_data):
    article = models.Article(publisher_id=publisher_id, image_id = image_id,
                             title = article_data.title, content = article_data.content,
                             main_category = article_data.main_category,
                             sub_category = article_data.sub_category,
                             entities = [e.__dict__ for e in article_data.entities],
                             events = [e.__dict__ for e in article_data.events])
    db.add(article)
    db.commit()
    db.refresh(article)
    return article

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user or not auth.verify_password(password, user.password):
        return None
    return user


def get_articles_by_category(db: Session, main_category: str, limit: int, offset: int):
    query = db.query(models.Article).filter(models.Article.main_category == main_category)
    total = query.count()
    articles = query.order_by(models.Article.published_at.desc()).offset(offset).limit(limit).all()
    retrieved_articles = []
    for article in articles:
        voted_users = [{"user_id": vote.user_id, "vote_type": vote.vote_type} for vote in article.votes]
        data = {
            "id": article.id,
            "publisher": article.publisher.user.name,
            "image": article.image.url,
            "title": article.title,
            "content": article.content,
            "main_category": article.main_category,
            "sub_category": article.sub_category,
            "published_at": article.published_at,
            "upvotes": article.upvotes,
            "downvotes": article.downvotes,
            "voted_users": voted_users,
            "entities": article.entities,
            "events": article.events
        }
        retrieved_articles.append(data)
    return {"total": total, "articles": retrieved_articles}


def make_vote(db: Session, user_id: int, vote_data):
    article = db.query(models.Article).filter(models.Article.id == vote_data.article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    existing_vote = db.query(models.Vote).filter(
        models.Vote.user_id == user_id,
        models.Vote.article_id == vote_data.article_id
    ).first()

    if existing_vote:
        if existing_vote.vote_type == vote_data.vote_type:
            # User clicked the same vote again → neutral position
            db.delete(existing_vote)
            user_vote = "neutral"
            if vote_data.vote_type == 'up':
                article.upvotes -= 1
            else:
                article.downvotes -= 1
        else:
            # User switched vote (e.g., up → down)
            if vote_data.vote_type == 'up':
                article.upvotes += 1
                article.downvotes -= 1
                user_vote = "up"
            else:
                article.downvotes += 1
                article.upvotes -= 1
                user_vote = "down"
            existing_vote.vote_type = vote_data.vote_type
    else:
        # First time vote
        new_vote = models.Vote(user_id=user_id, article_id=vote_data.article_id, vote_type=vote_data.vote_type)
        db.add(new_vote)
        if vote_data.vote_type == 'up':
            article.upvotes += 1
            user_vote = "up"
        else:
            article.downvotes += 1
            user_vote = "down"

    db.commit()
    db.refresh(article)
    return {
        "article_id": article.id,
        "upvotes": article.upvotes,
        "downvotes": article.downvotes,
        "user_current_vote": user_vote,
        "message": "Vote updated successfully"
    }