from sqlalchemy.orm import Session
import models
import database
import json
import auth
import random
import pickle

def create_system_user(db: Session):
    system_user = models.User(name = "QuickInsight System", email = "system@quickinsight.app",
                              password = auth.hash_password("supersecret"))
    db.add(system_user)
    db.commit()
    db.refresh(system_user)
    system_publisher = models.Publisher(user_id = system_user.id)
    db.add(system_publisher)
    db.commit()
    db.refresh(system_publisher)
    return system_publisher.id

def populate_articles(db: Session, publisher_id: int, articles: list):
    for art in articles:
        if art.get("sub_category"):
            main_category = art.get("category")
            sub_category = art.get("sub_category")
            image_options = db.query(models.Image).filter(models.Image.main_category == main_category).filter(models.Image.sub_category == sub_category).all()
            image_url = random.choice(image_options)
            article = models.Article(
                publisher_id = publisher_id,
                image_id = image_url.id,
                title = art["title"],
                content = art["content"],
                main_category = art["category"],
                sub_category = art.get("sub_category", "")
                )
            db.add(article)
    db.commit()

def populate_images(db: Session, images: dict, inference_object: dict):
    for key in images.keys():
        for im in images[key]:
            labels = inference_object[key]["labels"]
            sub_category = labels[im["category_id"]]
            image = models.Image(
                main_category = key,
                sub_category = sub_category,
                url = im["url"]
            )
            db.add(image)
    db.commit()


if __name__ == "__main__":
    models.Base.metadata.create_all(bind = database.engine)
    
    db = database.SessionLocal()
    publisher_id = create_system_user(db)
    
    with open("./output/data/articles.json", "r") as f:
        articles = json.load(f)

    with open("./output/data/imageurl.json", "r") as f:
        images = json.load(f)

    with open("./output/artefacts/inference_objects.pkl", "rb") as f:
        inference_object = pickle.load(f)
    
    populate_images(db, images, inference_object)
    populate_articles(db, publisher_id, articles)
    db.close()
    print("System user and articles added.")