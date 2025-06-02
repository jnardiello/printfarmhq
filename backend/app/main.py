from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List, Union
from datetime import timedelta, datetime
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
    get_password_hash,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .database import setup_required
from .alerts import generate_alerts

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
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    user = authenticate_user(credentials.email, credentials.password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
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
    plate_usages = db.query(models.PlateFilamentUsage).filter(models.PlateFilamentUsage.filament_id == filament_id).first()
    
    if filament_usages or plate_usages:
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
        # Count products using this filament through both legacy and plate-based relationships
        legacy_products = db.query(models.Product).join(models.FilamentUsage).filter(
            models.FilamentUsage.filament_id == filament.id
        ).distinct().count()
        
        plate_products = db.query(models.Product).join(models.Plate).join(models.PlateFilamentUsage).filter(
            models.PlateFilamentUsage.filament_id == filament.id
        ).distinct().count()
        
        # Use set to avoid counting same product twice if it uses both systems
        product_ids = set()
        
        # Get products through legacy system
        legacy_product_ids = db.query(models.Product.id).join(models.FilamentUsage).filter(
            models.FilamentUsage.filament_id == filament.id
        ).distinct().all()
        product_ids.update([p[0] for p in legacy_product_ids])
        
        # Get products through plate system
        plate_product_ids = db.query(models.Product.id).join(models.Plate).join(models.PlateFilamentUsage).filter(
            models.PlateFilamentUsage.filament_id == filament.id
        ).distinct().all()
        product_ids.update([p[0] for p in plate_product_ids])
        
        products_using = len(product_ids)
        
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
    sku: str = Form(...),
    name: str = Form(...),
    print_time: str = Form(...),  # HH:MM:SS or MM:SS format
    # plate data
    plate_names: str = Form(None),  # JSON string of plate names
    plate_quantities: str = Form(None),  # JSON string of plate quantities
    plate_print_times: str = Form(None),  # JSON string of plate print times
    plate_filament_ids: str = Form(None),  # JSON string of arrays of filament IDs per plate
    plate_grams_used: str = Form(None),  # JSON string of arrays of grams used per plate
    # legacy data (backwards compatibility)
    filament_ids: str = Form(None),  # JSON string of filament IDs for legacy single product
    grams_used_list: str = Form(None),  # JSON string of grams used for legacy single product
    additional_parts_cost: float = Form(0.0),
    license_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new product with plate-based or legacy filament usage"""
    # Parse time string
    total_seconds = parse_time_from_form(print_time)
    print_time_hrs = total_seconds / 3600
    
    # Determine if using plates or legacy
    using_plates = plate_names is not None
    
    # Create product
    db_product = models.Product(
        sku=sku,
        name=name,
        print_time_hrs=print_time_hrs,
        additional_parts_cost=additional_parts_cost,
        license_id=license_id if license_id else None
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
    
    if using_plates:
        # Parse plate data
        try:
            names = json.loads(plate_names) if plate_names else []
            quantities = json.loads(plate_quantities) if plate_quantities else []
            times = json.loads(plate_print_times) if plate_print_times else []
            filament_ids_list = json.loads(plate_filament_ids) if plate_filament_ids else []
            grams_list = json.loads(plate_grams_used) if plate_grams_used else []
            
            # Create plates
            for i, name in enumerate(names):
                plate_time_str = times[i] if i < len(times) else "00:00:00"
                plate_seconds = parse_time_from_form(plate_time_str)
                
                db_plate = models.Plate(
                    product_id=db_product.id,
                    name=name,
                    quantity=quantities[i] if i < len(quantities) else 1,
                    print_time_hrs=plate_seconds / 3600
                )
                db.add(db_plate)
                db.flush()
                
                # Add filament usages for this plate
                plate_filament_ids = filament_ids_list[i] if i < len(filament_ids_list) else []
                plate_grams = grams_list[i] if i < len(grams_list) else []
                
                for j, fid in enumerate(plate_filament_ids):
                    if fid and j < len(plate_grams):
                        usage = models.PlateFilamentUsage(
                            plate_id=db_plate.id,
                            filament_id=fid,
                            grams_used=plate_grams[j]
                        )
                        db.add(usage)
        except json.JSONDecodeError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Invalid JSON in plate data: {str(e)}")
    else:
        # Legacy single-product filament usage
        if filament_ids and grams_used_list:
            try:
                filament_ids_parsed = json.loads(filament_ids)
                grams_used_parsed = json.loads(grams_used_list)
                
                for fid, grams in zip(filament_ids_parsed, grams_used_parsed):
                    if fid and grams:
                        usage = models.FilamentUsage(
                            product_id=db_product.id,
                            filament_id=fid,
                            grams_used=grams
                        )
                        db.add(usage)
            except json.JSONDecodeError as e:
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Invalid JSON in filament data: {str(e)}")
    
    db.commit()
    db.refresh(db_product)
    return db_product


@app.get("/products", response_model=list[schemas.ProductRead])
def list_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """List all products (any authenticated user can view products)"""
    products = db.query(models.Product).offset(skip).limit(limit).all()
    return products


@app.get("/products/{product_id}", response_model=schemas.ProductRead)
def get_product(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    product = db.query(models.Product).options(
        joinedload(models.Product.filament_usages).joinedload(models.FilamentUsage.filament),
        joinedload(models.Product.plates).joinedload(models.Plate.filament_usages).joinedload(models.PlateFilamentUsage.filament)
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
    db.refresh(product)
    return product


@app.put("/products/{product_id}", response_model=schemas.ProductRead)
def update_product_full(
    product_id: int,
    sku: str = Form(...),
    name: str = Form(...),
    print_time: str = Form(...),  # HH:MM:SS or MM:SS format
    # plate data
    plate_names: str = Form(None),  # JSON string of plate names
    plate_quantities: str = Form(None),  # JSON string of plate quantities
    plate_print_times: str = Form(None),  # JSON string of plate print times
    plate_filament_ids: str = Form(None),  # JSON string of arrays of filament IDs per plate
    plate_grams_used: str = Form(None),  # JSON string of arrays of grams used per plate
    # legacy data (backwards compatibility)
    filament_ids: str = Form(None),  # JSON string of filament IDs for legacy single product
    grams_used_list: str = Form(None),  # JSON string of grams used for legacy single product
    additional_parts_cost: float = Form(0.0),
    license_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
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
    
    # Determine if using plates or legacy
    using_plates = plate_names is not None
    
    # Update basic product info
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
    
    if using_plates:
        # Delete existing plates and their filament usages (cascade)
        db.query(models.Plate).filter(models.Plate.product_id == product_id).delete()
        
        # Parse and create new plates
        try:
            names = json.loads(plate_names) if plate_names else []
            quantities = json.loads(plate_quantities) if plate_quantities else []
            times = json.loads(plate_print_times) if plate_print_times else []
            filament_ids_list = json.loads(plate_filament_ids) if plate_filament_ids else []
            grams_list = json.loads(plate_grams_used) if plate_grams_used else []
            
            for i, name in enumerate(names):
                plate_time_str = times[i] if i < len(times) else "00:00:00"
                plate_seconds = parse_time_from_form(plate_time_str)
                
                db_plate = models.Plate(
                    product_id=db_product.id,
                    name=name,
                    quantity=quantities[i] if i < len(quantities) else 1,
                    print_time_hrs=plate_seconds / 3600
                )
                db.add(db_plate)
                db.flush()
                
                # Add filament usages for this plate
                plate_filament_ids = filament_ids_list[i] if i < len(filament_ids_list) else []
                plate_grams = grams_list[i] if i < len(grams_list) else []
                
                for j, fid in enumerate(plate_filament_ids):
                    if fid and j < len(plate_grams):
                        usage = models.PlateFilamentUsage(
                            plate_id=db_plate.id,
                            filament_id=fid,
                            grams_used=plate_grams[j]
                        )
                        db.add(usage)
        except json.JSONDecodeError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Invalid JSON in plate data: {str(e)}")
    else:
        # Legacy: Delete existing filament usages and create new ones
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
                            grams_used=grams
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


# ---------- Plates ---------- #

@app.post("/products/{product_id}/plates", response_model=schemas.PlateRead, status_code=status.HTTP_201_CREATED)
def create_plate(
    product_id: int,
    plate: schemas.PlateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new plate for a product"""
    # Verify product exists
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Create plate
    db_plate = models.Plate(
        product_id=product_id,
        name=plate.name,
        quantity=plate.quantity,
        print_time_hrs=plate.print_time_hrs,
        file_path=plate.file_path,
        gcode_path=plate.gcode_path
    )
    db.add(db_plate)
    db.flush()
    
    # Add filament usages
    if plate.filament_usages:
        for usage in plate.filament_usages:
            db_usage = models.PlateFilamentUsage(
                plate_id=db_plate.id,
                filament_id=usage.filament_id,
                grams_used=usage.grams_used
            )
            db.add(db_usage)
    
    db.commit()
    db.refresh(db_plate)
    return db_plate


@app.get("/products/{product_id}/plates", response_model=List[schemas.PlateRead])
def list_plates(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all plates for a product"""
    # Verify product exists
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    plates = db.query(models.Plate).filter(
        models.Plate.product_id == product_id
    ).options(
        joinedload(models.Plate.filament_usages).joinedload(models.PlateFilamentUsage.filament)
    ).all()
    
    return plates


@app.get("/plates/{plate_id}", response_model=schemas.PlateRead)
def get_plate(
    plate_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a specific plate"""
    plate = db.query(models.Plate).options(
        joinedload(models.Plate.filament_usages).joinedload(models.PlateFilamentUsage.filament)
    ).filter(models.Plate.id == plate_id).first()
    
    if not plate:
        raise HTTPException(status_code=404, detail="Plate not found")
    
    return plate


@app.put("/plates/{plate_id}", response_model=schemas.PlateRead)
def update_plate(
    plate_id: int,
    plate_update: schemas.PlateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a plate"""
    db_plate = db.get(models.Plate, plate_id)
    if not db_plate:
        raise HTTPException(status_code=404, detail="Plate not found")
    
    # Update basic fields
    update_data = plate_update.model_dump(exclude={'filament_usages'}, exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_plate, field, value)
    
    # Update filament usages if provided
    if plate_update.filament_usages is not None:
        # Delete existing usages
        db.query(models.PlateFilamentUsage).filter(
            models.PlateFilamentUsage.plate_id == plate_id
        ).delete()
        
        # Add new usages
        for usage in plate_update.filament_usages:
            db_usage = models.PlateFilamentUsage(
                plate_id=plate_id,
                filament_id=usage.filament_id,
                grams_used=usage.grams_used
            )
            db.add(db_usage)
    
    db.commit()
    db.refresh(db_plate)
    return db_plate


@app.delete("/plates/{plate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plate(
    plate_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a plate"""
    plate = db.get(models.Plate, plate_id)
    if not plate:
        raise HTTPException(status_code=404, detail="Plate not found")
    
    # Delete associated files if they exist
    for file_path in [plate.file_path, plate.gcode_path]:
        if file_path:
            full_path = os.path.join(os.getcwd(), file_path)
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except Exception as e:
                    logger.warning(f"Failed to delete file {full_path}: {str(e)}")
    
    db.delete(plate)
    db.commit()
    return


@app.post("/plates/{plate_id}/upload/{file_type}", response_model=schemas.PlateRead)
async def upload_plate_file(
    plate_id: int,
    file_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Upload a file for a plate (stl/3mf or gcode)"""
    # Validate file type
    if file_type not in ["model", "gcode"]:
        raise HTTPException(status_code=400, detail="file_type must be 'model' or 'gcode'")
    
    # Get the plate
    db_plate = db.get(models.Plate, plate_id)
    if not db_plate:
        raise HTTPException(status_code=404, detail="Plate not found")
    
    # Get the product for SKU
    product = db.get(models.Product, db_plate.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Validate file extension
    if file_type == "model":
        if not file.filename.lower().endswith(('.stl', '.3mf')):
            raise HTTPException(
                status_code=400,
                detail="Only STL and 3MF files are supported for models"
            )
        upload_dir = "uploads/plate_models"
    else:  # gcode
        if not file.filename.lower().endswith('.gcode'):
            raise HTTPException(
                status_code=400,
                detail="Only GCODE files are supported"
            )
        upload_dir = "uploads/plate_gcodes"
    
    # Create directory if it doesn't exist
    full_upload_dir = os.path.join(os.getcwd(), upload_dir)
    os.makedirs(full_upload_dir, exist_ok=True)
    
    # Save the file
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{product.sku}_plate_{plate_id}_{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(full_upload_dir, unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Update plate with file path
    relative_path = f"{upload_dir}/{unique_filename}"
    if file_type == "model":
        # Delete old file if exists
        if db_plate.file_path:
            old_path = os.path.join(os.getcwd(), db_plate.file_path)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception as e:
                    logger.warning(f"Failed to delete old file {old_path}: {str(e)}")
        db_plate.file_path = relative_path
    else:  # gcode
        # Delete old file if exists
        if db_plate.gcode_path:
            old_path = os.path.join(os.getcwd(), db_plate.gcode_path)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception as e:
                    logger.warning(f"Failed to delete old file {old_path}: {str(e)}")
        db_plate.gcode_path = relative_path
    
    db.commit()
    db.refresh(db_plate)
    
    return db_plate


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


@app.put("/printer_profiles/{printer_id}", response_model=schemas.PrinterProfileRead)
def update_printer_profile(
    printer_id: int,
    printer_update: schemas.PrinterProfileUpdate,
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
    
    db.commit()
    db.refresh(printer)
    return printer


@app.delete("/printer_profiles/{printer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_printer_profile(printer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a printer profile (any authenticated user can delete printer profiles)"""
    printer = db.get(models.PrinterProfile, printer_id)
    if not printer:
        raise HTTPException(status_code=404, detail="Printer profile not found")
    
    # No constraint check needed - print jobs store printer data directly
    db.delete(printer)
    db.commit()
    return


# ---------- Private helper functions for print jobs ---------- #

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
        
        # Check if product uses plates (new system)
        if product.plates:
            # Iterate through plates
            for plate in product.plates:
                plate_qty_per_product = plate.quantity
                total_plate_qty = plate_qty_per_product * items_qty
                
                # Iterate through filaments used in this plate
                for usage in plate.filament_usages:
                    filament_id = usage.filament_id
                    grams_per_plate = usage.grams_used
                    total_grams = grams_per_plate * total_plate_qty
                    
                    if filament_id not in filament_deductions:
                        filament_deductions[filament_id] = 0
                    filament_deductions[filament_id] += total_grams
        else:
            # Legacy system - single product with multiple filaments
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
        
        # Check if product uses plates (new system)
        if product.plates:
            # Iterate through plates
            for plate in product.plates:
                plate_qty_per_product = plate.quantity
                total_plate_qty = plate_qty_per_product * items_qty
                
                # Iterate through filaments used in this plate
                for usage in plate.filament_usages:
                    filament_id = usage.filament_id
                    grams_per_plate = usage.grams_used
                    total_grams = grams_per_plate * total_plate_qty
                    
                    if filament_id not in filament_returns:
                        filament_returns[filament_id] = 0
                    filament_returns[filament_id] += total_grams
        else:
            # Legacy system - single product with multiple filaments
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
def create_print_job(job: schemas.PrintJobCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
        
        db_product_job = models.PrintJobProduct(
            print_job_id=db_job.id,
            product_id=product_data.product_id,
            items_qty=product_data.items_qty
        )
        db.add(db_product_job)
    
    # Add printers with stored printer data
    for printer_data in job.printers:
        db_printer_job = models.PrintJobPrinter(
            print_job_id=db_job.id,
            printer_profile_id=printer_data.printer_profile_id,
            printers_qty=printer_data.printers_qty,
            hours_each=printer_data.hours_each
        )
        
        # Store printer data at time of job creation
        if printer_data.printer_profile_id:
            printer_profile = db.get(models.PrinterProfile, printer_data.printer_profile_id)
            if printer_profile:
                db_printer_job.printer_name = printer_profile.name
                db_printer_job.printer_manufacturer = printer_profile.manufacturer
                db_printer_job.printer_model = printer_profile.model
                db_printer_job.printer_price_eur = printer_profile.price_eur
                db_printer_job.printer_expected_life_hours = printer_profile.expected_life_hours
        
        db.add(db_printer_job)
    
    # Flush to ensure all relationships are established
    db.flush()
    
    # Reload the job with all relationships
    db.refresh(db_job)
    
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
    
    # Handle printers update if provided
    if "printers" in update_fields:
        # Delete existing printer associations
        db.query(models.PrintJobPrinter).filter(models.PrintJobPrinter.print_job_id == db_job.id).delete()
        db.add_all([
            models.PrintJobPrinter(print_job_id=db_job.id, printer_profile_id=it['printer_profile_id'], printers_qty=it['printers_qty'], hours_each=it.get('hours_each', 0.0))
            for it in update_fields["printers"]
        ])

    # Flush changes to get the updated job state without committing
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
    db.refresh(db_job)
    
    # recalc
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