from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "user"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    publishers = relationship("Publisher", back_populates="user")
    votes = relationship("Vote", back_populates="user", cascade="all, delete-orphan")

class Publisher(Base):
    __tablename__ = "publisher"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default = func.now())
    user = relationship("User", back_populates="publishers")
    articles = relationship("Article", back_populates="publisher")

class Article(Base):
    __tablename__ = "article"
    id = Column(Integer, primary_key=True, index=True)
    publisher_id = Column(Integer, ForeignKey("publisher.id"), nullable=False)
    image_id = Column(Integer, ForeignKey("image.id"), nullable = False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    main_category = Column(String, nullable=False)
    sub_category = Column(String)
    published_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    publisher = relationship("Publisher", back_populates="articles")
    votes = relationship("Vote", back_populates="article", cascade="all, delete-orphan")
    image = relationship("Image", back_populates = "article")

class Vote(Base):
    __tablename__ = "vote"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    article_id = Column(Integer, ForeignKey("article.id"), nullable=False)
    vote_type = Column(String, nullable=False)  # 'up' or 'down'
    created_at = Column(TIMESTAMP, server_default = func.now())
    user = relationship("User", back_populates="votes")
    article = relationship("Article", back_populates="votes")

class Image(Base):
    __tablename__ = "image"
    id = Column(Integer, primary_key = True, index = True)
    main_category = Column(String, nullable=False)
    sub_category = Column(String, nullable = False)
    url = Column(String, nullable = False)
    article = relationship("Article", back_populates = "image")