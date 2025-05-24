import os
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from . import models
from .database import SessionLocal

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer()


class AuthError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise AuthError("Invalid authentication credentials")
        return payload
    except jwt.JWTError:
        raise AuthError("Invalid authentication credentials")


def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def authenticate_user(email: str, password: str, db: Session) -> Optional[models.User]:
    """Authenticate user with email and password"""
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """Get current authenticated user"""
    token = credentials.credentials
    payload = verify_token(token)
    email = payload.get("sub")
    token_version = payload.get("token_version")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise AuthError("User not found")
    if not user.is_active:
        raise AuthError("Inactive user")
    
    # Check if token version matches current user token version
    if token_version is None or token_version != user.token_version:
        raise AuthError("Token invalidated - please login again")
    
    return user


def create_user(email: str, password: str, name: str, db: Session, is_admin: bool = False, is_superadmin: bool = False) -> models.User:
    """Create a new user"""
    # Check if user already exists
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(password)
    user = models.User(
        email=email,
        name=name,
        hashed_password=hashed_password,
        is_admin=is_admin,
        is_superadmin=is_superadmin
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_current_admin_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Get current user and verify admin privileges"""
    if not current_user.is_admin and not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Admin access required."
        )
    return current_user


def get_current_superadmin_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Get current user and verify superadmin privileges"""
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Superadmin access required."
        )
    return current_user


def ensure_superadmin_exists(db: Session) -> None:
    """Ensure superadmin user exists and is up to date with environment variables"""
    superadmin_email = os.getenv("SUPERADMIN_EMAIL", "superadmin@printfarmhq.com")
    superadmin_password = os.getenv("SUPERADMIN_PASSWORD", "superadmin123")
    superadmin_name = os.getenv("SUPERADMIN_NAME", "Super Administrator")
    
    # Check if superadmin exists
    superadmin = db.query(models.User).filter(models.User.email == superadmin_email).first()
    
    if superadmin:
        # Update existing superadmin if needed
        needs_update = False
        credentials_changed = False
        
        if superadmin.name != superadmin_name:
            superadmin.name = superadmin_name
            needs_update = True
            
        # Always update password to match environment (in case it changed)
        new_hashed_password = get_password_hash(superadmin_password)
        if superadmin.hashed_password != new_hashed_password:
            superadmin.hashed_password = new_hashed_password
            needs_update = True
            credentials_changed = True
            
        # Ensure superadmin flags are set
        if not superadmin.is_superadmin:
            superadmin.is_superadmin = True
            superadmin.is_admin = True  # Superadmin is also admin
            needs_update = True
            
        # Increment token version if credentials changed to invalidate existing tokens
        if credentials_changed:
            superadmin.token_version += 1
            
        if needs_update:
            db.commit()
            print(f"Updated superadmin user: {superadmin_email}")
    else:
        # Create new superadmin
        superadmin = models.User(
            email=superadmin_email,
            name=superadmin_name,
            hashed_password=get_password_hash(superadmin_password),
            is_admin=True,
            is_superadmin=True
        )
        db.add(superadmin)
        db.commit()
        print(f"Created superadmin user: {superadmin_email}")
    
    # Delete any other superadmin users (in case email changed)
    other_superadmins = db.query(models.User).filter(
        models.User.email != superadmin_email,
        models.User.is_superadmin == True
    ).all()
    
    for user in other_superadmins:
        db.delete(user)
        print(f"Deleted old superadmin user: {user.email}")
    
    if other_superadmins:
        db.commit()