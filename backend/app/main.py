from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List, Union
from datetime import timedelta
import json
import os
import shutil
import uuid

from . import models, schemas
from .database import Base, engine, SessionLocal
from .auth import (
    get_current_user, 
    get_current_admin_user,
    get_current_superadmin_user,
    create_access_token, 
    authenticate_user,
    create_user,
    ensure_superadmin_exists,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .alerts import generate_alerts

# Create DB tables
Base.metadata.create_all(bind=engine)

# ensure extra columns exist (simple migration)
from .database import _ensure_columns

_ensure_columns()

# Ensure superadmin exists and is up to date
db = SessionLocal()
try:
    ensure_superadmin_exists(db)
finally:
    db.close()

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


# ---------- Health Check ---------- #

@app.get("/")
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
            data={"sub": user.email, "token_version": user.token_version}, expires_delta=access_token_expires
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


@app.post("/auth/login", response_model=schemas.AuthResponse)
def login(user_data: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login with email and password"""
    user = authenticate_user(user_data.email, user_data.password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "token_version": user.token_version}, expires_delta=access_token_expires
    )
    
    return schemas.AuthResponse(
        access_token=access_token,
        user=schemas.UserRead.model_validate(user)
    )


@app.get("/auth/me", response_model=schemas.UserRead)
def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return schemas.UserRead.model_validate(current_user)


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
    """List all users (admin only)"""
    return db.query(models.User).all()


@app.post("/users", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def create_user_admin(user_data: schemas.UserCreate, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Create a new user (admin only)"""
    try:
        # Prevent non-superadmin from creating superadmin users
        if user_data.is_superadmin and not admin_user.is_superadmin:
            raise HTTPException(status_code=403, detail="Only superadmin can create superadmin users")
        
        user = create_user(user_data.email, user_data.password, user_data.name, db, user_data.is_admin, user_data.is_superadmin)
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


# ---------- Filaments ---------- #

@app.post("/filaments", response_model=schemas.FilamentRead, status_code=status.HTTP_201_CREATED)
def create_filament(filament: schemas.FilamentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_filament = models.Filament(**filament.model_dump())
    db.add(db_filament)
    db.commit()
    db.refresh(db_filament)
    return db_filament


@app.get("/filaments", response_model=list[schemas.FilamentRead])
def list_filaments(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Filament).all()


@app.get("/filaments/{filament_id}", response_model=schemas.FilamentRead)
def get_filament(filament_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    filament = db.get(models.Filament, filament_id)
    if not filament:
        raise HTTPException(status_code=404, detail="Filament not found")
    return filament


@app.delete("/filaments/{filament_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_filament(filament_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    filament = db.get(models.Filament, filament_id)
    if not filament:
        raise HTTPException(status_code=404, detail="Filament not found")
    db.delete(filament)
    db.commit()
    return


@app.patch("/filaments/{filament_id}", response_model=schemas.FilamentRead)
def update_filament(filament_id: int, upd: schemas.FilamentUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    filament = db.get(models.Filament, filament_id)
    if not filament:
        raise HTTPException(status_code=404, detail="Filament not found")
    update_data = upd.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(filament, k, v)
    db.commit()
    db.refresh(filament)
    return filament


# ---------- Filament Purchases ---------- #

@app.post("/filament_purchases", response_model=schemas.FilamentPurchaseRead, status_code=status.HTTP_201_CREATED)
def create_filament_purchase(purchase: schemas.FilamentPurchaseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    filament = db.get(models.Filament, purchase.filament_id)
    if not filament:
        raise HTTPException(status_code=400, detail="Filament not found")

    db_purchase = models.FilamentPurchase(**purchase.model_dump())
    db.add(db_purchase)

    # update aggregates
    total_before = filament.total_qty_kg
    avg_before = filament.price_per_kg

    new_total = total_before + purchase.quantity_kg
    if new_total == 0:
        filament.price_per_kg = 0.0
    else:
        filament.price_per_kg = (
            (avg_before * total_before) + (purchase.price_per_kg * purchase.quantity_kg)
        ) / new_total
    filament.total_qty_kg = new_total

    db.commit()
    db.refresh(db_purchase)
    return db_purchase


@app.get("/filament_purchases", response_model=list[schemas.FilamentPurchaseRead])
def list_filament_purchases(filament_id: Union[int, None] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.FilamentPurchase)
    if filament_id:
        query = query.filter(models.FilamentPurchase.filament_id == filament_id)
    return query.all()


@app.delete("/filament_purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_filament_purchase(purchase_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    purchase = db.get(models.FilamentPurchase, purchase_id)
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    filament = purchase.filament
    # update aggregates (remove qty)
    if filament and purchase.quantity_kg:
        new_total = max(0.0, filament.total_qty_kg - purchase.quantity_kg)
        filament.total_qty_kg = new_total
        # Recompute average if we have other purchases
        # Simplistic: recalc from remaining purchases
        others = (
            db.query(models.FilamentPurchase)
            .filter(models.FilamentPurchase.filament_id == filament.id, models.FilamentPurchase.id != purchase_id)
            .all()
        )
        if others:
            total_qty = sum(p.quantity_kg for p in others)
            total_cost = sum(p.quantity_kg * p.price_per_kg for p in others)
            filament.price_per_kg = total_cost / total_qty if total_qty else 0.0
        else:
            filament.price_per_kg = 0.0

    db.delete(purchase)
    db.commit()
    return


from fastapi.responses import StreamingResponse
import csv, io, datetime


@app.get("/filament_purchases/export")
def export_filament_purchases(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    purchases = (
        db.query(models.FilamentPurchase)
        .join(models.Filament)
        .order_by(models.FilamentPurchase.purchase_date.desc().nullslast(), models.FilamentPurchase.id.desc())
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID",
        "Color",
        "Brand",
        "Material",
        "Quantity_kg",
        "Price_per_kg",
        "Purchase_date",
        "Channel",
        "Notes",
    ])
    for p in purchases:
        writer.writerow(
            [
                p.id,
                p.filament.color,
                p.filament.brand,
                p.filament.material,
                p.quantity_kg,
                p.price_per_kg,
                p.purchase_date or "",
                p.channel or "",
                p.notes or "",
            ]
        )

    output.seek(0)
    filename = f"filament_purchases_{datetime.date.today()}.csv"
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})


# ---------- Products ---------- #

@app.post("/products", response_model=schemas.ProductRead)
async def create_product(
    name: str = Form(...),
    print_time_hrs: float = Form(...),
    license_id: Optional[int] = Form(None),
    filament_usages_str: str = Form(..., alias="filament_usages"),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    saved_model_file_path: Optional[str] = None
    if file and file.filename:
        original_filename = file.filename
        safe_filename_base = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in os.path.splitext(original_filename)[0])
        file_extension = os.path.splitext(original_filename)[1].lower()
        if file_extension not in ['.stl', '.3mf']:
            raise HTTPException(status_code=400, detail="Invalid model file type. Only STL and 3MF are allowed.")
        unique_filename = f"{safe_filename_base}_{uuid.uuid4().hex[:8]}{file_extension}"
        file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)
        try:
            with open(file_path, "wb") as buffer:
                await file.seek(0)
                shutil.copyfileobj(file.file, buffer)
            saved_model_file_path = unique_filename
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not save model file: {str(e)}")
        finally:
            if file: await file.close()

    try:
        filament_usages_data = json.loads(filament_usages_str)
        if not isinstance(filament_usages_data, list): raise ValueError("filament_usages should be a list")
        for usage_item in filament_usages_data:
            if not all(k in usage_item for k in ["filament_id", "grams_used"]):
                raise ValueError("Each filament usage must have filament_id and grams_used")
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid filament_usages format: {str(e)}")

    skl = _generate_sku(name, db)
    db_product_data = {
        "name": name, "sku": skl,
        "print_time_hrs": print_time_hrs,
        "license_id": license_id, "file_path": saved_model_file_path,
        "filament_weight_g": 0.0,
    }
    db_product = models.Product(**db_product_data)
    db.add(db_product)
    db.flush()

    usages_to_add = []
    for fu_data in filament_usages_data:
        fila = db.get(models.Filament, fu_data["filament_id"])
        if not fila: raise HTTPException(status_code=400, detail=f"Filament with id {fu_data['filament_id']} not found")
        usages_to_add.append(models.FilamentUsage(product_id=db_product.id, filament_id=fila.id, grams_used=fu_data["grams_used"]))
    db.add_all(usages_to_add)
    db.commit()
    db.refresh(db_product)
    
    return schemas.ProductRead.model_validate(db_product)


@app.get("/products", response_model=list[schemas.ProductRead])
def list_products(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    products_db = db.query(models.Product).options(joinedload(models.Product.filament_usages).joinedload(models.FilamentUsage.filament)).all()
    return [schemas.ProductRead.model_validate(p) for p in products_db]


@app.get("/products/{product_id}/cop", response_model=float)
def get_product_cop(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product.cop


@app.patch("/products/{product_id}", response_model=schemas.ProductRead)
async def update_product_endpoint(
    product_id: int,
    name: Optional[str] = Form(None),
    print_time_hrs: Optional[float] = Form(None),
    license_id_str: Optional[str] = Form(None),
    filament_usages_str: Optional[str] = Form(None, alias="filament_usages"),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_data_dict = {}
    if name is not None: update_data_dict["name"] = name
    if print_time_hrs is not None: update_data_dict["print_time_hrs"] = print_time_hrs
    
    if license_id_str is not None:
        if license_id_str.lower() == "none" or license_id_str == "": update_data_dict["license_id"] = None
        else:
            try: update_data_dict["license_id"] = int(license_id_str)
            except ValueError: raise HTTPException(status_code=400, detail="Invalid license_id format")

    for key, value in update_data_dict.items():
        setattr(product, key, value)

    if file and file.filename:
        if product.file_path:
            old_file_path = os.path.join(UPLOAD_DIRECTORY, product.file_path)
            if os.path.exists(old_file_path):
                try: os.remove(old_file_path)
                except OSError as e: print(f"Error deleting old model file {old_file_path}: {e}")
        
        original_filename = file.filename
        safe_filename_base = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in os.path.splitext(original_filename)[0])
        file_extension = os.path.splitext(original_filename)[1].lower()
        if file_extension not in ['.stl', '.3mf']:
            raise HTTPException(status_code=400, detail="Invalid model file type.")
        unique_filename = f"{safe_filename_base}_{uuid.uuid4().hex[:8]}{file_extension}"
        new_file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)
        try:
            with open(new_file_path, "wb") as buffer:
                await file.seek(0)
                shutil.copyfileobj(file.file, buffer)
            product.file_path = unique_filename
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not save new model file: {str(e)}")
        finally:
            if file: await file.close()
    
    if filament_usages_str is not None:
        try:
            filament_usages_data = json.loads(filament_usages_str)
            if not isinstance(filament_usages_data, list): raise ValueError("filament_usages list expected")
            for usage_item in filament_usages_data:
                if not all(k in usage_item for k in ["filament_id", "grams_used"]):
                    raise ValueError("Each filament usage needs filament_id and grams_used")
            
            db.query(models.FilamentUsage).filter(models.FilamentUsage.product_id == product_id).delete()
            new_usages = []
            for fu_data in filament_usages_data:
                fila = db.get(models.Filament, fu_data["filament_id"])
                if not fila: raise HTTPException(status_code=400, detail=f"Filament id {fu_data['filament_id']} not found.")
                new_usages.append(models.FilamentUsage(product_id=product.id, filament_id=fila.id, grams_used=fu_data["grams_used"]))
            db.add_all(new_usages)
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid filament_usages: {str(e)}")

    db.commit()
    db.refresh(product)
    return schemas.ProductRead.model_validate(product)


# ---------- Subscriptions ---------- #

@app.post("/subscriptions", response_model=schemas.SubscriptionRead)
def create_subscription(sub: schemas.SubscriptionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_sub = models.Subscription(**sub.model_dump())
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub


@app.get("/subscriptions", response_model=list[schemas.SubscriptionRead])
def list_subscriptions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Subscription).all()


# ---------- Printer Profiles ---------- #

@app.post("/printer_profiles", response_model=schemas.PrinterProfileRead, status_code=status.HTTP_201_CREATED)
def create_printer_profile(profile: schemas.PrinterProfileCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_prof = models.PrinterProfile(**profile.model_dump())
    db.add(db_prof)
    db.commit()
    db.refresh(db_prof)
    return db_prof


@app.get("/printer_profiles", response_model=list[schemas.PrinterProfileRead])
def list_printer_profiles(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.PrinterProfile).all()


@app.delete("/printer_profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_printer_profile(profile_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    prof = db.get(models.PrinterProfile, profile_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Check if profile is used by PrintJobs (via PrintJobPrinter association)
    if prof.print_jobs:
        raise HTTPException(status_code=400, detail="Profile in use by print jobs. Cannot delete.")

    db.delete(prof)
    db.commit()
    return


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


# Helper function to calculate COGS for a Print Job
def _calculate_print_job_cogs(job: models.PrintJob, db: Session) -> float:
    total_cogs_for_job = 0.0
    print(f"--- Calculating COGS for Job ID: {job.id} (Name: {job.name}) ---")

    # 1. Filament Cost Component
    current_filament_cost_total = 0.0
    print(f"Job has {len(job.products)} product line(s).")
    for job_product_item in job.products:
        product_model = db.get(models.Product, job_product_item.product_id)
        if not product_model:
            print(f"  WARNING: Product ID {job_product_item.product_id} not found for job product item ID {job_product_item.id}")
            continue
        print(f"  Processing Product Line: {product_model.name} (ID: {product_model.id}), Items Qty: {job_product_item.items_qty}")

        cost_of_filaments_for_one_product_unit = 0.0
        if not product_model.filament_usages:
             print(f"    Product {product_model.name} has no filament usages defined.")
        for filament_usage in product_model.filament_usages:
            if filament_usage.filament:
                individual_filament_cost = (filament_usage.grams_used / 1000.0) * filament_usage.filament.price_per_kg
                cost_of_filaments_for_one_product_unit += individual_filament_cost
                print(f"    Filament Type ID {filament_usage.filament.id} ({filament_usage.filament.color} {filament_usage.filament.material}): {filament_usage.grams_used}g @ €{filament_usage.filament.price_per_kg:.2f}/kg = €{individual_filament_cost:.4f}")
            else:
                print(f"    WARNING: Filament details not found for filament_usage id {filament_usage.id} in product {product_model.name}")
            
        print(f"    Total filament cost per unit for {product_model.name} = €{cost_of_filaments_for_one_product_unit:.4f}")
        line_filament_cost = cost_of_filaments_for_one_product_unit * job_product_item.items_qty
        current_filament_cost_total += line_filament_cost
        print(f"    Subtotal Filament Cost for this product line ({job_product_item.items_qty} items): €{line_filament_cost:.4f}")
    
    total_cogs_for_job += current_filament_cost_total
    print(f"Running Total after Filaments: €{total_cogs_for_job:.4f}")

    # 2. Printer Cost Component
    current_printer_cost_total = 0.0
    print(f"Job has {len(job.printers)} printer line(s).")
    for job_printer_item in job.printers:
        printer_profile_model = db.get(models.PrinterProfile, job_printer_item.printer_profile_id)
        if not printer_profile_model:
            print(f"  WARNING: Printer Profile ID {job_printer_item.printer_profile_id} not found for job printer item ID {job_printer_item.id}")
            continue
        print(f"  Processing Printer Line: {printer_profile_model.name} (ID: {printer_profile_model.id}), Printers Qty: {job_printer_item.printers_qty}, Hours Each: {job_printer_item.hours_each}")
        
        if printer_profile_model.expected_life_hours == 0:
            print(f"    WARNING: Printer Profile {printer_profile_model.name} has 0 expected life hours. Cannot calculate cost.")
            continue
        
        cost_per_hour_for_this_printer_type = printer_profile_model.price_eur / printer_profile_model.expected_life_hours
        print(f"    Printer {printer_profile_model.name}: Cost per hour = €{cost_per_hour_for_this_printer_type:.4f} (Price: €{printer_profile_model.price_eur:.2f} / Life: {printer_profile_model.expected_life_hours}hrs)")
        cost_for_this_printer_line = cost_per_hour_for_this_printer_type * \
                                     job_printer_item.hours_each * \
                                     job_printer_item.printers_qty
        current_printer_cost_total += cost_for_this_printer_line
        print(f"    Subtotal Printer Cost for this printer line: €{cost_for_this_printer_line:.4f}")

    total_cogs_for_job += current_printer_cost_total
    print(f"Running Total after Printers: €{total_cogs_for_job:.4f}")

    # 3. Packaging Cost Component
    packaging_c = job.packaging_cost_eur or 0.0
    total_cogs_for_job += packaging_c
    print(f"Packaging Cost for Job: €{packaging_c:.2f}")
    print(f"Total COGS before final rounding: €{total_cogs_for_job:.4f}")
    
    final_cogs = round(total_cogs_for_job, 2)
    print(f"Final Calculated COGS (rounded): €{final_cogs:.2f}")
    print(f"--- End COGS Calculation for Job ID: {job.id} ---")
    return final_cogs


# Helper function to deduct filament inventory for a print job
def _deduct_filament_for_print_job(job: models.PrintJob, db: Session) -> dict:
    """
    Deducts the filament used for a print job from the inventory.
    Returns a dictionary with information about updated filaments.
    """
    result = {
        "success": True,
        "updated_filaments": [],
        "errors": []
    }
    
    # Track filament usage across all products in the job
    filament_usage_by_id = {}  # {filament_id: total_kg_used}
    
    for job_product_item in job.products:
        product = db.get(models.Product, job_product_item.product_id)
        if not product:
            result["errors"].append(f"Product ID {job_product_item.product_id} not found")
            continue
            
        for filament_usage in product.filament_usages:
            filament_id = filament_usage.filament_id
            # Convert grams to kg and multiply by number of items in this job
            kg_used = (filament_usage.grams_used / 1000.0) * job_product_item.items_qty
            
            if filament_id in filament_usage_by_id:
                filament_usage_by_id[filament_id] += kg_used
            else:
                filament_usage_by_id[filament_id] = kg_used
    
    # Now update each filament's inventory
    for filament_id, kg_used in filament_usage_by_id.items():
        filament = db.get(models.Filament, filament_id)
        if not filament:
            result["errors"].append(f"Filament ID {filament_id} not found")
            continue
            
        # Check if we have enough inventory
        if filament.total_qty_kg < kg_used:
            result["errors"].append(f"Insufficient inventory for filament {filament.color} {filament.material} (ID: {filament_id}). " +
                                   f"Required: {kg_used:.3f}kg, Available: {filament.total_qty_kg:.3f}kg")
            result["success"] = False
            continue
            
        # Update the inventory
        old_qty = filament.total_qty_kg
        filament.total_qty_kg = max(0, old_qty - kg_used)  # Ensure we don't go below zero
        
        result["updated_filaments"].append({
            "id": filament_id,
            "color": filament.color,
            "material": filament.material,
            "previous_qty": old_qty,
            "kg_used": kg_used,
            "new_qty": filament.total_qty_kg
        })
    
    return result


# Helper function to return filament to inventory
def _return_filament_to_inventory(job: models.PrintJob, db: Session) -> dict:
    """
    Returns the filament used by a print job back to inventory.
    Used when updating or deleting a print job.
    """
    result = {
        "success": True,
        "updated_filaments": [],
        "errors": []
    }
    
    # Track filament usage across all products in the job
    filament_usage_by_id = {}  # {filament_id: total_kg_used}
    
    for job_product_item in job.products:
        product = db.get(models.Product, job_product_item.product_id)
        if not product:
            result["errors"].append(f"Product ID {job_product_item.product_id} not found")
            continue
            
        for filament_usage in product.filament_usages:
            filament_id = filament_usage.filament_id
            # Convert grams to kg and multiply by number of items in this job
            kg_used = (filament_usage.grams_used / 1000.0) * job_product_item.items_qty
            
            if filament_id in filament_usage_by_id:
                filament_usage_by_id[filament_id] += kg_used
            else:
                filament_usage_by_id[filament_id] = kg_used
    
    # Now update each filament's inventory
    for filament_id, kg_used in filament_usage_by_id.items():
        filament = db.get(models.Filament, filament_id)
        if not filament:
            result["errors"].append(f"Filament ID {filament_id} not found")
            continue
            
        # Add the quantity back to inventory
        old_qty = filament.total_qty_kg
        filament.total_qty_kg = old_qty + kg_used
        
        result["updated_filaments"].append({
            "id": filament_id,
            "color": filament.color,
            "material": filament.material,
            "previous_qty": old_qty,
            "kg_returned": kg_used,
            "new_qty": filament.total_qty_kg
        })
    
    return result


# ---------- Print Jobs ---------- #

@app.post("/print_jobs", response_model=schemas.PrintJobRead, status_code=status.HTTP_201_CREATED)
def create_print_job(job_data: schemas.PrintJobCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Create print job object but don't commit yet
    db_job = models.PrintJob(name=job_data.name, packaging_cost_eur=job_data.packaging_cost_eur, status=job_data.status)
    db.add(db_job)
    db.flush()  # This gives us the job ID but doesn't commit the transaction
    
    # add associations
    assoc_products = [models.PrintJobProduct(print_job_id=db_job.id, product_id=it.product_id, items_qty=it.items_qty) for it in job_data.products]
    assoc_printers = [models.PrintJobPrinter(print_job_id=db_job.id, printer_profile_id=it.printer_profile_id, printers_qty=it.printers_qty, hours_each=it.hours_each) for it in job_data.printers]
    db.add_all(assoc_products + assoc_printers)
    db.flush()  # This makes the associations available without committing
    
    # Check and deduct filament inventory
    filament_result = _deduct_filament_for_print_job(db_job, db)
    if not filament_result["success"]:
        # If we don't have enough inventory, abort the transaction and return error
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Print Job not found")
    
    # Return used filament to inventory
    _return_filament_to_inventory(job, db)
    
    # Delete the job
    db.delete(job)
    db.commit()
    return

@app.patch("/print_jobs/{print_job_id}", response_model=schemas.PrintJobRead)
def update_print_job(print_job_id: uuid.UUID, job_update_data: schemas.PrintJobUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_job = db.get(models.PrintJob, print_job_id)
    if not db_job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Print Job not found")

    # Save original product associations for inventory adjustments
    original_products = []
    if "products" in job_update_data.model_dump(exclude_unset=True):
        # Capture original product associations for inventory calculation
        original_products = [
            {"product_id": item.product_id, "items_qty": item.items_qty}
            for item in db_job.products
        ]

    update_fields = job_update_data.model_dump(exclude_unset=True)

    if "name" in update_fields:
        db_job.name = update_fields["name"]
    if "packaging_cost_eur" in update_fields:
        db_job.packaging_cost_eur = update_fields["packaging_cost_eur"]
    if "status" in update_fields:
        db_job.status = update_fields["status"]

    # If products array supplied, replace rows
    new_products_data = None
    if "products" in update_fields:
        new_products_data = update_fields["products"]
        # Delete old associations but don't commit yet
        db.query(models.PrintJobProduct).filter(models.PrintJobProduct.print_job_id == db_job.id).delete()
        # Create new associations
        db.add_all([
            models.PrintJobProduct(print_job_id=db_job.id, product_id=it.product_id, items_qty=it.items_qty)
            for it in update_fields["products"]
        ])

    # printers array
    if "printers" in update_fields:
        db.query(models.PrintJobPrinter).filter(models.PrintJobPrinter.print_job_id == db_job.id).delete()
        db.add_all([
            models.PrintJobPrinter(print_job_id=db_job.id, printer_profile_id=it.printer_profile_id, printers_qty=it.printers_qty, hours_each=it.hours_each)
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