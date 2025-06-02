from datetime import date, datetime
from typing import Optional, Literal, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, EmailStr, computed_field
from .utils.time_parser import format_hours_display


class FilamentBase(BaseModel):
    color: str = Field(..., examples=["Black"])
    brand: str = Field(..., examples=["ESUN"])
    material: str = Field(..., examples=["PETG"])
    # price is computed from purchases; optional on create


class FilamentCreate(FilamentBase):
    price_per_kg: float = Field(default=0.0, ge=0)
    total_qty_kg: float = Field(default=0.0, ge=0)


class FilamentRead(FilamentBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    price_per_kg: float
    total_qty_kg: float
    min_filaments_kg: Optional[float] = None


# FilamentUsage nested (depends on FilamentRead)
class FilamentUsageCreate(BaseModel):
    filament_id: int
    grams_used: float = Field(..., gt=0)


class FilamentUsageRead(FilamentUsageCreate):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    filament: FilamentRead # Depends on FilamentRead


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
    filament_usages: Optional[List[FilamentUsageRead]] = None  # Legacy - will be deprecated
    plates: Optional[List["PlateRead"]] = None  # New plate-based structure

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    
    @computed_field
    @property
    def print_time_formatted(self) -> str:
        """Return print time in human-readable format."""
        return format_hours_display(self.print_time_hrs)


class ProductUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    name: Optional[str] = None
    print_time_hrs: Optional[float] = Field(None, ge=0)
    license_id: Optional[int] = None


# Plate schemas
class PlateFilamentUsageCreate(BaseModel):
    filament_id: int
    grams_used: float = Field(..., gt=0)


class PlateFilamentUsageRead(PlateFilamentUsageCreate):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    filament: FilamentRead


class PlateBase(BaseModel):
    name: str
    quantity: int = Field(..., ge=1)
    print_time_hrs: float = Field(..., ge=0)
    file_path: Optional[str] = None
    gcode_path: Optional[str] = None


class PlateCreate(PlateBase):
    filament_usages: List[PlateFilamentUsageCreate] = Field(..., min_length=1)


class PlateRead(PlateBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    cost: float
    filament_usages: List[PlateFilamentUsageRead] = []
    
    @computed_field
    @property
    def print_time_formatted(self) -> str:
        """Return print time in human-readable format."""
        return format_hours_display(self.print_time_hrs)


class PlateUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=1)
    print_time_hrs: Optional[float] = Field(None, ge=0)
    file_path: Optional[str] = None
    gcode_path: Optional[str] = None
    filament_usages: Optional[List[PlateFilamentUsageCreate]] = None


class SubscriptionBase(BaseModel):
    name: str
    platform: Literal["Thangs", "Patreon", "No Platform"] = "No Platform"
    license_uri: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    price_eur: Optional[float] = None


class SubscriptionCreate(SubscriptionBase):
    pass


class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    platform: Optional[Literal["Thangs", "Patreon", "No Platform"]] = None
    license_uri: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    price_eur: Optional[float] = None


class SubscriptionRead(SubscriptionBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int


class FilamentPurchaseCreate(BaseModel):
    filament_id: int
    quantity_kg: float = Field(..., gt=0)
    price_per_kg: float = Field(..., gt=0)
    purchase_date: Optional[date] = None
    channel: Optional[str] = None
    notes: Optional[str] = None


class FilamentMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    color: str
    brand: str
    material: str


class FilamentPurchaseRead(FilamentPurchaseCreate):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    filament: FilamentMini


class FilamentPurchaseData(BaseModel):
    """Purchase data for flexible filament creation"""
    quantity_kg: float = Field(..., gt=0)
    price_per_kg: float = Field(..., gt=0)
    purchase_date: Optional[date] = None
    purchase_channel: Optional[str] = None
    notes: Optional[str] = None


class FilamentFlexibleCreate(BaseModel):
    """Create filament with optional inventory tracking"""
    color: str = Field(..., examples=["Black"])
    brand: str = Field(..., examples=["ESUN"]) 
    material: str = Field(..., examples=["PETG"])
    estimated_cost_per_kg: float = Field(..., gt=0, description="Average cost used for COGS calculation")
    create_purchase: bool = Field(False, description="Whether to create initial inventory")
    purchase_data: Optional[FilamentPurchaseData] = None


class FilamentFlexibleResponse(BaseModel):
    """Response for flexible filament creation"""
    filament: FilamentRead
    purchase: Optional[FilamentPurchaseRead] = None
    message: str
    warnings: List[str] = []


class FilamentUpdate(BaseModel):
    color: Optional[str] = None
    brand: Optional[str] = None
    material: Optional[str] = None
    price_per_kg: Optional[float] = None
    total_qty_kg: Optional[float] = None
    min_filaments_kg: Optional[float] = None


class PrinterProfileBase(BaseModel):
    name: str
    price_eur: float = Field(..., ge=0)
    expected_life_hours: float = Field(..., gt=0)


class PrinterProfileCreate(PrinterProfileBase):
    pass


class PrinterProfileRead(PrinterProfileBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int


class JobProductItem(BaseModel):
    product_id: int
    items_qty: int = Field(..., gt=0)


class JobPrinterItem(BaseModel):
    printer_profile_id: int
    printers_qty: int = Field(..., gt=0)
    hours_each: float = Field(default=0.0, ge=0)  # No longer required, calculated from products


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
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    calculated_cogs_eur: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# User and Auth schemas
class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    name: str
    is_active: bool
    is_admin: bool
    is_superadmin: bool
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)
    is_admin: bool = False
    is_superadmin: bool = False


class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class SetupRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)


class SetupStatusResponse(BaseModel):
    setup_required: bool


class UserSelfUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None