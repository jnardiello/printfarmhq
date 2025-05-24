from datetime import date, datetime
from typing import Optional, Literal, List
from uuid import UUID

from pydantic import BaseModel, Field


class FilamentBase(BaseModel):
    color: str = Field(..., examples=["Black"])
    brand: str = Field(..., examples=["ESUN"])
    material: str = Field(..., examples=["PETG"])
    # price is computed from purchases; optional on create


class FilamentCreate(FilamentBase):
    pass  # no additional fields


class FilamentRead(FilamentBase):
    id: int
    price_per_kg: float
    total_qty_kg: float
    min_filaments_kg: Optional[float] = None

    class Config:
        from_attributes = True


# FilamentUsage nested (depends on FilamentRead)
class FilamentUsageCreate(BaseModel):
    filament_id: int
    grams_used: float = Field(..., gt=0)


class FilamentUsageRead(FilamentUsageCreate):
    id: int
    filament: FilamentRead # Depends on FilamentRead

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    name: str
    print_time_hrs: float = Field(..., ge=0)
    license_id: Optional[int] = None
    file_path: Optional[str] = None


class ProductCreate(ProductBase):
    filament_usages: list[dict]  # will be parsed later


class ProductRead(ProductBase):
    id: int
    cop: Optional[float] = None
    sku: str
    license_id: Optional[int] = None
    file_path: Optional[str] = None
    filament_usages: Optional[List[FilamentUsageRead]] = None

    class Config:
        from_attributes = True
        protected_namespaces = ()


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    print_time_hrs: Optional[float] = Field(None, ge=0)
    license_id: Optional[int] = None

    class Config:
        from_attributes = True


class SubscriptionBase(BaseModel):
    name: str
    platform: Literal["Thangs", "Patreon", "No Platform"] = "No Platform"
    license_uri: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    price_eur: Optional[float] = None


class SubscriptionCreate(SubscriptionBase):
    pass


class SubscriptionRead(SubscriptionBase):
    id: int

    class Config:
        from_attributes = True


class FilamentPurchaseCreate(BaseModel):
    filament_id: int
    quantity_kg: float = Field(..., gt=0)
    price_per_kg: float = Field(..., gt=0)
    purchase_date: Optional[date] = None
    channel: Optional[str] = None
    notes: Optional[str] = None


class FilamentMini(BaseModel):
    id: int
    color: str
    brand: str
    material: str

    class Config:
        from_attributes = True


class FilamentPurchaseRead(FilamentPurchaseCreate):
    id: int
    filament: FilamentMini # Note: This was FilamentMini, if ProductRead needs full FilamentRead for usages, this might need alignment too.
                           # However, FilamentUsageRead uses FilamentRead, which is good.
    class Config:
        from_attributes = True


class FilamentUpdate(BaseModel):
    total_qty_kg: Optional[float] = None
    min_filaments_kg: Optional[float] = None


class PrinterProfileBase(BaseModel):
    name: str
    price_eur: float = Field(..., ge=0)
    expected_life_hours: float = Field(..., gt=0)


class PrinterProfileCreate(PrinterProfileBase):
    pass


class PrinterProfileRead(PrinterProfileBase):
    id: int

    class Config:
        from_attributes = True


class JobProductItem(BaseModel):
    product_id: int
    items_qty: int = Field(..., gt=0)


class JobPrinterItem(BaseModel):
    printer_profile_id: int
    printers_qty: int = Field(..., gt=0)
    hours_each: float = Field(..., gt=0)


# PrintJob Schemas (depends on ProductRead and PrinterProfileRead)
class PrintJobBase(BaseModel):
    name: Optional[str] = None
    products: List[JobProductItem]
    printers: List[JobPrinterItem]
    packaging_cost_eur: float = Field(0, ge=0)
    status: Optional[str] = Field("pending", examples=["pending","in_progress","completed","failed"])


class PrintJobCreate(PrintJobBase):
    pass


class PrintJobUpdate(BaseModel):
    name: Optional[str] = None
    products: Optional[List[JobProductItem]] = None
    printers: Optional[List[JobPrinterItem]] = None
    packaging_cost_eur: Optional[float] = Field(None, ge=0)
    status: Optional[str] = None


class PrintJobRead(PrintJobBase):
    id: UUID
    calculated_cogs_eur: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# User and Auth schemas
class UserRead(BaseModel):
    id: int
    email: str
    name: str
    is_active: bool
    is_admin: bool
    is_superadmin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    is_admin: bool = False
    is_superadmin: bool = False


class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserLogin(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead 