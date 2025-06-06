from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
import secrets
import os

# Get database URL from environment
# In Docker, this should be sqlite:////data/hq.db (shared volume)
# For local development without Docker, use sqlite:///./hq.db
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hq.db")

# Configure engine based on database type
connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_jwt_secret(db_session) -> str:
    """Get or create JWT secret from database."""
    from .models import AppConfig
    from sqlalchemy.exc import IntegrityError
    
    config = db_session.query(AppConfig).filter(AppConfig.key == "jwt_secret").first()
    if not config:
        # Generate new secret and store it
        secret = secrets.token_urlsafe(32)
        config = AppConfig(key="jwt_secret", value=secret)
        db_session.add(config)
        try:
            db_session.commit()
            return secret
        except IntegrityError:
            # Another process may have created it, rollback and fetch again
            db_session.rollback()
            config = db_session.query(AppConfig).filter(AppConfig.key == "jwt_secret").first()
            if config:
                return config.value
            else:
                raise  # Re-raise if still not found
    return config.value


def setup_required(db_session) -> bool:
    """Check if initial setup is required (no superadmin exists)."""
    from .models import User
    
    superadmin = db_session.query(User).filter(User.is_superadmin == True).first()
    return superadmin is None