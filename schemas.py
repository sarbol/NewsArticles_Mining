from dataclasses import dataclass, field
from typing import List, Optional, Union
from datetime import datetime


@dataclass
class Article:
    content: str
    title: Optional[str] = None


@dataclass
class eventObject:
    eventContext: Optional[str] = None
    eventDate: Optional[str] = None
    eventType: Optional[str] = None


@dataclass
class entityObject:
    name: str
    job: str
    context: str
    explicit: bool
    name_position: List[int]
    context_position: List[int]

@dataclass
class Category:
    entities: List[entityObject]
    events: List[eventObject]
    main_category: Optional[str] = None
    sub_category: Optional[str] = None

@dataclass
class ArticleCreate:
    content: str
    entities: List[entityObject]
    events: List[eventObject]
    title: Optional[str] = None
    main_category: Optional[str] = None
    sub_category: Optional[str] = None

@dataclass
class UserCreate:
    name: str
    email: str
    password: str


@dataclass
class UserLogin:
    email: str
    password: str

@dataclass
class Token:
    access_token: str
    token_type: str

@dataclass
class VoteCreate:
    article_id: int
    vote_type: str  # 'up' or 'down'


@dataclass
class ArticleResponse:
    id: int
    publisher: str
    image: str
    title: str
    content: str
    published_at: datetime
    upvotes: int
    downvotes: int
    main_category: Optional[str] = None
    sub_category: Optional[str] = None
    entities: List[entityObject]
    events: List[eventObject]


@dataclass
class PaginatedArticles:
    count: int
    articles: list[ArticleResponse]
