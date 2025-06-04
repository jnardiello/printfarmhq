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
    created_at: datetime
    updated_at: Optional[datetime] = None


class FilamentStatistics(BaseModel):
    filament: FilamentRead
    products_using: int
    purchases_count: int


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
    additional_parts_cost: float = Field(default=0.0, ge=0)
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
    created_at: datetime
    updated_at: Optional[datetime] = None

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
    additional_parts_cost: Optional[float] = Field(None, ge=0)
    license_id: Optional[int] = None




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
    created_at: datetime
    updated_at: Optional[datetime] = None


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


class FilamentPurchaseUpdate(BaseModel):
    """Update schema for filament purchases"""
    filament_id: Optional[int] = None
    quantity_kg: Optional[float] = Field(None, gt=0)
    price_per_kg: Optional[float] = Field(None, gt=0)
    purchase_date: Optional[date] = None
    channel: Optional[str] = None
    notes: Optional[str] = None


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
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    price_eur: float = Field(..., ge=0)
    expected_life_hours: float = Field(..., gt=0)


class PrinterProfileCreate(PrinterProfileBase):
    working_hours: float = Field(default=0.0, ge=0)


class PrinterProfileRead(PrinterProfileBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    working_hours: float = Field(default=0.0, ge=0)
    life_left_hours: Optional[float] = None
    life_percentage: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class PrinterProfileUpdate(BaseModel):
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    price_eur: Optional[float] = Field(None, ge=0)
    expected_life_hours: Optional[float] = Field(None, gt=0)
    working_hours: Optional[float] = Field(None, ge=0)


class PrinterUsageHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    printer_profile_id: int
    print_job_id: UUID
    hours_used: float
    printers_qty: int
    created_at: datetime
    week_year: int
    month_year: int
    quarter_year: int


class PrinterUsageStats(BaseModel):
    period: str  # 'week', 'month', or 'quarter'
    period_key: int  # YYYYWW, YYYYMM, or YYYYQ
    period_label: str  # Human-readable label
    hours_used: float
    print_count: int
    

class PrinterUsageStatsResponse(BaseModel):
    printer_id: int
    printer_name: str
    stats: List[PrinterUsageStats]
    total_working_hours: float
    life_left_hours: float
    life_percentage: float


class PrinterProfileUpdate(BaseModel):
    """Update schema for printer profiles"""
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    price_eur: Optional[float] = Field(None, ge=0)
    expected_life_hours: Optional[float] = Field(None, gt=0)


class JobProductItem(BaseModel):
    product_id: int
    items_qty: int = Field(..., gt=0)


class JobPrinterItem(BaseModel):
    printer_profile_id: int
    printers_qty: int = Field(..., gt=0)
    hours_each: float = Field(default=0.0, ge=0)  # No longer required, calculated from products


class JobProductRead(BaseModel):
    """Read schema for print job products with nested product details"""
    model_config = ConfigDict(from_attributes=True)
    
    product_id: int
    items_qty: int
    product: Optional["ProductRead"] = None


class JobPrinterRead(BaseModel):
    """Read schema for print job printers with stored printer data"""
    model_config = ConfigDict(from_attributes=True)
    
    printer_profile_id: Optional[int] = None
    printers_qty: int
    hours_each: float
    # Stored printer data
    printer_name: Optional[str] = None
    printer_manufacturer: Optional[str] = None
    printer_model: Optional[str] = None
    printer_price_eur: Optional[float] = None
    printer_expected_life_hours: Optional[float] = None


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


class PrintJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: Optional[str] = None
    products: List[JobProductRead]
    printers: List[JobPrinterRead]
    packaging_cost_eur: float
    status: str
    calculated_cogs_eur: Optional[float] = None
    started_at: Optional[datetime] = None
    estimated_completion_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class PrintJobStatusUpdate(BaseModel):
    """Update schema for print job status only"""
    status: str = Field(..., examples=["pending", "in_progress", "completed", "failed"])


class PrintJobStart(BaseModel):
    """Schema for starting a print job"""
    pass  # No additional fields needed, just triggers the start action


# User and Auth schemas
class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    name: str
    is_active: bool
    is_admin: bool
    is_superadmin: bool
    is_god_user: bool
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
    god_user_required: bool = False


class TenantRegistrationRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)
    company_name: str = Field(..., min_length=1)


class PublicRegistrationRequest(BaseModel):
    """Schema for public registration - simpler than tenant registration"""
    email: EmailStr
    name: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)


class UserSelfUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None


# God Dashboard schemas
class GodDashboardStats(BaseModel):
    total_superadmins: int
    total_users: int
    total_team_members: int


class GodUserHierarchy(BaseModel):
    superadmin: UserRead
    team_members: List[UserRead]


class GodUserSelectionRequest(BaseModel):
    user_id: int


# God User Management schemas
class GodUserUpdate(BaseModel):
    """Schema for god user to update any user"""
    name: Optional[str] = Field(None, min_length=1)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_superadmin: Optional[bool] = None


class GodPasswordReset(BaseModel):
    """Schema for god user to reset user password"""
    new_password: str = Field(..., min_length=8, description="New password for the user")


class GodPasswordResetResponse(BaseModel):
    """Response for password reset"""
    message: str
    temporary_password: Optional[str] = None


class GodUserActionResponse(BaseModel):
    """Response for god user actions"""
    message: str
    user: Optional[UserRead] = None


# Manual Password Reset schemas (god user approval workflow)
class PasswordResetRequestCreate(BaseModel):
    """Schema for user requesting password reset"""
    email: EmailStr


class PasswordResetRequestRead(BaseModel):
    """Schema for reading password reset requests (god dashboard)"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    status: str
    requested_at: datetime
    processed_at: Optional[datetime] = None
    processed_by_user_id: Optional[int] = None
    notes: Optional[str] = None


class PasswordResetRequestProcess(BaseModel):
    """Schema for god user processing password reset request"""
    action: str = Field(..., pattern="^(approve|reject)$")  # approve or reject
    notes: Optional[str] = None
    new_password: Optional[str] = Field(None, min_length=8)  # Required if action is approve


class PasswordResetRequestResponse(BaseModel):
    """Response for password reset request submission"""
    message: str
    request_id: int


# God Admin Metrics schemas
class DailyMetric(BaseModel):
    """Base schema for daily metrics"""
    date: date
    total_count: int


class DailyUserMetric(DailyMetric):
    """Daily user creation metrics with breakdown"""
    superadmins: int
    regular_users: int


class DailyProductMetric(DailyMetric):
    """Daily product creation metrics"""
    pass


class DailyPrintJobMetric(DailyMetric):
    """Daily print job creation metrics"""
    pass


class GodMetricsSummary(BaseModel):
    """Combined metrics response for God Admin dashboard"""
    users: List[DailyUserMetric]
    products: List[DailyProductMetric]
    print_jobs: List[DailyPrintJobMetric]


# Enhanced God Admin Metrics schemas
class ActiveUserMetric(BaseModel):
    """Daily Active Users (DAU), Weekly Active Users (WAU), Monthly Active Users (MAU)"""
    date: date
    daily_active_users: int
    weekly_active_users: int
    monthly_active_users: int
    new_vs_returning: dict  # {"new": 5, "returning": 15}


class UserEngagementMetric(BaseModel):
    """User engagement and behavior patterns"""
    date: date
    total_logins: int
    unique_users_logged_in: int
    avg_actions_per_user: float
    peak_hour: Optional[int] = None  # 0-23
    feature_usage: dict  # {"prints": 50, "products": 30, "filaments": 20}


class BusinessMetric(BaseModel):
    """Business intelligence metrics"""
    date: date
    total_filament_consumed_g: float
    avg_print_time_hrs: float
    print_success_rate: float
    top_products: List[dict]  # [{"name": "Product A", "count": 10}]
    top_filaments: List[dict]  # [{"name": "PLA Red", "usage_g": 500}]


class RetentionMetric(BaseModel):
    """User retention cohort analysis"""
    cohort_date: date
    cohort_size: int
    retention_1_day: Optional[float] = None  # percentage
    retention_7_day: Optional[float] = None
    retention_30_day: Optional[float] = None


class UserFunnelMetric(BaseModel):
    """User journey funnel metrics"""
    date: date
    signups: int
    first_logins: int
    first_products: int
    first_prints: int
    avg_signup_to_login_hrs: Optional[float] = None
    avg_login_to_product_hrs: Optional[float] = None
    avg_product_to_print_hrs: Optional[float] = None


class UserActivityRead(BaseModel):
    """Schema for reading user activity logs"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    activity_type: str
    activity_timestamp: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    activity_metadata: Optional[str] = None  # JSON string


class EnhancedGodMetricsSummary(BaseModel):
    """Enhanced metrics response with all new metrics"""
    # Existing metrics
    users: List[DailyUserMetric]
    products: List[DailyProductMetric]
    print_jobs: List[DailyPrintJobMetric]
    
    # New comprehensive metrics
    active_users: List[ActiveUserMetric]
    engagement: List[UserEngagementMetric]
    business: List[BusinessMetric]
    retention: List[RetentionMetric]
    funnel: List[UserFunnelMetric]
    
    # Summary statistics
    summary: dict  # High-level KPIs


# Update forward references
JobProductRead.model_rebuild()
JobPrinterRead.model_rebuild()