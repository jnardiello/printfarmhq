from datetime import datetime, timedelta
from typing import Optional, List
from jose import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from . import models
from .database import SessionLocal, get_jwt_secret

# JWT Configuration
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


def create_access_token(data: dict, db: Session, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    secret_key = get_jwt_secret(db)
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, db: Session) -> dict:
    """Verify JWT token and return payload"""
    try:
        secret_key = get_jwt_secret(db)
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
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
    payload = verify_token(token, db)
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


def create_user(email: str, password: str, name: str, db: Session, is_admin: bool = False, is_superadmin: bool = False, created_by_user_id: Optional[int] = None) -> models.User:
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
        is_superadmin=is_superadmin,
        created_by_user_id=created_by_user_id
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


def get_current_god_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Get current user and verify god user privileges"""
    if not current_user.is_god_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. God user access required."
        )
    return current_user


def create_superadmin(email: str, password: str, name: str, db: Session) -> models.User:
    """Create initial superadmin user during setup - this will be the god user"""
    # Check if any superadmin already exists
    existing_superadmin = db.query(models.User).filter(models.User.is_superadmin == True).first()
    if existing_superadmin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Superadmin already exists. Setup is not required."
        )
    
    # Check if email is already in use
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create god user (first superadmin)
    hashed_password = get_password_hash(password)
    superadmin = models.User(
        email=email,
        name=name,
        hashed_password=hashed_password,
        is_admin=True,
        is_superadmin=True,
        is_god_user=True  # First superadmin is the god user
    )
    db.add(superadmin)
    db.commit()
    db.refresh(superadmin)
    return superadmin


def create_tenant_superadmin(email: str, password: str, name: str, company_name: str, db: Session) -> models.User:
    """Create a new tenant super-admin through self-registration"""
    # Check if god user exists (system must be initialized first)
    god_user = db.query(models.User).filter(models.User.is_god_user == True).first()
    if not god_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System not initialized. Please complete initial setup first."
        )
    
    # Check if email is already in use
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new super-admin for the tenant
    hashed_password = get_password_hash(password)
    tenant_admin = models.User(
        email=email,
        name=f"{name} ({company_name})",  # Include company name for clarity
        hashed_password=hashed_password,
        is_admin=True,
        is_superadmin=True,
        is_god_user=False,  # Not a god user
        created_by_user_id=None  # Super-admins are not created by anyone
    )
    db.add(tenant_admin)
    db.commit()
    db.refresh(tenant_admin)
    return tenant_admin


def create_public_user(email: str, password: str, name: str, db: Session) -> models.User:
    """Create a new super-admin through public registration"""
    # Check if god user exists (system must be initialized first)
    god_user = db.query(models.User).filter(models.User.is_god_user == True).first()
    if not god_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System not initialized. Please complete initial setup first."
        )
    
    # Check if email is already in use
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new super-admin for public registration
    hashed_password = get_password_hash(password)
    public_user = models.User(
        email=email,
        name=name,  # Use name as provided, no company name appended
        hashed_password=hashed_password,
        is_admin=True,
        is_superadmin=True,
        is_god_user=False,  # Not a god user
        created_by_user_id=None  # Super-admins are not created by anyone
    )
    db.add(public_user)
    db.commit()
    db.refresh(public_user)
    return public_user


def create_password_reset_request(email: str, db: Session) -> models.PasswordResetRequest:
    """Create a password reset request for manual approval by god user."""
    
    # Check if email exists in the system (but don't reveal if it doesn't for security)
    user = db.query(models.User).filter(models.User.email == email).first()
    
    # Always create a request regardless of whether email exists to prevent email enumeration
    # Check if there's already a pending request for this email in the last 24 hours
    from datetime import datetime, timedelta
    recent_request = db.query(models.PasswordResetRequest).filter(
        models.PasswordResetRequest.email == email,
        models.PasswordResetRequest.status == "pending",
        models.PasswordResetRequest.requested_at > datetime.utcnow() - timedelta(hours=24)
    ).first()
    
    if recent_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset request already submitted. Please wait for processing or try again later."
        )
    
    # Create new password reset request
    reset_request = models.PasswordResetRequest(
        email=email,
        status="pending"
    )
    db.add(reset_request)
    db.commit()
    db.refresh(reset_request)
    
    return reset_request


def get_pending_password_reset_requests(db: Session) -> List[models.PasswordResetRequest]:
    """Get all pending password reset requests for god dashboard."""
    return db.query(models.PasswordResetRequest).filter(
        models.PasswordResetRequest.status == "pending"
    ).order_by(models.PasswordResetRequest.requested_at.desc()).all()


def process_password_reset_request(
    request_id: int, 
    action: str, 
    god_user: models.User, 
    db: Session, 
    new_password: Optional[str] = None,
    notes: Optional[str] = None
) -> models.PasswordResetRequest:
    """Process a password reset request (approve or reject)."""
    from datetime import datetime
    
    # Get the request
    reset_request = db.query(models.PasswordResetRequest).filter(
        models.PasswordResetRequest.id == request_id,
        models.PasswordResetRequest.status == "pending"
    ).first()
    
    if not reset_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Password reset request not found or already processed"
        )
    
    if action == "approve":
        if not new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password is required when approving a request"
            )
        
        # Find the user by email
        user = db.query(models.User).filter(models.User.email == reset_request.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found with this email address"
            )
        
        # Reset the user's password
        user.hashed_password = get_password_hash(new_password)
        user.token_version += 1  # Invalidate all existing JWT tokens
        
        reset_request.status = "approved"
        
    elif action == "reject":
        reset_request.status = "rejected"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be either 'approve' or 'reject'"
        )
    
    # Update request metadata
    reset_request.processed_at = datetime.utcnow()
    reset_request.processed_by_user_id = god_user.id
    reset_request.notes = notes
    
    db.commit()
    db.refresh(reset_request)
    
    return reset_request


def get_all_password_reset_requests(db: Session) -> List[models.PasswordResetRequest]:
    """Get all password reset requests (pending and processed) for audit ledger"""
    return db.query(models.PasswordResetRequest).options(
        joinedload(models.PasswordResetRequest.processed_by)
    ).order_by(models.PasswordResetRequest.requested_at.desc()).all()