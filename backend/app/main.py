from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List, Union
from datetime import timedelta, datetime, timezone
import json
import os
import shutil
import uuid
import logging

from . import models, schemas
from .database import Base, engine, SessionLocal
from .utils.form_helpers import parse_time_from_form
from .auth import (
    get_current_user, 
    get_current_admin_user,
    get_current_superadmin_user,
    get_current_god_user,
    create_access_token, 
    authenticate_user,
    create_user,
    create_superadmin,
    create_tenant_superadmin,
    create_public_user,
    get_password_hash,
    create_password_reset_request,
    get_pending_password_reset_requests,
    get_all_password_reset_requests,
    process_password_reset_request,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .database import setup_required
from .alerts import generate_alerts

# Activity tracking helpers
def log_user_activity(
    db: Session, 
    user: models.User, 
    activity_type: str, 
    request: Request = None,
    metadata: dict = None
):
    """Helper function to log user activity"""
    current_time = datetime.utcnow()
    
    # Update user's last activity
    user.last_activity = current_time
    
    # Extract client information if request is provided
    ip_address = None
    user_agent = None
    if request:
        ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
        user_agent = request.headers.get("user-agent")
    
    # Create activity record
    activity = models.UserActivity(
        user_id=user.id,
        activity_type=activity_type,
        activity_timestamp=current_time,
        ip_address=ip_address,
        user_agent=user_agent,
        activity_metadata=json.dumps(metadata) if metadata else None
    )
    
    db.add(activity)
    db.commit()

# Create DB tables
Base.metadata.create_all(bind=engine)

# ensure extra columns exist (simple migration)
from .database import _ensure_columns

_ensure_columns()

# Remove environment-based superadmin creation - now handled via setup endpoint

# Configure logging
logger = logging.getLogger(__name__)

UPLOAD_DIRECTORY = os.path.join(os.getcwd(), "uploads/product_models")
# Ensure upload directory exists
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

app = FastAPI(title="HQ Inventory & COGS API")

# CORS (allow all origins for local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_owner_id(user: models.User) -> Optional[int]:
    """Get the owner_id for filtering data based on the user's role"""
    if user.is_god_user:
        return None  # God user sees all data
    elif user.is_superadmin:
        return user.id  # Super-admin owns their data
    else:
        return user.created_by_user_id  # Team member's data belongs to their super-admin


# ---------- Health Check ---------- #

@app.get("/")
def root():
    """Root endpoint"""
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "1.0.0"}


# ---------- Auth ---------- #

@app.post("/auth/register", response_model=schemas.AuthResponse)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        user = create_user(user_data.email, user_data.password, user_data.name, db, user_data.is_admin)
        
        # Create JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "token_version": user.token_version}, db=db, expires_delta=access_token_expires
        )
        
        return schemas.AuthResponse(
            access_token=access_token,
            user=schemas.UserRead.model_validate(user)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User registration failed: {str(e)}"
        )


@app.post("/auth/login", response_model=schemas.AuthResponse)
def login(credentials: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    """Login user"""
    user = authenticate_user(credentials.email, credentials.password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Track login activity
    current_time = datetime.utcnow()
    user.last_login = current_time
    user.last_activity = current_time
    user.login_count = (user.login_count or 0) + 1
    
    # Extract client information
    ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    user_agent = request.headers.get("user-agent")
    
    # Log the activity
    activity = models.UserActivity(
        user_id=user.id,
        activity_type="login",
        activity_timestamp=current_time,
        ip_address=ip_address,
        user_agent=user_agent,
        activity_metadata=json.dumps({"email": user.email})
    )
    db.add(activity)
    
    # Commit changes
    db.commit()
    db.refresh(user)
    
    # Create JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "token_version": user.token_version}, db=db, expires_delta=access_token_expires
    )
    
    return schemas.AuthResponse(
        access_token=access_token,
        user=schemas.UserRead.model_validate(user)
    )


@app.get("/auth/me", response_model=schemas.UserRead)
def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    """Get current user info"""
    return schemas.UserRead.model_validate(current_user)


@app.get("/auth/validate")
def validate_token(current_user: models.User = Depends(get_current_user)):
    """Validate current token"""
    return {"valid": True, "user_id": current_user.id}


@app.get("/auth/setup-status", response_model=schemas.SetupStatusResponse)
def get_setup_status(db: Session = Depends(get_db)):
    """Check if initial setup is required"""
    # Check if any super-admin exists
    has_superadmin = db.query(models.User).filter(models.User.is_superadmin == True).first() is not None
    
    # Check if god user exists
    has_god_user = db.query(models.User).filter(models.User.is_god_user == True).first() is not None
    
    return schemas.SetupStatusResponse(
        setup_required=not has_superadmin,
        god_user_required=has_superadmin and not has_god_user
    )


@app.post("/auth/setup", response_model=schemas.AuthResponse)
def setup_application(setup_data: schemas.SetupRequest, db: Session = Depends(get_db)):
    """Initial application setup - create superadmin user"""
    try:
        user = create_superadmin(setup_data.email, setup_data.password, setup_data.name, db)
        
        # Create JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "token_version": user.token_version}, db=db, expires_delta=access_token_expires
        )
        
        return schemas.AuthResponse(
            access_token=access_token,
            user=schemas.UserRead.model_validate(user)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Setup failed: {str(e)}"
        )


@app.post("/auth/self-register", response_model=schemas.AuthResponse)
def self_register(registration_data: schemas.TenantRegistrationRequest, db: Session = Depends(get_db)):
    """Self-registration for new tenant super-admins"""
    try:
        # Check if system is initialized
        if setup_required(db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System not initialized. Please complete initial setup first."
            )
        
        # Create new tenant super-admin
        user = create_tenant_superadmin(
            registration_data.email, 
            registration_data.password, 
            registration_data.name, 
            registration_data.company_name,
            db
        )
        
        # Create JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "token_version": user.token_version}, 
            db=db, 
            expires_delta=access_token_expires
        )
        
        return schemas.AuthResponse(
            access_token=access_token,
            user=schemas.UserRead.model_validate(user)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@app.post("/auth/register", response_model=schemas.AuthResponse)
def public_register(registration_data: schemas.PublicRegistrationRequest, db: Session = Depends(get_db)):
    """Public registration for new organizations - anyone can register"""
    try:
        # Check if system is initialized
        if setup_required(db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System not initialized. Please complete initial setup first."
            )
        
        # Create new super-admin through public registration
        user = create_public_user(
            registration_data.email, 
            registration_data.password, 
            registration_data.name,
            db
        )
        
        # Create JWT token and auto-login
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "token_version": user.token_version}, 
            db=db, 
            expires_delta=access_token_expires
        )
        
        return schemas.AuthResponse(
            access_token=access_token,
            user=schemas.UserRead.model_validate(user)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@app.get("/auth/superadmins", response_model=List[schemas.UserRead])
def list_superadmins_for_god_selection(db: Session = Depends(get_db)):
    """List super-admins for god user selection (only available when no god user exists)"""
    # Check if god user already exists
    god_user_exists = db.query(models.User).filter(models.User.is_god_user == True).first() is not None
    if god_user_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="God user already exists"
        )
    
    # Return all super-admins
    superadmins = db.query(models.User).filter(
        models.User.is_superadmin == True
    ).all()
    
    return [schemas.UserRead.model_validate(user) for user in superadmins]


@app.post("/auth/select-god-user", response_model=schemas.AuthResponse)
def select_god_user(selection: schemas.GodUserSelectionRequest, db: Session = Depends(get_db)):
    """Select a super-admin to be the god user (only available when no god user exists)"""
    # Check if god user already exists
    existing_god_user = db.query(models.User).filter(models.User.is_god_user == True).first()
    if existing_god_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="God user already exists"
        )
    
    # Get the selected user
    user = db.get(models.User, selection.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify the user is a super-admin
    if not user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected user must be a super-admin"
        )
    
    # Set as god user
    user.is_god_user = True
    db.commit()
    db.refresh(user)
    
    # Create JWT token for the god user
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "token_version": user.token_version}, 
        db=db, 
        expires_delta=access_token_expires
    )
    
    return schemas.AuthResponse(
        access_token=access_token,
        user=schemas.UserRead.model_validate(user)
    )


# ---------- Password Reset Endpoints (Manual God User Approval) ---------- #

@app.post("/auth/password-reset/request", response_model=schemas.PasswordResetRequestResponse)
def request_password_reset(request_data: schemas.PasswordResetRequestCreate, db: Session = Depends(get_db)):
    """Submit a password reset request for manual approval by god user"""
    try:
        reset_request = create_password_reset_request(request_data.email, db)
        return schemas.PasswordResetRequestResponse(
            message="Password reset request submitted. A system administrator will review your request and contact you via email.",
            request_id=reset_request.id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit password reset request: {str(e)}"
        )


@app.get("/god/password-reset/requests", response_model=List[schemas.PasswordResetRequestRead])
def get_password_reset_requests(
    current_user: models.User = Depends(get_current_god_user), 
    db: Session = Depends(get_db)
):
    """Get all pending password reset requests (god user only)"""
    return get_pending_password_reset_requests(db)


@app.post("/god/password-reset/process/{request_id}", response_model=schemas.PasswordResetRequestRead)
def process_password_reset(
    request_id: int,
    process_data: schemas.PasswordResetRequestProcess,
    current_user: models.User = Depends(get_current_god_user),
    db: Session = Depends(get_db)
):
    """Process a password reset request - approve or reject (god user only)"""
    try:
        processed_request = process_password_reset_request(
            request_id=request_id,
            action=process_data.action,
            god_user=current_user,
            db=db,
            new_password=process_data.new_password,
            notes=process_data.notes
        )
        return schemas.PasswordResetRequestRead.model_validate(processed_request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process password reset request: {str(e)}"
        )


@app.get("/god/password-reset/ledger", response_model=List[schemas.PasswordResetRequestRead])
def get_password_reset_ledger(
    current_user: models.User = Depends(get_current_god_user), 
    db: Session = Depends(get_db)
):
    """Get all password reset requests (pending and processed) for audit ledger (god user only)"""
    return get_all_password_reset_requests(db)


# ---------- Alerts System ---------- #

@app.get("/alerts")
def get_alerts(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all alerts for the current user"""
    return generate_alerts(current_user, db)


@app.post("/alerts/{alert_id}/dismiss")
def dismiss_alert(alert_id: str, current_user: models.User = Depends(get_current_user)):
    """Dismiss an alert (placeholder - in production you'd store dismissals in DB)"""
    # For now, this is just a placeholder endpoint
    # In a full implementation, you'd store alert dismissals in a database table
    return {"status": "dismissed", "alert_id": alert_id}


# ---------- User Management (Admin Only) ---------- #

@app.get("/users", response_model=List[schemas.UserRead])
def list_users(db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """List all users (admin only) - filtered by team"""
    if admin_user.is_god_user:
        # God user sees all users
        return db.query(models.User).all()
    elif admin_user.is_superadmin:
        # Super-admin sees self and their team members
        return db.query(models.User).filter(
            (models.User.id == admin_user.id) | 
            (models.User.created_by_user_id == admin_user.id)
        ).all()
    else:
        # Regular admin sees only users in their team
        owner_id = admin_user.created_by_user_id
        return db.query(models.User).filter(
            (models.User.id == owner_id) |  # The super-admin
            (models.User.created_by_user_id == owner_id)  # Other team members
        ).all()


@app.post("/users", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def create_user_admin(user_data: schemas.UserCreate, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Create a new user (admin only)"""
    try:
        # Prevent non-superadmin from creating superadmin users
        if user_data.is_superadmin and not admin_user.is_superadmin:
            raise HTTPException(status_code=403, detail="Only superadmin can create superadmin users")
        
        # Determine created_by_user_id
        # - For super-admins: None (they are independent)
        # - For regular users created by super-admin: super-admin's id
        # - For regular users created by team member: inherit the team member's owner_id
        created_by_user_id = None
        if not user_data.is_superadmin:  # Only set created_by for non-superadmins
            if admin_user.is_superadmin:
                created_by_user_id = admin_user.id
            else:
                # Team member creating another user - inherit the same super-admin
                created_by_user_id = admin_user.created_by_user_id
        
        user = create_user(
            user_data.email, 
            user_data.password, 
            user_data.name, 
            db, 
            user_data.is_admin, 
            user_data.is_superadmin,
            created_by_user_id
        )
        return schemas.UserRead.model_validate(user)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User creation failed: {str(e)}"
        )


@app.patch("/users/{user_id}", response_model=schemas.UserRead)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Update a user (admin only)"""
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent modification of superadmin by non-superadmin users
    if user.is_superadmin and not admin_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Cannot modify superadmin user")
    
    # Prevent superadmin from modifying themselves (except superadmin can change their own password)
    if user.is_superadmin and user.id == admin_user.id:
        # Only allow password changes for superadmin self-modification
        update_data = user_update.model_dump(exclude_unset=True)
        allowed_fields = {"password"}
        forbidden_fields = set(update_data.keys()) - allowed_fields
        if forbidden_fields:
            raise HTTPException(status_code=403, detail="Superadmin can only change their own password")
    
    # Get update data, excluding unset fields
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Handle password hashing if password is being updated
    credentials_changed = False
    if "password" in update_data and update_data["password"]:
        from .auth import get_password_hash
        update_data["hashed_password"] = get_password_hash(update_data["password"])
        del update_data["password"]
        credentials_changed = True
    
    # Check if email is being changed and if it's already taken
    if "email" in update_data and update_data["email"] != user.email:
        existing_user = db.query(models.User).filter(models.User.email == update_data["email"]).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        credentials_changed = True
    
    # Prevent admin from removing their own admin privileges
    if user.id == admin_user.id and "is_admin" in update_data and not update_data["is_admin"]:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin privileges")
    
    # Prevent non-superadmin from granting superadmin privileges
    if "is_superadmin" in update_data and update_data["is_superadmin"] and not admin_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmin can grant superadmin privileges")
    
    # Apply updates
    for field, value in update_data.items():
        setattr(user, field, value)
    
    # Increment token version if credentials were changed to invalidate existing tokens
    if credentials_changed:
        user.token_version += 1
    
    db.commit()
    db.refresh(user)
    return schemas.UserRead.model_validate(user)


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Delete a user (admin only)"""
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deletion of superadmin
    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Cannot delete superadmin user")
    
    # Prevent admin from deleting themselves
    if user.id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    db.delete(user)
    db.commit()
    return


@app.put("/users/me", response_model=schemas.UserRead)
def update_current_user(
    user_data: schemas.UserSelfUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Allow users to update their own profile"""
    from .auth import get_password_hash
    
    # Re-query the user in the same session to ensure we can update it
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields if provided
    credentials_changed = False
    
    if user_data.email is not None and user_data.email != user.email:
        # Check if email is already taken
        existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = user_data.email
        credentials_changed = True
        
    if user_data.name is not None:
        user.name = user_data.name
        
    if user_data.password is not None:
        user.hashed_password = get_password_hash(user_data.password)
        credentials_changed = True
    
    # Increment token version if credentials were changed
    if credentials_changed:
        user.token_version += 1
    
    db.commit()
    db.refresh(user)
    return schemas.UserRead.model_validate(user)


# Helper function to check if a filament with given properties already exists
def _get_or_create_filament(db: Session, color: str, brand: str, material: str) -> models.Filament:
    """Get an existing filament or create a new one if it doesn't exist."""
    # Check if filament already exists
    existing_filament = db.query(models.Filament).filter(
        models.Filament.color == color,
        models.Filament.brand == brand,
        models.Filament.material == material
    ).first()
    
    if existing_filament:
        return existing_filament
    
    # Create new filament
    new_filament = models.Filament(
        color=color,
        brand=brand,
        material=material,
        price_per_kg=0.0,  # Will be updated when purchases are added
        total_qty_kg=0.0   # Will be updated when purchases are added
    )
    db.add(new_filament)
    db.flush()  # Flush to get the ID without committing
    return new_filament

@app.post("/products/upload/{product_id}", response_model=schemas.ProductRead)
async def upload_product_file(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Upload a file for an existing product."""
    # Get the product
    db_product = db.get(models.Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Validate file extension
    if not file.filename.lower().endswith(('.stl', '.3mf')):
        raise HTTPException(
            status_code=400,
            detail="Only STL and 3MF files are supported"
        )
    
    # Save the file
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{db_product.sku}_{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Update product with file path
    db_product.file_path = f"uploads/product_models/{unique_filename}"
    db.commit()
    db.refresh(db_product)
    
    return db_product


# ---------- Filament Helpers ---------- #

def check_existing_filament(db: Session, color: str, brand: str, material: str, current_user: Optional[models.User] = None) -> Optional[models.Filament]:
    """Check if a filament with the same color, brand, and material already exists (case-insensitive)."""
    from sqlalchemy import func
    
    color_normalized = color.strip().lower()
    brand_normalized = brand.strip().lower()
    material_normalized = material.strip()
    
    query = db.query(models.Filament).filter(
        func.lower(func.trim(models.Filament.color)) == color_normalized,
        func.lower(func.trim(models.Filament.brand)) == brand_normalized,
        func.trim(models.Filament.material) == material_normalized
    )
    
    # Filter by owner for multi-tenancy
    if current_user:
        owner_id = get_owner_id(current_user)
        if owner_id is not None:
            query = query.filter(models.Filament.owner_id == owner_id)
    
    return query.first()


# ---------- Filaments ---------- #

@app.post("/filaments", response_model=schemas.FilamentRead, status_code=status.HTTP_201_CREATED)
def create_filament(filament: schemas.FilamentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create a new filament type (any authenticated user can create filament types)"""
    db_filament = models.Filament(**filament.model_dump())
    db_filament.owner_id = get_owner_id(current_user)
    db.add(db_filament)
    db.commit()
    db.refresh(db_filament)
    return db_filament


@app.get("/filaments", response_model=list[schemas.FilamentRead])
def list_filaments(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """List all filament types (filtered by owner for multi-tenancy)"""
    owner_id = get_owner_id(current_user)
    query = db.query(models.Filament)
    if owner_id is not None:
        query = query.filter(models.Filament.owner_id == owner_id)
    return query.all()


@app.get("/filaments/{filament_id}", response_model=schemas.FilamentRead)
def get_filament(filament_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    filament = db.get(models.Filament, filament_id)
    if not filament:
        raise HTTPException(status_code=404, detail="Filament not found")
    
    # Check ownership
    owner_id = get_owner_id(current_user)
    if owner_id is not None and filament.owner_id != owner_id:
        raise HTTPException(status_code=404, detail="Filament not found")
    
    return filament


@app.delete("/filaments/{filament_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_filament(filament_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a filament type (any authenticated user can delete filament types)"""
    filament = db.get(models.Filament, filament_id)
    if not filament:
        raise HTTPException(status_code=404, detail="Filament not found")
    
    # Check if filament has inventory
    if filament.total_qty_kg > 0:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete filament type with existing inventory. Use up or transfer the inventory first."
        )
    
    # Check if filament is used in any products
    filament_usages = db.query(models.FilamentUsage).filter(models.FilamentUsage.filament_id == filament_id).first()
    
    if filament_usages:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete filament type that is used in products. Remove it from all products first."
        )
    
    db.delete(filament)
    db.commit()
    return


@app.patch("/filaments/{filament_id}", response_model=schemas.FilamentRead)
def update_filament(filament_id: int, filament_update: schemas.FilamentUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    filament = db.get(models.Filament, filament_id)
    if not filament:
        raise HTTPException(status_code=404, detail="Filament not found")
    
    update_data = filament_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(filament, field, value)
    
    db.commit()
    db.refresh(filament)
    return filament


@app.post("/filaments/create-flexible", response_model=schemas.FilamentFlexibleResponse)
def create_filament_flexible(
    filament_data: schemas.FilamentFlexibleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Create a new filament type with optional initial inventory.
    Any authenticated user can create filament types.
    """
    from sqlalchemy.exc import IntegrityError, SQLAlchemyError
    from datetime import date
    
    try:
        # Check for existing filament first (case-insensitive)
        existing_filament = check_existing_filament(
            db, filament_data.color, filament_data.brand, filament_data.material, current_user
        )
        
        if existing_filament:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Filament already exists",
                    "existing_filament": schemas.FilamentRead.model_validate(existing_filament).model_dump()
                }
            )
        
        # Start transaction - SQLAlchemy session is transactional by default
        # Create filament (store with original case but trimmed)
        db_filament = models.Filament(
            color=filament_data.color.strip(),
            brand=filament_data.brand.strip(),
            material=filament_data.material.strip(),
            price_per_kg=filament_data.estimated_cost_per_kg,  # Use estimated cost initially
            total_qty_kg=0.0,  # No inventory by default
            min_filaments_kg=None,  # User can set this later
            owner_id=get_owner_id(current_user)  # Set owner for multi-tenancy
        )
        
        warnings = []
        db_purchase = None
        
        # Optionally create purchase
        if filament_data.create_purchase and filament_data.purchase_data:
            # Update filament with actual purchase data
            db_filament.price_per_kg = filament_data.purchase_data.price_per_kg
            db_filament.total_qty_kg = filament_data.purchase_data.quantity_kg
            
            db.add(db_filament)
            db.flush()  # Flush to get the ID without committing
            
            # Create purchase record
            db_purchase = models.FilamentPurchase(
                filament_id=db_filament.id,
                quantity_kg=filament_data.purchase_data.quantity_kg,
                price_per_kg=filament_data.purchase_data.price_per_kg,
                purchase_date=filament_data.purchase_data.purchase_date or date.today(),
                channel=filament_data.purchase_data.purchase_channel,
                notes=filament_data.purchase_data.notes,
                owner_id=get_owner_id(current_user)  # Set owner for multi-tenancy
            )
            db.add(db_purchase)
        else:
            # No purchase - just create the filament type
            db.add(db_filament)
            warnings.append("No inventory tracked for this filament")
        
        # Commit transaction
        db.commit()
        db.refresh(db_filament)
        
        # Prepare response
        response = schemas.FilamentFlexibleResponse(
            filament=schemas.FilamentRead.model_validate(db_filament),
            warnings=warnings
        )
        
        if db_purchase:
            db.refresh(db_purchase)
            response.purchase = schemas.FilamentPurchaseRead.model_validate(db_purchase)
            
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error: {str(e)}")
        raise HTTPException(
            status_code=409,
            detail="A database constraint was violated. This filament may already exist."
        )
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="A database error occurred while creating the filament."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )


@app.get("/filaments/statistics", response_model=list[schemas.FilamentStatistics])
def get_filament_statistics(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get statistics for all filament types (any authenticated user can view statistics)"""
    # Get all filaments with their usages
    filaments = db.query(models.Filament).all()
    
    statistics = []
    for filament in filaments:
        # Count products using this filament
        products_using = db.query(models.Product).join(models.FilamentUsage).filter(
            models.FilamentUsage.filament_id == filament.id
        ).distinct().count()
        
        # Count purchases
        purchases_count = db.query(models.FilamentPurchase).filter(
            models.FilamentPurchase.filament_id == filament.id
        ).count()
        
        statistics.append(schemas.FilamentStatistics(
            filament=schemas.FilamentRead.model_validate(filament),
            products_using=products_using,
            purchases_count=purchases_count
        ))
    
    return statistics


# ---------- Filament Purchases ---------- #

@app.post("/filament_purchases", response_model=schemas.FilamentPurchaseRead, status_code=status.HTTP_201_CREATED)
def create_filament_purchase(purchase: schemas.FilamentPurchaseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Record a new filament purchase (any authenticated user can record purchases)"""
    # Verify filament exists
    filament = db.get(models.Filament, purchase.filament_id)
    if not filament:
        raise HTTPException(status_code=404, detail="Filament not found")
    
    # Create purchase record
    db_purchase = models.FilamentPurchase(**purchase.model_dump())
    db.add(db_purchase)
    
    # Update filament inventory and weighted average price
    old_total_value = filament.total_qty_kg * filament.price_per_kg
    new_value = purchase.quantity_kg * purchase.price_per_kg
    new_total_qty = filament.total_qty_kg + purchase.quantity_kg
    
    if new_total_qty > 0:
        filament.price_per_kg = (old_total_value + new_value) / new_total_qty
    filament.total_qty_kg = new_total_qty
    
    db.commit()
    db.refresh(db_purchase)
    return db_purchase


@app.get("/filament_purchases", response_model=list[schemas.FilamentPurchaseRead])
def list_filament_purchases(
    skip: int = 0,
    limit: int = 100,
    filament_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all filament purchases with optional filtering (any authenticated user can view purchases)"""
    query = db.query(models.FilamentPurchase)
    
    if filament_id:
        query = query.filter(models.FilamentPurchase.filament_id == filament_id)
    
    purchases = query.order_by(models.FilamentPurchase.purchase_date.desc()).offset(skip).limit(limit).all()
    return purchases


@app.patch("/filament_purchases/{purchase_id}", response_model=schemas.FilamentPurchaseRead)
def update_filament_purchase(
    purchase_id: int,
    purchase_update: schemas.FilamentPurchaseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a filament purchase record (any authenticated user can update purchases)"""
    purchase = db.get(models.FilamentPurchase, purchase_id)
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    # Note: This simplified version doesn't recalculate weighted average prices
    # In production, you might want to track the original values and adjust accordingly
    
    update_data = purchase_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(purchase, field, value)
    
    db.commit()
    db.refresh(purchase)
    return purchase


@app.get("/filament_purchases/export")
def export_filament_purchases(
    format: str = "csv",
    filament_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Export filament purchases in CSV or JSON format (any authenticated user can export)"""
    query = db.query(models.FilamentPurchase)
    
    if filament_id:
        query = query.filter(models.FilamentPurchase.filament_id == filament_id)
    
    purchases = query.order_by(models.FilamentPurchase.purchase_date.desc()).all()
    
    if format == "json":
        return [
            {
                "id": p.id,
                "filament_id": p.filament_id,
                "quantity_kg": p.quantity_kg,
                "price_per_kg": p.price_per_kg,
                "purchase_date": p.purchase_date.isoformat() if p.purchase_date else None,
                "channel": p.channel,
                "notes": p.notes
            }
            for p in purchases
        ]
    else:  # CSV format
        from fastapi.responses import StreamingResponse
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["ID", "Filament ID", "Quantity (kg)", "Price per kg", "Purchase Date", "Channel", "Notes"])
        
        # Write data
        for p in purchases:
            writer.writerow([
                p.id,
                p.filament_id,
                p.quantity_kg,
                p.price_per_kg,
                p.purchase_date.isoformat() if p.purchase_date else "",
                p.channel or "",
                p.notes or ""
            ])
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=filament_purchases.csv"}
        )


@app.delete("/filament_purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_filament_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a filament purchase and adjust inventory (any authenticated user can delete purchases)"""
    purchase = db.get(models.FilamentPurchase, purchase_id)
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    # Get the associated filament
    filament = db.get(models.Filament, purchase.filament_id)
    if filament:
        # Reduce inventory
        filament.total_qty_kg = max(0, filament.total_qty_kg - purchase.quantity_kg)
        
        # Note: We don't adjust the weighted average price when deleting
        # This is a simplification - in production you might want to track this differently
    
    db.delete(purchase)
    db.commit()
    return


# ---------- Products ---------- #

@app.post("/products", response_model=schemas.ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    request: Request,
    name: str = Form(...),
    print_time: str = Form(...),  # HH:MM:SS or MM:SS format
    filament_ids: str = Form(None),  # JSON string of filament IDs
    grams_used_list: str = Form(None),  # JSON string of grams used
    additional_parts_cost: float = Form(0.0),
    license_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    sku: str = Form(None),  # Optional SKU, will auto-generate if not provided
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new product with filament usage"""
    # Parse time string
    total_seconds = parse_time_from_form(print_time)
    print_time_hrs = total_seconds / 3600
    
    # Auto-generate SKU if not provided
    if not sku:
        # Generate SKU based on name + timestamp
        import time
        base_sku = "".join(c.upper() for c in name if c.isalnum())[:8]
        timestamp = str(int(time.time()))[-6:]  # Last 6 digits of timestamp
        sku = f"{base_sku}-{timestamp}"
        
        # Ensure uniqueness
        counter = 1
        original_sku = sku
        while db.query(models.Product).filter(models.Product.sku == sku).first():
            sku = f"{original_sku}-{counter}"
            counter += 1
    
    # Create product
    db_product = models.Product(
        sku=sku,
        name=name,
        print_time_hrs=print_time_hrs,
        additional_parts_cost=additional_parts_cost,
        license_id=license_id if license_id else None,
        owner_id=current_user.owner_id
    )
    
    # Handle file upload if provided
    if file:
        if not file.filename.lower().endswith(('.stl', '.3mf')):
            raise HTTPException(
                status_code=400,
                detail="Only STL and 3MF files are supported"
            )
        
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{sku}_{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            db_product.file_path = f"uploads/product_models/{unique_filename}"
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save file: {str(e)}"
            )
    
    db.add(db_product)
    db.flush()  # Get the product ID
    
    # Add filament usages
    if filament_ids and grams_used_list:
        try:
            filament_ids_parsed = json.loads(filament_ids)
            grams_used_parsed = json.loads(grams_used_list)
            
            for fid, grams in zip(filament_ids_parsed, grams_used_parsed):
                if fid and grams:
                    usage = models.FilamentUsage(
                        product_id=db_product.id,
                        filament_id=fid,
                        grams_used=grams,
                        owner_id=current_user.owner_id
                    )
                    db.add(usage)
        except json.JSONDecodeError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Invalid JSON in filament data: {str(e)}")
    
    db.commit()
    db.refresh(db_product)
    
    # Track product creation activity
    log_user_activity(
        db=db,
        user=current_user,
        activity_type="create_product",
        request=request,
        metadata={
            "product_id": db_product.id,
            "product_name": db_product.name,
            "sku": db_product.sku
        }
    )
    
    return db_product


@app.get("/products", response_model=list[schemas.ProductRead])
def list_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """List all products (any authenticated user can view products)"""
    products = db.query(models.Product).order_by(models.Product.id.desc()).offset(skip).limit(limit).all()
    return products


@app.get("/products/{product_id}", response_model=schemas.ProductRead)
def get_product(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    product = db.query(models.Product).options(
        joinedload(models.Product.filament_usages).joinedload(models.FilamentUsage.filament)
    ).filter(models.Product.id == product_id).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.patch("/products/{product_id}", response_model=schemas.ProductRead)
def update_product(product_id: int, product_update: schemas.ProductUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_update.model_dump(exclude_unset=True)
    
    # Handle print_time conversion if provided
    if "print_time" in update_data and update_data["print_time"]:
        total_seconds = parse_time_from_form(update_data["print_time"])
        update_data["print_time_hrs"] = total_seconds / 3600
        del update_data["print_time"]
    
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.commit()
    
    # Reload product with relationships for proper COP calculation
    product = db.query(models.Product).options(
        joinedload(models.Product.filament_usages).joinedload(models.FilamentUsage.filament)
    ).filter(models.Product.id == product_id).first()
    
    return product


@app.put("/products/{product_id}", response_model=schemas.ProductRead)
def update_product_full(
    product_id: int,
    name: str = Form(...),
    print_time: str = Form(...),  # HH:MM:SS or MM:SS format
    filament_ids: str = Form(None),  # JSON string of filament IDs
    grams_used_list: str = Form(None),  # JSON string of grams used
    additional_parts_cost: float = Form(0.0),
    license_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    sku: str = Form(None),  # Optional SKU for updates
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a product with its filament usage"""
    # Get existing product
    db_product = db.get(models.Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Parse time string
    total_seconds = parse_time_from_form(print_time)
    print_time_hrs = total_seconds / 3600
    
    # Update basic product info
    if sku:  # Only update SKU if provided
        db_product.sku = sku
    db_product.name = name
    db_product.print_time_hrs = print_time_hrs
    db_product.additional_parts_cost = additional_parts_cost
    db_product.license_id = license_id if license_id else None
    
    # Handle file upload if provided
    if file:
        if not file.filename.lower().endswith(('.stl', '.3mf')):
            raise HTTPException(
                status_code=400,
                detail="Only STL and 3MF files are supported"
            )
        
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{sku}_{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            db_product.file_path = f"uploads/product_models/{unique_filename}"
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save file: {str(e)}"
            )
    
    # Delete existing filament usages and create new ones
    db.query(models.FilamentUsage).filter(models.FilamentUsage.product_id == product_id).delete()
    
    if filament_ids and grams_used_list:
        try:
            filament_ids_parsed = json.loads(filament_ids)
            grams_used_parsed = json.loads(grams_used_list)
            
            for fid, grams in zip(filament_ids_parsed, grams_used_parsed):
                if fid and grams:
                    usage = models.FilamentUsage(
                        product_id=db_product.id,
                        filament_id=fid,
                        grams_used=grams,
                        owner_id=current_user.owner_id
                    )
                    db.add(usage)
        except json.JSONDecodeError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Invalid JSON in filament data: {str(e)}")
    
    db.commit()
    db.refresh(db_product)
    return db_product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a product (any authenticated user can delete products)"""
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if product is used in any print jobs
    product_in_jobs = db.query(models.PrintJobProduct).filter(
        models.PrintJobProduct.product_id == product_id
    ).first()
    
    if product_in_jobs:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete product that has been used in print jobs. Archive it instead."
        )
    
    # Delete associated file if exists
    if product.file_path:
        file_full_path = os.path.join(os.getcwd(), product.file_path)
        if os.path.exists(file_full_path):
            try:
                os.remove(file_full_path)
            except Exception as e:
                logger.warning(f"Failed to delete file {file_full_path}: {str(e)}")
    
    db.delete(product)
    db.commit()
    return



# ---------- Subscriptions ---------- #

@app.post("/subscriptions", response_model=schemas.SubscriptionRead, status_code=status.HTTP_201_CREATED)
def create_subscription(subscription: schemas.SubscriptionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create a new subscription/license (any authenticated user can create subscriptions)"""
    db_subscription = models.Subscription(**subscription.model_dump())
    db.add(db_subscription)
    db.commit()
    db.refresh(db_subscription)
    return db_subscription


@app.get("/subscriptions", response_model=list[schemas.SubscriptionRead])
def list_subscriptions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """List all subscriptions (any authenticated user can view subscriptions)"""
    subscriptions = db.query(models.Subscription).offset(skip).limit(limit).all()
    return subscriptions


@app.put("/subscriptions/{subscription_id}", response_model=schemas.SubscriptionRead)
def update_subscription(
    subscription_id: int,
    subscription_update: schemas.SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a subscription"""
    subscription = db.get(models.Subscription, subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    update_data = subscription_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subscription, field, value)
    
    db.commit()
    db.refresh(subscription)
    return subscription


@app.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscription(subscription_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a subscription (any authenticated user can delete subscriptions)"""
    subscription = db.get(models.Subscription, subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(subscription)
    db.commit()
    return


# ---------- Printer Profiles ---------- #

@app.post("/printer_profiles", response_model=schemas.PrinterProfileRead, status_code=status.HTTP_201_CREATED)
def create_printer_profile(printer: schemas.PrinterProfileCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create a new printer profile (any authenticated user can create printer profiles)"""
    db_printer = models.PrinterProfile(**printer.model_dump())
    db.add(db_printer)
    db.commit()
    db.refresh(db_printer)
    return db_printer


@app.get("/printer_profiles", response_model=list[schemas.PrinterProfileRead])
def list_printer_profiles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """List all printer profiles (any authenticated user can view printer profiles)"""
    printers = db.query(models.PrinterProfile).offset(skip).limit(limit).all()
    return printers


@app.get("/printer_profiles/{printer_id}", response_model=schemas.PrinterProfileRead)
def get_printer_profile(printer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get a specific printer profile"""
    printer = db.get(models.PrinterProfile, printer_id)
    if not printer:
        raise HTTPException(status_code=404, detail="Printer profile not found")
    return printer
@app.get("/printer_profiles/{profile_id}", response_model=schemas.PrinterProfileRead)
def get_printer_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    prof = db.get(models.PrinterProfile, profile_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Printer profile not found")
    return prof


@app.delete("/printer_profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_printer_profile(profile_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    prof = db.get(models.PrinterProfile, profile_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # No longer check if in use - printer data is stored in print jobs
    db.delete(prof)
    db.commit()
    return


@app.put("/printer_profiles/{printer_id}", response_model=schemas.PrinterProfileRead)
def update_printer_profile(
    printer_id: int,
    printer_update: schemas.PrinterProfileUpdate,
    profile_id: int,
    profile_update: schemas.PrinterProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a printer profile"""
    printer = db.get(models.PrinterProfile, printer_id)
    if not printer:
        raise HTTPException(status_code=404, detail="Printer profile not found")
    
    update_data = printer_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(printer, field, value)
    # Update fields
    if profile_update.name is not None:
        prof.name = profile_update.name
    if profile_update.manufacturer is not None:
        prof.manufacturer = profile_update.manufacturer
    if profile_update.model is not None:
        prof.model = profile_update.model
    if profile_update.price_eur is not None:
        prof.price_eur = profile_update.price_eur
    if profile_update.expected_life_hours is not None:
        prof.expected_life_hours = profile_update.expected_life_hours
    if profile_update.working_hours is not None:
        prof.working_hours = profile_update.working_hours
    
    db.commit()
    db.refresh(printer)
    return printer


@app.get("/printer_profiles/{profile_id}/usage_stats", response_model=schemas.PrinterUsageStatsResponse)
def get_printer_usage_stats(
    profile_id: int,
    period: str = "month",  # week, month, or quarter
    count: int = 12,  # How many periods to return
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get printer usage statistics for specified period"""
    printer = db.get(models.PrinterProfile, profile_id)
    if not printer:
        raise HTTPException(status_code=404, detail="Printer profile not found")
    
    # Validate period
    if period not in ["week", "month", "quarter"]:
        raise HTTPException(status_code=400, detail="Period must be 'week', 'month', or 'quarter'")
    
    # Determine the period column and format
    now = datetime.now()
    stats = []
    
    if period == "week":
        # Get weekly stats
        current_week = int(now.strftime("%Y%V"))
        for i in range(count):
            week_date = now - timedelta(weeks=i)
            week_key = int(week_date.strftime("%Y%V"))
            
            # Query usage for this week
            usage = db.query(
                func.sum(models.PrinterUsageHistory.hours_used).label("total_hours"),
                func.count(models.PrinterUsageHistory.id).label("print_count")
            ).filter(
                models.PrinterUsageHistory.printer_profile_id == profile_id,
                models.PrinterUsageHistory.week_year == week_key
            ).first()
            
            stats.append(schemas.PrinterUsageStats(
                period="week",
                period_key=week_key,
                period_label=f"Week {week_date.strftime('%V')}, {week_date.year}",
                hours_used=usage.total_hours or 0.0,
                print_count=usage.print_count or 0
            ))
    
    elif period == "month":
        # Get monthly stats
        for i in range(count):
            month_date = now - timedelta(days=30*i)  # Approximate
            month_key = int(month_date.strftime("%Y%m"))
            
            # Query usage for this month
            usage = db.query(
                func.sum(models.PrinterUsageHistory.hours_used).label("total_hours"),
                func.count(models.PrinterUsageHistory.id).label("print_count")
            ).filter(
                models.PrinterUsageHistory.printer_profile_id == profile_id,
                models.PrinterUsageHistory.month_year == month_key
            ).first()
            
            stats.append(schemas.PrinterUsageStats(
                period="month",
                period_key=month_key,
                period_label=month_date.strftime("%B %Y"),
                hours_used=usage.total_hours or 0.0,
                print_count=usage.print_count or 0
            ))
    
    else:  # quarter
        # Get quarterly stats
        for i in range(count):
            quarter_offset = (now.month - 1) // 3 - i
            year_offset = quarter_offset // 4
            quarter_num = (quarter_offset % 4) + 1
            year = now.year + year_offset
            quarter_key = int(f"{year}{quarter_num}")
            
            # Query usage for this quarter
            usage = db.query(
                func.sum(models.PrinterUsageHistory.hours_used).label("total_hours"),
                func.count(models.PrinterUsageHistory.id).label("print_count")
            ).filter(
                models.PrinterUsageHistory.printer_profile_id == profile_id,
                models.PrinterUsageHistory.quarter_year == quarter_key
            ).first()
            
            stats.append(schemas.PrinterUsageStats(
                period="quarter",
                period_key=quarter_key,
                period_label=f"Q{quarter_num} {year}",
                hours_used=usage.total_hours or 0.0,
                print_count=usage.print_count or 0
            ))
    
    # Reverse to have oldest first
    stats.reverse()
    
    return schemas.PrinterUsageStatsResponse(
        printer_id=printer.id,
        printer_name=printer.name,
        stats=stats,
        total_working_hours=printer.working_hours,
        life_left_hours=printer.life_left_hours,
        life_percentage=printer.life_percentage
    )


# Utility SKU generator

def _generate_sku(name: str, db: Session) -> str:
    base = "".join(ch for ch in name.upper() if ch.isalnum())[:3]
    from datetime import date
    today = date.today().strftime("%y%m%d")
    seq = 1
    while True:
        sku = f"{base}-{today}-{seq:03d}"
        if not db.query(models.Product).filter_by(sku=sku).first():
            return sku
        seq += 1


# ---------- Private helper functions for print jobs ---------- #

def _generate_sku(product_name: str, db: Session) -> str:
    """Generate a unique SKU for a product based on name and date."""
    import re
    from datetime import datetime
    
    # Extract alphanumeric characters from product name and take first 3
    clean_name = re.sub(r'[^a-zA-Z0-9]', '', product_name.upper())
    prefix = clean_name[:3] if len(clean_name) >= 3 else clean_name
    
    # Handle case where no alphanumeric characters exist
    if not prefix:
        prefix = "PRD"  # Default prefix for products
    
    # Generate date part (YYMMDD format)
    today = datetime.now()
    date_part = today.strftime("%y%m%d")
    
    # Try to find a unique SKU by incrementing sequence number
    sequence = 1
    while True:
        sequence_str = f"{sequence:03d}"  # Zero-padded 3-digit sequence
        candidate_sku = f"{prefix}-{date_part}-{sequence_str}"
        
        # Check if this SKU already exists
        existing = db.query(models.Product).filter_by(sku=candidate_sku).first()
        if not existing:
            return candidate_sku
        
        sequence += 1
        # Safety check to prevent infinite loop
        if sequence > 999:
            # If we somehow reach 999 products with same prefix on same day,
            # add a random suffix
            import random
            random_suffix = random.randint(1000, 9999)
            return f"{prefix}-{date_part}-{random_suffix}"

def _calculate_print_job_cogs(job: models.PrintJob, db: Session) -> float:
    """Calculate COGS for a print job."""
    total_cogs = 0.0
    
    # Products cost
    for pjp in job.products:
        if pjp.product:
            total_cogs += pjp.product.cop * pjp.items_qty
    
    # Printers cost  
    for pjp in job.printers:
        # Use stored printer data if available
        if pjp.printer_price_eur is not None and pjp.printer_expected_life_hours is not None:
            if pjp.printer_expected_life_hours > 0:
                hourly_cost = pjp.printer_price_eur / pjp.printer_expected_life_hours
                total_cogs += hourly_cost * pjp.hours_each * pjp.printers_qty
        elif pjp.printer_profile:
            # Fallback to current printer profile if stored data not available
            if pjp.printer_profile.expected_life_hours > 0:
                hourly_cost = pjp.printer_profile.price_eur / pjp.printer_profile.expected_life_hours
                total_cogs += hourly_cost * pjp.hours_each * pjp.printers_qty
    
    # Packaging
    total_cogs += job.packaging_cost_eur
    
    return round(total_cogs, 2)


def _deduct_filament_for_print_job(job: models.PrintJob, db: Session) -> dict:
    """
    Deduct filament inventory for all products in a print job.
    Returns dict with success status and any errors.
    """
    errors = []
    filament_deductions = {}  # Track total deductions per filament
    
    # Calculate total filament needed across all products
    for pjp in job.products:
        product = pjp.product
        if not product:
            continue
            
        items_qty = pjp.items_qty
        
        # Use filament usages for this product
        for usage in product.filament_usages:
            filament_id = usage.filament_id
            grams_per_item = usage.grams_used
            total_grams = grams_per_item * items_qty
            
            if filament_id not in filament_deductions:
                filament_deductions[filament_id] = 0
            filament_deductions[filament_id] += total_grams
    
    # Check availability and deduct
    for filament_id, total_grams_needed in filament_deductions.items():
        filament = db.get(models.Filament, filament_id)
        if not filament:
            errors.append(f"Filament ID {filament_id} not found")
            continue
            
        kg_needed = total_grams_needed / 1000.0
        
        if filament.total_qty_kg < kg_needed:
            errors.append(
                f"{filament.color} {filament.brand} {filament.material}: "
                f"Need {kg_needed:.2f}kg but only have {filament.total_qty_kg:.2f}kg"
            )
        else:
            # Deduct inventory
            filament.total_qty_kg -= kg_needed
    
    if errors:
        return {"success": False, "errors": errors}
    
    return {"success": True, "errors": []}


def _return_filament_to_inventory(job: models.PrintJob, db: Session):
    """
    Return filament to inventory when a print job is deleted or modified.
    This reverses the deduction made when the job was created.
    """
    filament_returns = {}  # Track total returns per filament
    
    # Calculate total filament to return across all products
    for pjp in job.products:
        product = pjp.product
        if not product:
            continue
            
        items_qty = pjp.items_qty
        
        # Use filament usages for this product
        for usage in product.filament_usages:
            filament_id = usage.filament_id
            grams_per_item = usage.grams_used
            total_grams = grams_per_item * items_qty
            
            if filament_id not in filament_returns:
                filament_returns[filament_id] = 0
            filament_returns[filament_id] += total_grams
    
    # Return filament to inventory
    for filament_id, total_grams_return in filament_returns.items():
        filament = db.get(models.Filament, filament_id)
        if filament:
            kg_return = total_grams_return / 1000.0
            filament.total_qty_kg += kg_return


# ---------- Print Jobs ---------- #

@app.post("/print_jobs", response_model=schemas.PrintJobRead, status_code=status.HTTP_201_CREATED)
def create_print_job(job: schemas.PrintJobCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Create base job
    db_job = models.PrintJob(
        name=job.name,
        packaging_cost_eur=job.packaging_cost_eur,
        status=job.status
    )
    db.add(db_job)
    db.flush()  # Get the ID without committing
    
    # Add products
    for product_data in job.products:
        # Verify product exists
        product = db.get(models.Product, product_data.product_id)
        if not product:
            db.rollback()
            raise HTTPException(
                status_code=400, 
                detail=f"Product with ID {product_data.product_id} not found"
            )
    
    # add associations
    assoc_products = [models.PrintJobProduct(print_job_id=db_job.id, product_id=it.product_id, items_qty=it.items_qty) for it in job.products]
    
    # Calculate total print time for all products
    total_print_hours = 0.0
    for product_data in job.products:
        product = db.get(models.Product, product_data.product_id)
        if product:
            total_print_hours += product.print_time_hrs * product_data.items_qty
    
    # Create printer associations with stored printer data
    assoc_printers = []
    usage_history_records = []
    for printer_item in job.printers:
        # Look up printer profile to copy its data
        printer_profile = db.get(models.PrinterProfile, printer_item.printer_profile_id)
        if printer_profile:
            printer_assoc = models.PrintJobPrinter(
                print_job_id=db_job.id,
                printer_profile_id=printer_item.printer_profile_id,
                printers_qty=printer_item.printers_qty,
                hours_each=total_print_hours,  # Use calculated total print hours
                # Store printer data at time of job creation
                printer_name=printer_profile.name,
                printer_manufacturer=printer_profile.manufacturer,
                printer_model=printer_profile.model,
                printer_price_eur=printer_profile.price_eur,
                printer_expected_life_hours=printer_profile.expected_life_hours
            )
            assoc_printers.append(printer_assoc)
            
            # Update printer working hours
            total_hours_used = total_print_hours * printer_item.printers_qty
            printer_profile.working_hours = (printer_profile.working_hours or 0) + total_hours_used
            
            # Create usage history record
            now = datetime.now()
            week_year = int(now.strftime("%Y%V"))  # Use %V for ISO week number
            month_year = int(now.strftime("%Y%m"))
            quarter_year = int(f"{now.year}{(now.month-1)//3 + 1}")
            
            usage_history = models.PrinterUsageHistory(
                printer_profile_id=printer_item.printer_profile_id,
                print_job_id=db_job.id,
                hours_used=printer_item.hours_each,
                printers_qty=printer_item.printers_qty,
                week_year=week_year,
                month_year=month_year,
                quarter_year=quarter_year
            )
            usage_history_records.append(usage_history)
        else:
            # Handle case where printer profile doesn't exist
            logger.warning(f"Printer profile {printer_item.printer_profile_id} not found when creating print job")
            printer_assoc = models.PrintJobPrinter(
                print_job_id=db_job.id,
                printer_profile_id=printer_item.printer_profile_id,
                printers_qty=printer_item.printers_qty,
                hours_each=total_print_hours  # Use calculated total print hours
            )
            assoc_printers.append(printer_assoc)
    db.add_all(assoc_products + assoc_printers + usage_history_records)
    db.flush()  # This makes the associations available without committing
    
    # Deduct filament inventory
    filament_result = _deduct_filament_for_print_job(db_job, db)
    if not filament_result["success"]:
        # Roll back the transaction if insufficient inventory
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Insufficient filament inventory for print job",
                "errors": filament_result["errors"]
            }
        )
    
    # Now we can commit the transaction
    db.commit()
    db.refresh(db_job)
    
    # Calculate COGS
    db_job.calculated_cogs_eur = _calculate_print_job_cogs(db_job, db)
    db.commit()
    db.refresh(db_job)
    
    # Track print job creation activity
    log_user_activity(
        db=db,
        user=current_user,
        activity_type="create_print_job",
        request=request,
        metadata={
            "print_job_id": str(db_job.id),
            "print_job_name": db_job.name,
            "status": db_job.status,
            "products_count": len(job.products),
            "printers_count": len(job.printers)
        }
    )
    
    return db_job

@app.get("/print_jobs", response_model=List[schemas.PrintJobRead])
def list_print_jobs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    jobs = db.query(models.PrintJob).options(
        joinedload(models.PrintJob.products).joinedload(models.PrintJobProduct.product),
        joinedload(models.PrintJob.printers).joinedload(models.PrintJobPrinter.printer_profile)
    ).order_by(models.PrintJob.created_at.desc()).offset(skip).limit(limit).all()
    return jobs

@app.get("/print_jobs/{print_job_id}", response_model=schemas.PrintJobRead)
def get_print_job(print_job_id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    job = db.query(models.PrintJob).options(joinedload(models.PrintJob.products), joinedload(models.PrintJob.printers)).filter(models.PrintJob.id == print_job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Print Job with ID {print_job_id} not found")
    return job

@app.delete("/print_jobs/{print_job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_print_job(print_job_id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a print job and return used filament to inventory."""
    # Get the job with its product associations
    job = db.query(models.PrintJob).options(
        joinedload(models.PrintJob.products).joinedload(models.PrintJobProduct.product)
    ).filter(models.PrintJob.id == print_job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Print Job with ID {print_job_id} not found"
        )
    
    # Return filament to inventory before deleting
    _return_filament_to_inventory(job, db)
    
    # Delete the job (cascades to PrintJobProduct and PrintJobPrinter)
    db.delete(job)
    db.commit()
    return

@app.patch("/print_jobs/{print_job_id}/status", response_model=schemas.PrintJobRead)
def update_print_job_status(print_job_id: uuid.UUID, status_update: schemas.PrintJobStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Update the status of a print job."""
    job = db.get(models.PrintJob, print_job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Print Job with ID {print_job_id} not found")
    
    job.status = status_update.status
    db.commit()
    db.refresh(job)
    return job


@app.put("/print_jobs/{print_job_id}/start", response_model=schemas.PrintJobRead)
def start_print_job(print_job_id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Start a print job by moving it from pending to printing status."""
    # Get the job with all relationships
    job = db.query(models.PrintJob).options(
        joinedload(models.PrintJob.products).joinedload(models.PrintJobProduct.product),
        joinedload(models.PrintJob.printers)
    ).filter(models.PrintJob.id == print_job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Print Job with ID {print_job_id} not found"
        )
    
    # Check if job is already printing or completed
    if job.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start job with status '{job.status}'. Only pending jobs can be started."
        )
    
    # Check printer availability - ensure no printer is double-booked
    conflicts = []
    for job_printer in job.printers:
        if job_printer.printer_profile_id:
            # Check if this printer is currently being used by another printing job
            active_jobs = db.query(models.PrintJob).join(
                models.PrintJobPrinter
            ).filter(
                models.PrintJob.status == "printing",
                models.PrintJobPrinter.printer_profile_id == job_printer.printer_profile_id,
                models.PrintJob.id != print_job_id  # Exclude current job
            ).first()
            
            if active_jobs:
                printer_name = job_printer.printer_name or f"Printer ID {job_printer.printer_profile_id}"
                conflicts.append(printer_name)
    
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"The following printers are currently in use: {', '.join(conflicts)}"
        )
    
    # Calculate total print time (hours)
    total_print_hours = 0.0
    for product_job in job.products:
        if product_job.product:
            total_print_hours += product_job.product.print_time_hrs * product_job.items_qty
    
    # Update job status and timestamps
    job.status = "printing"
    job.started_at = datetime.now(timezone.utc)
    job.estimated_completion_at = job.started_at + timedelta(hours=total_print_hours)
    
    db.commit()
    db.refresh(job)
    return job

@app.patch("/print_jobs/{print_job_id}", response_model=schemas.PrintJobRead)
def update_print_job(print_job_id: uuid.UUID, job_update: schemas.PrintJobUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Update a print job."""
    # Get the job with all relationships loaded
    db_job = db.query(models.PrintJob).options(
        joinedload(models.PrintJob.products).joinedload(models.PrintJobProduct.product),
        joinedload(models.PrintJob.printers)
    ).filter(models.PrintJob.id == print_job_id).first()
    
    if not db_job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Print Job with ID {print_job_id} not found")
    
    # Store original products for inventory adjustment if needed
    original_products = None
    new_products_data = None
    
    # Extract update data
    update_fields = job_update.model_dump(exclude_unset=True)
    
    # Handle products update if provided
    if "products" in update_fields:
        new_products_data = update_fields.pop("products")
        # Store original state for inventory adjustment
        original_products = [
            {"product_id": pjp.product_id, "items_qty": pjp.items_qty}
            for pjp in db_job.products
        ]
        
        # Delete existing product associations
        db.query(models.PrintJobProduct).filter(models.PrintJobProduct.print_job_id == db_job.id).delete()
        
        # Add new product associations
        for product_data in new_products_data:
            # Verify product exists
            product = db.get(models.Product, product_data["product_id"])
            if not product:
                db.rollback()
                raise HTTPException(
                    status_code=400, 
                    detail=f"Product with ID {product_data['product_id']} not found"
                )
            
            db_product_job = models.PrintJobProduct(
                print_job_id=db_job.id,
                product_id=product_data["product_id"],
                items_qty=product_data["items_qty"]
            )
            db.add(db_product_job)
        
        # Flush to ensure new products are available
        db.flush()
        # Expire the products relationship to force reload
        db.expire(db_job, ['products'])
    
    # Handle printers update if provided
    if "printers" in update_fields:
        # Reload job with fresh products data if products were updated
        if new_products_data is not None:
            db.refresh(db_job)
            # Reload products with their related data
            db_job = db.query(models.PrintJob).options(
                joinedload(models.PrintJob.products).joinedload(models.PrintJobProduct.product)
            ).filter(models.PrintJob.id == print_job_id).first()
        
        # Calculate total print time for all products
        total_print_hours = 0.0
        for pjp in db_job.products:
            if pjp.product:
                total_print_hours += pjp.product.print_time_hrs * pjp.items_qty
        
        # Delete existing printer associations
        db.query(models.PrintJobPrinter).filter(models.PrintJobPrinter.print_job_id == db_job.id).delete()
        
        # Add new printer associations with calculated hours
        for printer_data in update_fields["printers"]:
            printer_profile = db.get(models.PrinterProfile, printer_data['printer_profile_id'])
            if printer_profile:
                db_printer_job = models.PrintJobPrinter(
                    print_job_id=db_job.id,
                    printer_profile_id=printer_data['printer_profile_id'],
                    printers_qty=printer_data['printers_qty'],
                    hours_each=total_print_hours,  # Use calculated total print hours
                    # Store printer data at time of job creation
                    printer_name=printer_profile.name,
                    printer_manufacturer=printer_profile.manufacturer,
                    printer_model=printer_profile.model,
                    printer_price_eur=printer_profile.price_eur,
                    printer_expected_life_hours=printer_profile.expected_life_hours
                )
            else:
                db_printer_job = models.PrintJobPrinter(
                    print_job_id=db_job.id,
                    printer_profile_id=printer_data['printer_profile_id'],
                    printers_qty=printer_data['printers_qty'],
                    hours_each=total_print_hours  # Use calculated total print hours
                )
            db.add(db_printer_job)

    # Flush changes to get the updated job state without committing
    db.flush()

    # If products were updated, we need to update printer hours too
    if new_products_data is not None and db_job.printers:
        # Reload the job to get fresh product data
        db.refresh(db_job)
        
        # Calculate new total print hours based on updated products
        total_print_hours = 0.0
        for pjp in db_job.products:
            if pjp.product:
                total_print_hours += pjp.product.print_time_hrs * pjp.items_qty
        
        # Update hours_each for all printers
        for printer in db_job.printers:
            printer.hours_each = total_print_hours
        
        db.flush()
    
    # Handle inventory adjustments if products were modified
    if new_products_data is not None:
        # First, calculate what needs to be returned to inventory from the original state
        # by creating a temporary reversed job
        if original_products:
            # Create a temporary job object for inventory calculation
            temp_reverse_job = models.PrintJob()
            temp_reverse_job.products = [
                models.PrintJobProduct(print_job_id=None, product_id=item["product_id"], items_qty=item["items_qty"])
                for item in original_products
            ]
            
            # Load necessary product data
            for pjp in temp_reverse_job.products:
                pjp.product = db.get(models.Product, pjp.product_id)
                
            # Return filament to inventory (reverse deduction)
            _return_filament_to_inventory(temp_reverse_job, db)
        
        # Now deduct inventory for the new state
        filament_result = _deduct_filament_for_print_job(db_job, db)
        if not filament_result["success"]:
            # If insufficient inventory, roll back and raise error
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Insufficient filament inventory for updated print job",
                    "errors": filament_result["errors"]
                }
            )

    # Commit changes
    db.commit()
    
    # Reload the job with all relationships for accurate COGS calculation
    db_job = db.query(models.PrintJob).options(
        joinedload(models.PrintJob.products).joinedload(models.PrintJobProduct.product),
        joinedload(models.PrintJob.printers)
    ).filter(models.PrintJob.id == print_job_id).first()
    
    # recalc COGS with fresh data
    db_job.calculated_cogs_eur = _calculate_print_job_cogs(db_job, db)
    db.commit()
    db.refresh(db_job)
    return db_job


# ---------- God Dashboard (God User Only) ---------- #

@app.get("/god/stats", response_model=schemas.GodDashboardStats)
def get_god_stats(db: Session = Depends(get_db), god_user: models.User = Depends(get_current_god_user)):
    """Get statistics for god dashboard (god user only)"""
    # Count super-admin users (including god user, since each super-admin represents an organization)
    superadmin_count = db.query(models.User).filter(
        models.User.is_superadmin == True
    ).count()
    
    # Count total users
    total_users = db.query(models.User).count()
    
    # Count team members (non-superadmin users)
    team_members_count = db.query(models.User).filter(
        models.User.is_superadmin == False
    ).count()
    
    return schemas.GodDashboardStats(
        total_superadmins=superadmin_count,
        total_users=total_users,
        total_team_members=team_members_count
    )


@app.get("/god/users", response_model=List[schemas.GodUserHierarchy])
def get_god_users_hierarchy(db: Session = Depends(get_db), god_user: models.User = Depends(get_current_god_user)):
    """Get hierarchical view of all users (god user only)"""
    # Get all super-admin users (including god user)
    superadmins = db.query(models.User).filter(
        models.User.is_superadmin == True
    ).all()
    
    result = []
    
    # For each super-admin, get their team members
    for superadmin in superadmins:
        # Get team members created by this super-admin
        team_members = db.query(models.User).filter(
            models.User.created_by_user_id == superadmin.id
        ).all()
        
        # Create hierarchy entry
        hierarchy = schemas.GodUserHierarchy(
            superadmin=schemas.UserRead.model_validate(superadmin),
            team_members=[schemas.UserRead.model_validate(member) for member in team_members]
        )
        result.append(hierarchy)
    
    return result


@app.patch("/god/users/{user_id}", response_model=schemas.GodUserActionResponse)
def god_update_user(
    user_id: int,
    user_update: schemas.GodUserUpdate,
    db: Session = Depends(get_db),
    god_user: models.User = Depends(get_current_god_user)
):
    """Update any user as god user"""
    # Get the target user
    target_user = db.get(models.User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Security check: Prevent god user from demoting themselves
    if target_user.id == god_user.id and user_update.is_superadmin == False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="God user cannot demote their own super-admin status"
        )
    
    # Security check: Prevent god user from deactivating themselves
    if target_user.id == god_user.id and user_update.is_active == False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="God user cannot deactivate their own account"
        )
    
    # Update user fields
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(target_user, field, value)
    
    # Special handling: If promoting to superadmin, ensure they remain active
    if user_update.is_superadmin == True:
        target_user.is_active = True
    
    target_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(target_user)
    
    return schemas.GodUserActionResponse(
        message=f"User {target_user.name} updated successfully",
        user=schemas.UserRead.model_validate(target_user)
    )


@app.delete("/god/users/{user_id}", response_model=schemas.GodUserActionResponse)
def god_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    god_user: models.User = Depends(get_current_god_user)
):
    """Delete any user as god user"""
    # Get the target user
    target_user = db.get(models.User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Security check: Prevent god user from deleting themselves
    if target_user.id == god_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="God user cannot delete their own account"
        )
    
    # Security check: Prevent deleting other god users
    if target_user.is_god_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete another god user"
        )
    
    user_name = target_user.name
    user_email = target_user.email
    
    # Delete the user
    db.delete(target_user)
    db.commit()
    
    return schemas.GodUserActionResponse(
        message=f"User {user_name} ({user_email}) deleted successfully"
    )


@app.post("/god/users/{user_id}/reset-password", response_model=schemas.GodPasswordResetResponse)
def god_reset_user_password(
    user_id: int,
    password_reset: schemas.GodPasswordReset,
    db: Session = Depends(get_db),
    god_user: models.User = Depends(get_current_god_user)
):
    """Reset any user's password as god user"""
    # Get the target user
    target_user = db.get(models.User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Hash the new password
    target_user.hashed_password = get_password_hash(password_reset.new_password)
    target_user.updated_at = datetime.utcnow()
    
    db.commit()
    
    return schemas.GodPasswordResetResponse(
        message=f"Password reset successfully for user {target_user.name}"
    )


# ---------- God Admin Metrics (God User Only) ---------- #

@app.get("/god/metrics/users", response_model=List[schemas.DailyUserMetric])
def get_god_user_metrics(
    days: int = 30,
    db: Session = Depends(get_db), 
    god_user: models.User = Depends(get_current_god_user)
):
    """Get daily user creation metrics for the last N days (god user only)"""
    from sqlalchemy import func, case
    from datetime import datetime, timedelta
    
    # Calculate date range
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    # Query for daily user creation counts with breakdown
    results = db.query(
        func.date(models.User.created_at).label('date'),
        func.count().label('total_count'),
        func.sum(case((models.User.is_superadmin == True, 1), else_=0)).label('superadmins'),
        func.sum(case((models.User.is_superadmin == False, 1), else_=0)).label('regular_users')
    ).filter(
        func.date(models.User.created_at) >= start_date,
        func.date(models.User.created_at) <= end_date
    ).group_by(
        func.date(models.User.created_at)
    ).order_by(
        func.date(models.User.created_at)
    ).all()
    
    # Convert to response format with zero padding for missing dates
    # Note: func.date() returns strings, so we need to convert for lookup
    result_dict = {str(r.date): r for r in results}
    metrics = []
    
    current_date = start_date
    while current_date <= end_date:
        if str(current_date) in result_dict:
            r = result_dict[str(current_date)]
            metrics.append(schemas.DailyUserMetric(
                date=current_date,
                total_count=r.total_count,
                superadmins=r.superadmins,
                regular_users=r.regular_users
            ))
        else:
            metrics.append(schemas.DailyUserMetric(
                date=current_date,
                total_count=0,
                superadmins=0,
                regular_users=0
            ))
        current_date += timedelta(days=1)
    
    return metrics


@app.get("/god/metrics/products", response_model=List[schemas.DailyProductMetric])
def get_god_product_metrics(
    days: int = 30,
    db: Session = Depends(get_db), 
    god_user: models.User = Depends(get_current_god_user)
):
    """Get daily product creation metrics for the last N days (god user only)"""
    from sqlalchemy import func
    from datetime import timedelta
    
    # Calculate date range
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    # Query for daily product creation counts using the new created_at field
    results = db.query(
        func.date(models.Product.created_at).label('date'),
        func.count().label('total_count')
    ).filter(
        func.date(models.Product.created_at) >= start_date,
        func.date(models.Product.created_at) <= end_date
    ).group_by(
        func.date(models.Product.created_at)
    ).order_by(
        func.date(models.Product.created_at)
    ).all()
    
    # Convert to response format with zero padding for missing dates
    # Note: func.date() returns strings, so we need to convert for lookup
    result_dict = {str(r.date): r for r in results}
    metrics = []
    
    current_date = start_date
    while current_date <= end_date:
        if str(current_date) in result_dict:
            r = result_dict[str(current_date)]
            metrics.append(schemas.DailyProductMetric(
                date=current_date,
                total_count=r.total_count
            ))
        else:
            metrics.append(schemas.DailyProductMetric(
                date=current_date,
                total_count=0
            ))
        current_date += timedelta(days=1)
    
    return metrics


@app.get("/god/metrics/print-jobs", response_model=List[schemas.DailyPrintJobMetric])
def get_god_print_job_metrics(
    days: int = 30,
    db: Session = Depends(get_db), 
    god_user: models.User = Depends(get_current_god_user)
):
    """Get daily print job creation metrics for the last N days (god user only)"""
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    # Calculate date range
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    # Query for daily print job creation counts
    results = db.query(
        func.date(models.PrintJob.created_at).label('date'),
        func.count().label('total_count')
    ).filter(
        func.date(models.PrintJob.created_at) >= start_date,
        func.date(models.PrintJob.created_at) <= end_date
    ).group_by(
        func.date(models.PrintJob.created_at)
    ).order_by(
        func.date(models.PrintJob.created_at)
    ).all()
    
    # Convert to response format with zero padding for missing dates
    # Note: func.date() returns strings, so we need to convert for lookup
    result_dict = {str(r.date): r for r in results}
    metrics = []
    
    current_date = start_date
    while current_date <= end_date:
        if str(current_date) in result_dict:
            r = result_dict[str(current_date)]
            metrics.append(schemas.DailyPrintJobMetric(
                date=current_date,
                total_count=r.total_count
            ))
        else:
            metrics.append(schemas.DailyPrintJobMetric(
                date=current_date,
                total_count=0
            ))
        current_date += timedelta(days=1)
    
    return metrics


@app.get("/god/metrics/summary", response_model=schemas.GodMetricsSummary)
def get_god_metrics_summary(
    days: int = 30,
    db: Session = Depends(get_db), 
    god_user: models.User = Depends(get_current_god_user)
):
    """Get all metrics in one call for God Admin dashboard (god user only)"""
    # Get all metrics in parallel by calling the individual functions
    user_metrics = get_god_user_metrics(days=days, db=db, god_user=god_user)
    product_metrics = get_god_product_metrics(days=days, db=db, god_user=god_user)
    print_job_metrics = get_god_print_job_metrics(days=days, db=db, god_user=god_user)
    
    return schemas.GodMetricsSummary(
        users=user_metrics,
        products=product_metrics,
        print_jobs=print_job_metrics
    )


# ---------- Enhanced God Admin Metrics (God User Only) ---------- #

@app.get("/god/metrics/active-users", response_model=List[schemas.ActiveUserMetric])
def get_god_active_user_metrics(
    days: int = 30,
    db: Session = Depends(get_db), 
    god_user: models.User = Depends(get_current_god_user)
):
    """Get Daily/Weekly/Monthly Active Users metrics (god user only)"""
    from sqlalchemy import func, distinct, or_, and_
    from datetime import timedelta
    
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    metrics = []
    
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        
        # DAU: Users active on this specific day
        dau = db.query(func.count(distinct(models.User.id))).filter(
            or_(
                # Users who logged in on this day
                func.date(models.User.last_login) == current_date,
                # Users who created activities on this day
                models.User.id.in_(
                    db.query(models.UserActivity.user_id).filter(
                        func.date(models.UserActivity.activity_timestamp) == current_date
                    )
                )
            )
        ).scalar() or 0
        
        # WAU: Users active in the past 7 days from current_date
        wau_start = current_date - timedelta(days=6)
        wau = db.query(func.count(distinct(models.User.id))).filter(
            or_(
                and_(
                    func.date(models.User.last_login) >= wau_start,
                    func.date(models.User.last_login) <= current_date
                ),
                models.User.id.in_(
                    db.query(models.UserActivity.user_id).filter(
                        func.date(models.UserActivity.activity_timestamp) >= wau_start,
                        func.date(models.UserActivity.activity_timestamp) <= current_date
                    )
                )
            )
        ).scalar() or 0
        
        # MAU: Users active in the past 30 days from current_date
        mau_start = current_date - timedelta(days=29)
        mau = db.query(func.count(distinct(models.User.id))).filter(
            or_(
                and_(
                    func.date(models.User.last_login) >= mau_start,
                    func.date(models.User.last_login) <= current_date
                ),
                models.User.id.in_(
                    db.query(models.UserActivity.user_id).filter(
                        func.date(models.UserActivity.activity_timestamp) >= mau_start,
                        func.date(models.UserActivity.activity_timestamp) <= current_date
                    )
                )
            )
        ).scalar() or 0
        
        # New vs Returning users for this day
        new_users = db.query(func.count(models.User.id)).filter(
            func.date(models.User.created_at) == current_date
        ).scalar() or 0
        
        returning_users = max(0, dau - new_users)
        
        metrics.append(schemas.ActiveUserMetric(
            date=current_date,
            daily_active_users=dau,
            weekly_active_users=wau,
            monthly_active_users=mau,
            new_vs_returning={
                "new": new_users,
                "returning": returning_users
            }
        ))
    
    return metrics


@app.get("/god/metrics/engagement", response_model=List[schemas.UserEngagementMetric])
def get_god_engagement_metrics(
    days: int = 30,
    db: Session = Depends(get_db), 
    god_user: models.User = Depends(get_current_god_user)
):
    """Get user engagement metrics (god user only)"""
    from sqlalchemy import func
    from datetime import timedelta
    
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    metrics = []
    
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        
        # Total logins for this day
        total_logins = db.query(func.count(models.UserActivity.id)).filter(
            func.date(models.UserActivity.activity_timestamp) == current_date,
            models.UserActivity.activity_type == 'login'
        ).scalar() or 0
        
        # Unique users who logged in
        unique_logins = db.query(func.count(func.distinct(models.UserActivity.user_id))).filter(
            func.date(models.UserActivity.activity_timestamp) == current_date,
            models.UserActivity.activity_type == 'login'
        ).scalar() or 0
        
        # Total activities for the day
        total_activities = db.query(func.count(models.UserActivity.id)).filter(
            func.date(models.UserActivity.activity_timestamp) == current_date
        ).scalar() or 0
        
        # Active users for the day
        active_users = db.query(func.count(func.distinct(models.UserActivity.user_id))).filter(
            func.date(models.UserActivity.activity_timestamp) == current_date
        ).scalar() or 0
        
        # Calculate average actions per user
        avg_actions = (total_activities / active_users) if active_users > 0 else 0.0
        
        # Feature usage breakdown
        feature_usage = {}
        activity_types = db.query(
            models.UserActivity.activity_type,
            func.count(models.UserActivity.id).label('count')
        ).filter(
            func.date(models.UserActivity.activity_timestamp) == current_date
        ).group_by(models.UserActivity.activity_type).all()
        
        for activity_type, count in activity_types:
            feature_usage[activity_type] = count
        
        # Peak hour analysis (hour with most activity)
        peak_hour_data = db.query(
            func.extract('hour', models.UserActivity.activity_timestamp).label('hour'),
            func.count(models.UserActivity.id).label('count')
        ).filter(
            func.date(models.UserActivity.activity_timestamp) == current_date
        ).group_by(
            func.extract('hour', models.UserActivity.activity_timestamp)
        ).order_by(func.count(models.UserActivity.id).desc()).first()
        
        peak_hour = int(peak_hour_data.hour) if peak_hour_data else None
        
        metrics.append(schemas.UserEngagementMetric(
            date=current_date,
            total_logins=total_logins,
            unique_users_logged_in=unique_logins,
            avg_actions_per_user=round(avg_actions, 2),
            peak_hour=peak_hour,
            feature_usage=feature_usage
        ))
    
    return metrics


@app.get("/god/metrics/business", response_model=List[schemas.BusinessMetric])
def get_god_business_metrics(
    days: int = 30,
    db: Session = Depends(get_db), 
    god_user: models.User = Depends(get_current_god_user)
):
    """Get business intelligence metrics (god user only)"""
    from sqlalchemy import func
    from datetime import timedelta
    
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    metrics = []
    
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        
        # Total filament consumed for the day (from print jobs created that day)
        filament_consumed = db.query(func.sum(models.FilamentUsage.grams_used)).join(
            models.Product, models.FilamentUsage.product_id == models.Product.id
        ).join(
            models.PrintJobProduct, models.Product.id == models.PrintJobProduct.product_id
        ).join(
            models.PrintJob, models.PrintJobProduct.print_job_id == models.PrintJob.id
        ).filter(
            func.date(models.PrintJob.created_at) == current_date
        ).scalar() or 0.0
        
        total_filament_consumed = filament_consumed
        
        # Average print time for jobs created that day
        avg_print_time = db.query(func.avg(models.Product.print_time_hrs)).join(
            models.PrintJobProduct, models.Product.id == models.PrintJobProduct.product_id
        ).join(
            models.PrintJob, models.PrintJobProduct.print_job_id == models.PrintJob.id
        ).filter(
            func.date(models.PrintJob.created_at) == current_date
        ).scalar() or 0.0
        
        # Print success rate (completed vs total)
        total_jobs = db.query(func.count(models.PrintJob.id)).filter(
            func.date(models.PrintJob.created_at) == current_date
        ).scalar() or 0
        
        completed_jobs = db.query(func.count(models.PrintJob.id)).filter(
            func.date(models.PrintJob.created_at) == current_date,
            models.PrintJob.status == 'completed'
        ).scalar() or 0
        
        success_rate = (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0.0
        
        # Top products for the day (most used in print jobs)
        top_products_query = db.query(
            models.Product.name,
            func.sum(models.PrintJobProduct.items_qty).label('count')
        ).join(
            models.PrintJobProduct, models.Product.id == models.PrintJobProduct.product_id
        ).join(
            models.PrintJob, models.PrintJobProduct.print_job_id == models.PrintJob.id
        ).filter(
            func.date(models.PrintJob.created_at) == current_date
        ).group_by(models.Product.id, models.Product.name).order_by(
            func.sum(models.PrintJobProduct.items_qty).desc()
        ).limit(5).all()
        
        top_products = [{"name": name, "count": count} for name, count in top_products_query]
        
        # Top filaments for the day (most consumed) - SQLite compatible
        top_filaments_query = db.query(
            (models.Filament.brand + ' ' + models.Filament.color + ' ' + models.Filament.material).label('name'),
            func.sum(models.FilamentUsage.grams_used).label('usage_g')
        ).join(
            models.Filament, models.FilamentUsage.filament_id == models.Filament.id
        ).join(
            models.Product, models.FilamentUsage.product_id == models.Product.id
        ).join(
            models.PrintJobProduct, models.Product.id == models.PrintJobProduct.product_id
        ).join(
            models.PrintJob, models.PrintJobProduct.print_job_id == models.PrintJob.id
        ).filter(
            func.date(models.PrintJob.created_at) == current_date
        ).group_by(models.Filament.id).order_by(
            func.sum(models.FilamentUsage.grams_used).desc()
        ).limit(5).all()
        
        
        top_filaments = [{"name": name, "usage_g": float(usage_g)} for name, usage_g in top_filaments_query]
        
        metrics.append(schemas.BusinessMetric(
            date=current_date,
            total_filament_consumed_g=float(total_filament_consumed),
            avg_print_time_hrs=float(avg_print_time) if avg_print_time else 0.0,
            print_success_rate=round(success_rate, 2),
            top_products=top_products,
            top_filaments=top_filaments
        ))
    
    return metrics


@app.get("/god/metrics/retention", response_model=List[schemas.RetentionMetric])
def get_god_retention_metrics(
    days: int = 30,
    db: Session = Depends(get_db), 
    god_user: models.User = Depends(get_current_god_user)
):
    """Get user retention cohort analysis (god user only)"""
    from sqlalchemy import func
    from datetime import timedelta
    
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    metrics = []
    
    for i in range(days):
        cohort_date = start_date + timedelta(days=i)
        
        # Users who signed up on this date (cohort)
        cohort_users = db.query(models.User.id).filter(
            func.date(models.User.created_at) == cohort_date
        ).all()
        
        cohort_size = len(cohort_users)
        
        if cohort_size == 0:
            metrics.append(schemas.RetentionMetric(
                cohort_date=cohort_date,
                cohort_size=0,
                retention_1_day=None,
                retention_7_day=None,
                retention_30_day=None
            ))
            continue
        
        cohort_user_ids = [user.id for user in cohort_users]
        
        # 1-day retention: users who were active 1 day after signup
        one_day_later = cohort_date + timedelta(days=1)
        retained_1_day = db.query(func.count(func.distinct(models.UserActivity.user_id))).filter(
            models.UserActivity.user_id.in_(cohort_user_ids),
            func.date(models.UserActivity.activity_timestamp) == one_day_later
        ).scalar() or 0
        
        # 7-day retention: users who were active within 7 days after signup
        seven_days_later = cohort_date + timedelta(days=7)
        retained_7_day = db.query(func.count(func.distinct(models.UserActivity.user_id))).filter(
            models.UserActivity.user_id.in_(cohort_user_ids),
            func.date(models.UserActivity.activity_timestamp) >= cohort_date + timedelta(days=1),
            func.date(models.UserActivity.activity_timestamp) <= seven_days_later
        ).scalar() or 0
        
        # 30-day retention: users who were active within 30 days after signup
        thirty_days_later = cohort_date + timedelta(days=30)
        retained_30_day = db.query(func.count(func.distinct(models.UserActivity.user_id))).filter(
            models.UserActivity.user_id.in_(cohort_user_ids),
            func.date(models.UserActivity.activity_timestamp) >= cohort_date + timedelta(days=1),
            func.date(models.UserActivity.activity_timestamp) <= thirty_days_later
        ).scalar() or 0
        
        # Calculate retention percentages
        retention_1_day = (retained_1_day / cohort_size * 100) if cohort_size > 0 else None
        retention_7_day = (retained_7_day / cohort_size * 100) if cohort_size > 0 else None
        retention_30_day = (retained_30_day / cohort_size * 100) if cohort_size > 0 else None
        
        # Only show retention if enough time has passed
        if (datetime.utcnow().date() - cohort_date).days < 1:
            retention_1_day = None
        if (datetime.utcnow().date() - cohort_date).days < 7:
            retention_7_day = None
        if (datetime.utcnow().date() - cohort_date).days < 30:
            retention_30_day = None
        
        metrics.append(schemas.RetentionMetric(
            cohort_date=cohort_date,
            cohort_size=cohort_size,
            retention_1_day=round(retention_1_day, 2) if retention_1_day is not None else None,
            retention_7_day=round(retention_7_day, 2) if retention_7_day is not None else None,
            retention_30_day=round(retention_30_day, 2) if retention_30_day is not None else None
        ))
    
    return metrics


@app.get("/god/metrics/funnel", response_model=List[schemas.UserFunnelMetric])
def get_god_funnel_metrics(
    days: int = 30,
    db: Session = Depends(get_db), 
    god_user: models.User = Depends(get_current_god_user)
):
    """Get user journey funnel metrics (god user only)"""
    from sqlalchemy import func
    from datetime import timedelta
    
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    metrics = []
    
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        
        # Signups for the day
        signups = db.query(func.count(models.User.id)).filter(
            func.date(models.User.created_at) == current_date
        ).scalar() or 0
        
        # First logins for the day
        first_logins = db.query(func.count(models.UserActivity.id)).filter(
            func.date(models.UserActivity.activity_timestamp) == current_date,
            models.UserActivity.activity_type == 'login'
        ).join(models.User, models.UserActivity.user_id == models.User.id).filter(
            func.date(models.User.created_at) == current_date
        ).scalar() or 0
        
        # First product creation for the day
        first_products = db.query(func.count(models.UserActivity.id)).filter(
            func.date(models.UserActivity.activity_timestamp) == current_date,
            models.UserActivity.activity_type == 'create_product'
        ).join(models.User, models.UserActivity.user_id == models.User.id).filter(
            func.date(models.User.created_at) == current_date
        ).scalar() or 0
        
        # First print job creation for the day
        first_prints = db.query(func.count(models.UserActivity.id)).filter(
            func.date(models.UserActivity.activity_timestamp) == current_date,
            models.UserActivity.activity_type == 'create_print_job'
        ).join(models.User, models.UserActivity.user_id == models.User.id).filter(
            func.date(models.User.created_at) == current_date
        ).scalar() or 0
        
        # Calculate average time to progression for users who signed up today
        today_users = db.query(models.User.id, models.User.created_at).filter(
            func.date(models.User.created_at) == current_date
        ).all()
        
        avg_signup_to_login_hrs = None
        avg_login_to_product_hrs = None
        avg_product_to_print_hrs = None
        
        if today_users:
            signup_to_login_times = []
            login_to_product_times = []
            product_to_print_times = []
            
            for user_id, signup_time in today_users:
                # First login after signup
                first_login = db.query(models.UserActivity.activity_timestamp).filter(
                    models.UserActivity.user_id == user_id,
                    models.UserActivity.activity_type == 'login',
                    models.UserActivity.activity_timestamp >= signup_time
                ).order_by(models.UserActivity.activity_timestamp).first()
                
                if first_login:
                    signup_to_login_hrs = (first_login[0] - signup_time).total_seconds() / 3600
                    signup_to_login_times.append(signup_to_login_hrs)
                    
                    # First product after login
                    first_product = db.query(models.UserActivity.activity_timestamp).filter(
                        models.UserActivity.user_id == user_id,
                        models.UserActivity.activity_type == 'create_product',
                        models.UserActivity.activity_timestamp >= first_login[0]
                    ).order_by(models.UserActivity.activity_timestamp).first()
                    
                    if first_product:
                        login_to_product_hrs = (first_product[0] - first_login[0]).total_seconds() / 3600
                        login_to_product_times.append(login_to_product_hrs)
                        
                        # First print after product
                        first_print = db.query(models.UserActivity.activity_timestamp).filter(
                            models.UserActivity.user_id == user_id,
                            models.UserActivity.activity_type == 'create_print_job',
                            models.UserActivity.activity_timestamp >= first_product[0]
                        ).order_by(models.UserActivity.activity_timestamp).first()
                        
                        if first_print:
                            product_to_print_hrs = (first_print[0] - first_product[0]).total_seconds() / 3600
                            product_to_print_times.append(product_to_print_hrs)
            
            # Calculate averages
            avg_signup_to_login_hrs = sum(signup_to_login_times) / len(signup_to_login_times) if signup_to_login_times else None
            avg_login_to_product_hrs = sum(login_to_product_times) / len(login_to_product_times) if login_to_product_times else None
            avg_product_to_print_hrs = sum(product_to_print_times) / len(product_to_print_times) if product_to_print_times else None
        
        metrics.append(schemas.UserFunnelMetric(
            date=current_date,
            signups=signups,
            first_logins=first_logins,
            first_products=first_products,
            first_prints=first_prints,
            avg_signup_to_login_hrs=round(avg_signup_to_login_hrs, 2) if avg_signup_to_login_hrs is not None else None,
            avg_login_to_product_hrs=round(avg_login_to_product_hrs, 2) if avg_login_to_product_hrs is not None else None,
            avg_product_to_print_hrs=round(avg_product_to_print_hrs, 2) if avg_product_to_print_hrs is not None else None
        ))
    
    return metrics
