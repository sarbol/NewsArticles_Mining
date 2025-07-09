from dataclasses import dataclass, field
from typing import List, Optional, Union


@dataclass
class Article:
    content: str
    title: Optional[str] = None

@dataclass
class Category:
    main: Optional[str] = None
    sub: Optional[str] = None