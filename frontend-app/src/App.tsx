import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, User, LogOut, Plus, Clock, Tag, HelpCircle, CheckCircle, X, Menu, ThumbsUp, ThumbsDown } from 'lucide-react';

interface Event {
  eventContext: string;
  eventDate: string;
  eventType: string;
}

interface Entity {
  name: string;
  job: string;
  context: string;
  explicit: string;
  name_position: number[];
  context_position: number[];
}

interface VotedUser {
  user_id: number;
  vote_type: 'up' | 'down';
}

interface Article {
  id: number;
  title: string;
  content: string;
  main_category: string;
  sub_category: string | null;
  published_at: string;
  upvotes: number;
  downvotes: number;
  publisher: string;
  image: string;
  voted_users?: VotedUser[];
  entities: Entity[];
  events: Event[];
  user_vote?: 'up' | 'down' | 'neutral';
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthToken {
  access_token: string;
  token_type: string;
}

interface CategoryPrediction {
  main_category: string | null;
  sub_category: string | null;
  entities: Entity[];
  events: Event[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface VoteResponse {
  article_id: number;
  upvotes: number;
  downvotes: number;
  user_current_vote: 'up' | 'down' | 'neutral';
  message: string;
}

const API_BASE_URL = '/api';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [currentPage, setCurrentPage] = useState<'home' | 'article' | 'create' | 'login' | 'register'>('home');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articles, setArticles] = useState<{ [category: string]: Article[] }>({});
  const [featuredArticles, setFeaturedArticles] = useState<Article[]>([]);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [articleForm, setArticleForm] = useState({ title: '', content: '' });

  const categories = ['tech', 'sport', 'politics', 'entertainment', 'business'];

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (featuredArticles.length > 0) {
        setCurrentCarouselIndex((prev) => (prev + 1) % featuredArticles.length);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredArticles.length]);

  useEffect(() => {
    if (currentUser) {
      loadArticles();
    }
  }, [currentUser]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const users = await response.json();
        if (users.length > 0) {
          setCurrentUser(users[0]);
        }
      } else {
        localStorage.removeItem('token');
        setToken(null);
        setCurrentUser(null);
      }
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
      setCurrentUser(null);
    }
  };

  const loadArticles = async () => {
    if (!token || !currentUser) return;
    
    setIsLoading(true);
    try {
      const allArticles: { [category: string]: Article[] } = {};
      const featured: Article[] = [];

      for (const category of categories) {
        const response = await fetch(`${API_BASE_URL}/articles/paginated?main_category=${category}&limit=10&offset=0`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.articles) {
            const articlesWithVotes = data.articles.map((article: Article) => {
              const userVote = article.voted_users?.find(vote => vote.user_id === currentUser.id);
              
              return {
                ...article,
                user_vote: userVote ? userVote.vote_type : 'neutral'
              };
            });
            
            allArticles[category] = articlesWithVotes;
            
            if (featured.length < 5 && articlesWithVotes.length > 0) {
              const remainingSlots = 5 - featured.length;
              featured.push(...articlesWithVotes.slice(0, remainingSlots));
            }
          }
        }
      }

      setArticles(allArticles);
      setFeaturedArticles(featured);
    } catch (error) {
      showToast('Failed to load articles', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('username', loginForm.email);
      formData.append('password', loginForm.password);

      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data: AuthToken = await response.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        setCurrentPage('home');
        showToast('Successfully logged in!', 'success');
        setLoginForm({ email: '', password: '' });
      } else {
        const errorData = await response.json();
        showToast(errorData.detail || 'Invalid credentials', 'error');
      }
    } catch (error) {
      showToast('Login failed', 'error');
    }
  };

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password
        })
      });

      if (response.ok) {
        const data: AuthToken = await response.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        setCurrentPage('home');
        showToast('Account created successfully!', 'success');
        setRegisterForm({ name: '', email: '', password: '' });
      } else {
        const errorData = await response.json();
        showToast(errorData.detail || 'Registration failed', 'error');
      }
    } catch (error) {
      showToast('Registration failed', 'error');
    }
  };

  const handlePublishArticle = async () => {
    if (!articleForm.title.trim() || !articleForm.content.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setIsPublishing(true);
    setPublishProgress(10);
    setCurrentPage('home');

    try {
      setPublishProgress(30);
      const categoryResponse = await fetch(`${API_BASE_URL}/category`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: articleForm.title,
          content: articleForm.content
        })
      });

      let categories: CategoryPrediction = { main_category: null, sub_category: null, entities: [], events: [] };
      if (categoryResponse.ok) {
        categories = await categoryResponse.json();
      }

      setPublishProgress(60);

      const articleResponse = await fetch(`${API_BASE_URL}/articles/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: articleForm.title,
          content: articleForm.content,
          main_category: categories.main_category,
          sub_category: categories.sub_category,
          entities: categories.entities,
          events: categories.events
        })
      });

      setPublishProgress(90);

      if (articleResponse.ok) {
        setPublishProgress(100);
        setTimeout(() => {
          setIsPublishing(false);
          setPublishProgress(0);
          showToast('Article published successfully!', 'success');
          setArticleForm({ title: '', content: '' });
          loadArticles();
        }, 1000);
      } else {
        const errorData = await articleResponse.json();
        throw new Error(errorData.detail || 'Failed to publish article');
      }
    } catch (error) {
      setIsPublishing(false);
      setPublishProgress(0);
      showToast(error instanceof Error ? error.message : 'Failed to publish article', 'error');
    }
  };

  const handleVote = async (articleId: number, voteType: 'up' | 'down') => {
    if (!token || !currentUser) {
      showToast('Please login to vote', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/articles/vote/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          article_id: articleId,
          vote_type: voteType
        })
      });

      if (response.ok) {
        const updatedVote: VoteResponse = await response.json();
        
        setArticles(prev => {
          const newArticles = { ...prev };
          for (const category in newArticles) {
            newArticles[category] = newArticles[category].map(article => {
              if (article.id === articleId) {
                return { 
                  ...article, 
                  upvotes: updatedVote.upvotes,
                  downvotes: updatedVote.downvotes,
                  user_vote: updatedVote.user_current_vote
                };
              }
              return article;
            });
          }
          return newArticles;
        });
        
        setFeaturedArticles(prev => 
          prev.map(article => 
            article.id === articleId 
              ? { 
                  ...article, 
                  upvotes: updatedVote.upvotes,
                  downvotes: updatedVote.downvotes,
                  user_vote: updatedVote.user_current_vote
                } 
              : article
          )
        );
        
        if (selectedArticle && selectedArticle.id === articleId) {
          setSelectedArticle({
            ...selectedArticle,
            upvotes: updatedVote.upvotes,
            downvotes: updatedVote.downvotes,
            user_vote: updatedVote.user_current_vote
          });
        }
        
        showToast(updatedVote.message, 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.detail || 'Failed to vote', 'error');
      }
    } catch (error) {
      showToast('Failed to vote', 'error');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
    setCurrentPage('home');
    setArticles({});
    setFeaturedArticles([]);
    setSelectedEntity(null);
    showToast('Logged out successfully', 'success');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const highlightTextPositions = (text: string, positions: number[][], className: string = 'bg-yellow-200 bg-opacity-50') => {
    if (!positions || positions.length === 0) return text;

    // Sort positions by start index to process them in order
    const sortedPositions = [...positions].sort((a, b) => a[0] - b[0]);
    
    let result = '';
    let lastIndex = 0;

    sortedPositions.forEach(([start, end]) => {
      // Add text before highlight
      result += text.slice(lastIndex, start);
      // Add highlighted text
      result += `<span class="${className}">${text.slice(start, end)}</span>`;
      lastIndex = end;
    });

    // Add remaining text
    result += text.slice(lastIndex);
    return result;
  };

  const handleEntityClick = (entity: Entity) => {
    setSelectedEntity(selectedEntity === entity ? null : entity);
  };

  const renderCategoryIcon = (category: string | null) => {
    if (!category) {
      return <HelpCircle className="w-6 h-6 text-gray-400" />;
    }
    return <Tag className="w-6 h-6 text-blue-500" />;
  };

  const Navigation = () => (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div 
            className="text-2xl md:text-3xl font-bold text-blue-600 cursor-pointer font-['Poppins']"
            onClick={() => {
              setCurrentPage('home');
              setSelectedEntity(null);
            }}
          >
            QuickInsight
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            {currentUser ? (
              <>
                <button
                  onClick={() => setCurrentPage('create')}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-lg"
                >
                  <Plus className="w-5 h-5" />
                  <span>Publish</span>
                </button>
                <div className="flex items-center space-x-2 text-gray-700 text-lg">
                  <User className="w-5 h-5" />
                  <span>{currentUser.name}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </>
            ) : (
              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentPage('login')}
                  className="text-blue-600 hover:text-blue-700 font-medium text-lg"
                >
                  Login
                </button>
                <button
                  onClick={() => setCurrentPage('register')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-lg"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Menu className="w-8 h-8" />
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 pb-4">
            <div className="pt-4 space-y-3">
              {currentUser ? (
                <>
                  <button
                    onClick={() => {
                      setCurrentPage('create');
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 text-blue-600 hover:bg-gray-50 text-lg"
                  >
                    Publish Article
                  </button>
                  <div className="px-4 py-2 text-gray-500 text-lg">
                    {currentUser.name}
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 text-lg"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setCurrentPage('login');
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 text-blue-600 hover:bg-gray-50 text-lg"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setCurrentPage('register');
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 text-blue-600 hover:bg-gray-50 text-lg"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );

  const NewsCard = ({ article, size = 'normal' }: { article: Article; size?: 'large' | 'normal' }) => (
    <div
      className={`bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl ${
        size === 'large' ? 'h-[32rem]' : 'h-[28rem]'
      }`}
      onClick={() => {
        setSelectedArticle(article);
        setSelectedEntity(null);
        setCurrentPage('article');
      }}
    >
      <div className={`relative ${size === 'large' ? 'h-64' : 'h-56'}`}>
        <img
          src={article.image || '/api/placeholder/400/300'}
          alt={article.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=400&h=300&fit=crop';
          }}
        />
        <div className="absolute top-4 left-4 flex items-center space-x-2">
          {renderCategoryIcon(article.main_category)}
          <span className="text-sm md:text-base bg-black bg-opacity-60 text-white px-3 py-1 rounded-full font-medium">
            {article.main_category || 'Uncategorized'}
          </span>
        </div>
        <div className="absolute top-4 right-4 flex items-center space-x-2 bg-black bg-opacity-60 text-white px-3 py-2 rounded-full text-sm md:text-base font-medium">
          <ThumbsUp className={`w-5 h-5 ${article.user_vote === 'up' ? 'text-green-400' : ''}`} />
          <span>{article.upvotes}</span>
          <ThumbsDown className={`w-5 h-5 ${article.user_vote === 'down' ? 'text-red-400' : ''}`} />
          <span>{article.downvotes}</span>
        </div>
      </div>
      
      <div className="p-6">
        <h3 className={`font-bold text-gray-900 mb-4 line-clamp-2 font-['Poppins'] ${
          size === 'large' ? 'text-2xl' : 'text-xl'
        }`}>
          {article.title}
        </h3>
        
        <p className="text-gray-600 mb-5 line-clamp-3 font-['Montserrat'] leading-relaxed text-lg">
          {article.content}
        </p>
        
        <div className="flex items-center justify-between text-base text-gray-500">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span className="font-medium">{formatDate(article.published_at)}</span>
          </div>
          <span className="font-semibold text-blue-600">{article.publisher}</span>
        </div>
      </div>
    </div>
  );

  const FeaturedCarousel = () => {
    if (featuredArticles.length === 0) return null;

    return (
      <div className="relative mb-16">
        <div className="relative h-[32rem] md:h-[40rem] rounded-2xl overflow-hidden">
          {featuredArticles.map((article, index) => (
            <div
              key={article.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentCarouselIndex ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={article.image || '/api/placeholder/800/400'}
                alt={article.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&h=400&fit=crop';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent">
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    {renderCategoryIcon(article.main_category)}
                    <span className="text-base md:text-lg bg-blue-600 text-white px-4 py-2 rounded-full font-semibold">
                      {article.main_category || 'Uncategorized'}
                    </span>
                    <div className="flex items-center space-x-3 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-base md:text-lg font-medium">
                      <ThumbsUp className={`w-5 h-5 md:w-6 md:h-6 ${article.user_vote === 'up' ? 'text-green-400' : ''}`} />
                      <span>{article.upvotes}</span>
                      <ThumbsDown className={`w-5 h-5 md:w-6 md:h-6 ${article.user_vote === 'down' ? 'text-red-400' : ''}`} />
                      <span>{article.downvotes}</span>
                    </div>
                  </div>
                  <h2 
                    className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4 cursor-pointer hover:text-blue-200 transition-colors font-['Poppins'] leading-tight"
                    onClick={() => {
                      setSelectedArticle(article);
                      setSelectedEntity(null);
                      setCurrentPage('article');
                    }}
                  >
                    {article.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-white/90 text-lg md:text-xl">
                    <span className="font-semibold">{article.publisher}</span>
                    <span>•</span>
                    <span>{formatDate(article.published_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="absolute bottom-6 right-6 flex space-x-3">
          {featuredArticles.map((_, index) => (
            <button
              key={index}
              className={`w-4 h-4 rounded-full transition-colors ${
                index === currentCarouselIndex ? 'bg-white' : 'bg-white/50'
              }`}
              onClick={() => setCurrentCarouselIndex(index)}
            />
          ))}
        </div>
      </div>
    );
  };

  const CategorySection = ({ category }: { category: string }) => {
    const categoryArticles = articles[category] || [];
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
        const scrollAmount = 400;
        scrollRef.current.scrollBy({
          left: direction === 'left' ? -scrollAmount : scrollAmount,
          behavior: 'smooth'
        });
      }
    };

    if (categoryArticles.length === 0) return null;

    return (
      <div className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 capitalize font-['Poppins']">
            {category}
          </h2>
          <div className="flex space-x-3">
            <button
              onClick={() => scroll('left')}
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div
          ref={scrollRef}
          className="flex space-x-6 overflow-x-auto scrollbar-hide pb-6"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categoryArticles.map((article) => (
            <div key={article.id} className="flex-shrink-0 w-80 md:w-96">
              <NewsCard article={article} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const EntitiesTable = ({ entities }: { entities: Entity[] }) => {
    const validEntities = entities.filter(entity => 
      entity.name.trim() !== '' || entity.context.trim() !== '' || entity.job.trim() !== ''
    );
    
    if (validEntities.length === 0) {
      return (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="bg-blue-600 text-white px-6 py-4 -mx-8 -mt-8 mb-6 rounded-t-xl">
            <h3 className="text-xl font-bold font-['Poppins']">Entities</h3>
          </div>
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No entities found in this article</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-4">
          <h3 className="text-xl font-bold font-['Poppins']">Entities ({validEntities.length})</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Job</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Context</th>
              </tr>
            </thead>
            <tbody>
              {validEntities.map((entity, index) => (
                <tr
                  key={index}
                  className={`cursor-pointer transition-colors hover:bg-blue-50 ${
                    selectedEntity === entity ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => handleEntityClick(entity)}
                >
                  <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200 font-medium">
                    {entity.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">
                    {entity.job || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 max-w-xs">
                    <div className="truncate" title={entity.context}>
                      {entity.context || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedEntity && (
          <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-200">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">Click highlighted text</span> to see entity details in the article.
            </p>
          </div>
        )}
      </div>
    );
  };

  const EventsTable = ({ events }: { events: Event[] }) => {
    const validEvents = events.filter(event => 
      event.eventContext.trim() !== '' || event.eventDate.trim() !== '' || event.eventType.trim() !== ''
    );
    
    if (validEvents.length === 0) {
      return (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="bg-green-600 text-white px-6 py-4 -mx-8 -mt-8 mb-6 rounded-t-xl">
            <h3 className="text-xl font-bold font-['Poppins']">Events</h3>
          </div>
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No events found in this article</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-green-600 text-white px-6 py-4">
          <h3 className="text-xl font-bold font-['Poppins']">Events ({validEvents.length})</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Context</th>
              </tr>
            </thead>
            <tbody>
              {validEvents.map((event, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200 font-medium">
                    {event.eventType || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">
                    {event.eventDate || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 max-w-xs">
                    <div className="truncate" title={event.eventContext}>
                      {event.eventContext || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const PublishProgress = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-4">
            <CheckCircle className="w-16 h-16 text-blue-600 mx-auto animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4 font-['Poppins']">
            Publishing Your Article
          </h3>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${publishProgress}%` }}
            />
          </div>
          <p className="text-gray-600 text-lg font-['Montserrat']">
            {publishProgress < 30 && "Analyzing content..."}
            {publishProgress >= 30 && publishProgress < 60 && "Classifying article..."}
            {publishProgress >= 60 && publishProgress < 90 && "Creating article..."}
            {publishProgress >= 90 && "Almost done!"}
          </p>
        </div>
      </div>
    </div>
  );

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  const Toast = ({ toast }: { toast: Toast }) => (
    <div className={`fixed top-20 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 text-lg ${
      toast.type === 'success' ? 'bg-green-500 text-white' :
      toast.type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`}>
      {toast.type === 'success' && <CheckCircle className="w-6 h-6" />}
      {toast.type === 'error' && <X className="w-6 h-6" />}
      <span className="font-['Montserrat']">{toast.message}</span>
    </div>
  );

  if (!currentUser && currentPage === 'home') {
    return (
      <div className="min-h-screen bg-gray-50 font-['Montserrat']">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-8 font-['Poppins']">
            Welcome to QuickInsight
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-12 leading-relaxed max-w-4xl mx-auto">
            Your premier destination for AI-powered news categorization and insights. 
            Discover, read, and publish articles with intelligent categorization.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              onClick={() => setCurrentPage('login')}
              className="bg-blue-600 text-white px-8 md:px-10 py-4 rounded-xl text-xl font-semibold hover:bg-blue-700 transition-colors transform hover:scale-105 duration-200 shadow-lg"
            >
              Get Started
            </button>
            <button
              onClick={() => setCurrentPage('register')}
              className="border-2 border-blue-600 text-blue-600 px-8 md:px-10 py-4 rounded-xl text-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'login') {
    return (
      <div className="min-h-screen bg-gray-50 font-['Montserrat']">
        <Navigation />
        <div className="max-w-md mx-auto px-4 py-12 md:py-16">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 font-['Poppins']">Login</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xl font-semibold text-gray-700 mb-3">Email</label>
                <input
                  type="email"
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <div>
                <label className="block text-xl font-semibold text-gray-700 mb-3">Password</label>
                <input
                  type="password"
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 transition-colors font-semibold text-xl"
              >
                Login
              </button>
            </div>
            <p className="text-center mt-6 text-gray-600 text-lg">
              Don't have an account?{' '}
              <button
                onClick={() => setCurrentPage('register')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'register') {
    return (
      <div className="min-h-screen bg-gray-50 font-['Montserrat']">
        <Navigation />
        <div className="max-w-md mx-auto px-4 py-12 md:py-16">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 font-['Poppins']">Sign Up</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xl font-semibold text-gray-700 mb-3">Name</label>
                <input
                  type="text"
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xl font-semibold text-gray-700 mb-3">Email</label>
                <input
                  type="email"
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xl font-semibold text-gray-700 mb-3">Password</label>
                <input
                  type="password"
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
                />
              </div>
              <button
                onClick={handleRegister}
                className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 transition-colors font-semibold text-xl"
              >
                Sign Up
              </button>
            </div>
            <p className="text-center mt-6 text-gray-600 text-lg">
              Already have an account?{' '}
              <button
                onClick={() => setCurrentPage('login')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'create') {
    return (
      <div className="min-h-screen bg-gray-50 font-['Montserrat']">
        <Navigation />
        <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10">
            <div className="text-center mb-8 md:mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-['Poppins'] text-gray-900">
                Publish New Article
              </h2>
              <p className="text-lg md:text-xl text-gray-600">
                Share your story with the world. Our AI will automatically categorize your content.
              </p>
            </div>
            
            <div className="space-y-8">
              <div>
                <label className="block text-xl font-semibold text-gray-700 mb-3">Article Title</label>
                <input
                  type="text"
                  className="w-full px-5 md:px-6 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl md:text-2xl font-['Poppins'] transition-colors"
                  value={articleForm.title}
                  onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                  placeholder="Enter a compelling title for your article..."
                />
              </div>
              
              <div>
                <label className="block text-xl font-semibold text-gray-700 mb-3">Article Content</label>
                <div className="relative">
                  <textarea
                    rows={20}
                    className="w-full px-5 md:px-6 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-lg md:text-xl leading-relaxed font-['Montserrat'] transition-colors"
                    value={articleForm.content}
                    onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                    placeholder="Write your article content here... Tell your story, share your insights, and engage with your readers."
                  />
                  <div className="absolute bottom-4 right-4 text-base text-gray-400">
                    {articleForm.content.length} characters
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-xl p-5 md:p-6">
                <h3 className="text-xl font-semibold text-blue-900 mb-3 font-['Poppins']">AI-Powered Categorization</h3>
                <p className="text-blue-700 text-lg">
                  Once you publish, our AI will automatically analyze your content and assign appropriate categories to help readers discover your article.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={handlePublishArticle}
                  className="flex-1 bg-blue-600 text-white px-6 md:px-8 py-4 rounded-xl text-lg md:text-xl font-semibold hover:bg-blue-700 transition-colors transform hover:scale-105 duration-200 shadow-lg"
                >
                  Publish Article
                </button>
                <button
                  onClick={() => setCurrentPage('home')}
                  className="flex-1 border-2 border-gray-300 text-gray-700 px-6 md:px-8 py-4 rounded-xl text-lg md:text-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'article' && selectedArticle) {
    // Prepare highlighted content
    const getHighlightedContent = () => {
      if (!selectedEntity) return selectedArticle.content;
      
      let content = selectedArticle.content;
      const positions = [];
      
      // Add name positions if they exist and are valid
      if (selectedEntity.name_position && selectedEntity.name_position.length === 2) {
        const [start, end] = selectedEntity.name_position;
        if (start < end && start >= 0 && end <= content.length) {
          positions.push([start, end]);
        }
      }
      
      // Add context positions if they exist and are valid
      if (selectedEntity.context_position && selectedEntity.context_position.length === 2) {
        const [start, end] = selectedEntity.context_position;
        if (start < end && start >= 0 && end <= content.length) {
          positions.push([start, end]);
        }
      }
      
      return highlightTextPositions(content, positions, 'bg-yellow-300 bg-opacity-40 px-1 rounded shadow-sm');
    };

    return (
      <div className="min-h-screen bg-gray-50 font-['Montserrat']">
        <Navigation />
        <div className="max-w-full mx-auto px-4 md:px-6 py-8 md:py-10">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Article Content */}
            <div className="lg:w-2/3">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 md:p-10">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 md:mb-8 font-['Poppins'] leading-tight">
                    {selectedArticle.title}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-6 md:mb-8 text-base md:text-lg text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="font-medium">{formatDate(selectedArticle.published_at)}</span>
                    </div>
                    <span className="text-gray-300">•</span>
                    <span className="font-semibold text-blue-600 text-lg md:text-xl">{selectedArticle.publisher}</span>
                    <span className="text-gray-300">•</span>
                    <div className="flex items-center space-x-2">
                      {renderCategoryIcon(selectedArticle.main_category)}
                      <span className="font-medium">{selectedArticle.main_category || 'Uncategorized'}</span>
                    </div>
                    {selectedArticle.sub_category && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm md:text-base font-medium">
                          {selectedArticle.sub_category}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                <img
                  src={selectedArticle.image || '/api/placeholder/800/400'}
                  alt={selectedArticle.title}
                  className="w-full h-64 md:h-96 object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&h=400&fit=crop';
                  }}
                />
                
                <div className="p-6 md:p-10">
                  {selectedEntity && (
                    <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                      <p className="text-yellow-800 font-medium">
                        <span className="font-bold">Highlighting:</span> {selectedEntity.name || 'Entity'} 
                        {selectedEntity.job && ` (${selectedEntity.job})`}
                      </p>
                      <button 
                        onClick={() => setSelectedEntity(null)}
                        className="mt-2 text-yellow-600 hover:text-yellow-800 text-sm underline"
                      >
                        Clear highlighting
                      </button>
                    </div>
                  )}
                  
                  <div className="prose prose-lg md:prose-xl max-w-none">
                    {selectedEntity ? (
                      <div 
                        className="text-gray-800 leading-relaxed text-lg md:text-xl"
                        dangerouslySetInnerHTML={{ 
                          __html: getHighlightedContent().split('\n').map(p => `<p class="mb-6">${p}</p>`).join('') 
                        }}
                      />
                    ) : (
                      selectedArticle.content.split('\n').map((paragraph, index) => (
                        <p key={index} className="mb-6 text-gray-800 leading-relaxed text-lg md:text-xl">
                          {paragraph}
                        </p>
                      ))
                    )}
                  </div>
                  
                  <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t-2 border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-4 md:space-x-6">
                      <button
                        onClick={() => handleVote(selectedArticle.id, 'up')}
                        className={`flex items-center space-x-3 px-6 py-3 rounded-xl transition-colors font-semibold text-lg ${
                          selectedArticle.user_vote === 'up'
                            ? 'bg-green-500 text-white'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        <ThumbsUp className="w-6 h-6 md:w-7 md:h-7" />
                        <span>{selectedArticle.upvotes}</span>
                      </button>
                      <button
                        onClick={() => handleVote(selectedArticle.id, 'down')}
                        className={`flex items-center space-x-3 px-6 py-3 rounded-xl transition-colors font-semibold text-lg ${
                          selectedArticle.user_vote === 'down'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        <ThumbsDown className="w-6 h-6 md:w-7 md:h-7" />
                        <span>{selectedArticle.downvotes}</span>
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedEntity(null);
                        setCurrentPage('home');
                      }}
                      className="bg-blue-600 text-white px-6 md:px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors text-lg font-semibold w-full md:w-auto"
                    >
                      Back to Home
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Side Panel for Entities and Events */}
            <div className="lg:w-1/3">
              <div className="sticky top-24 space-y-6">
                <EntitiesTable entities={selectedArticle.entities} />
                <EventsTable events={selectedArticle.events} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-['Montserrat']">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <FeaturedCarousel />
            
            {categories.map((category) => (
              <CategorySection key={category} category={category} />
            ))}

            {Object.keys(articles).length === 0 && !isLoading && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-xl">No articles available. Be the first to publish!</p>
              </div>
            )}
          </>
        )}
      </div>

      {isPublishing && <PublishProgress />}

      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
      
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap');
          
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          
          .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          
          .line-clamp-3 {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
        `}
      </style>
    </div>
  );
};

export default App;