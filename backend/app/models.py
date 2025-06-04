from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Table, DateTime, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship, foreign
from sqlalchemy.dialects.postgresql import UUID # For UUID type if using PostgreSQL
import uuid # For generating UUIDs
from sqlalchemy.sql import func # For server-side default timestamp

from .database import Base


class AppConfig(Base):
    __tablename__ = "app_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_superadmin = Column(Boolean, default=False)
    is_god_user = Column(Boolean, default=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    token_version = Column(Integer, default=1, nullable=False)
    
    # Activity tracking fields
    last_login = Column(DateTime(timezone=True), nullable=True, index=True)
    last_activity = Column(DateTime(timezone=True), nullable=True, index=True)
    login_count = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Self-referential relationship for team members
    created_by = relationship("User", remote_side=[id], backref="team_members")
    
    @property
    def owner_id(self):
        """Get the owner_id for this user (super-admin who owns the data)"""
        if self.is_god_user:
            return None  # God user has no owner
        elif self.is_superadmin:
            return self.id  # Super-admin owns their own data
        else:
            return self.created_by_user_id  # Team member's data belongs to their super-admin


class UserActivity(Base):
    __tablename__ = "user_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    activity_type = Column(String(50), nullable=False, index=True)
    activity_timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6 compatible
    user_agent = Column(String, nullable=True)
    activity_metadata = Column(String, nullable=True)  # JSON stored as string in SQLite

    # Relationship
    user = relationship("User", backref="activities")


class Filament(Base):
    __tablename__ = "filaments"

    id = Column(Integer, primary_key=True, index=True)
    color = Column(String, nullable=False)
    brand = Column(String, nullable=False)
    material = Column(String, nullable=False)
    price_per_kg = Column(Float, nullable=False, default=0.0)  # weighted average EUR/kg
    total_qty_kg = Column(Float, nullable=False, default=0.0)
    min_filaments_kg = Column(Float, nullable=True)  # Minimum threshold for low stock alert
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    products = relationship("Product", secondary="filament_usages", viewonly=True)
    purchases = relationship(
        "FilamentPurchase",
        back_populates="filament",
        cascade="all, delete-orphan",
    )
    owner = relationship("User", foreign_keys=[owner_id])
    
    __table_args__ = (
        UniqueConstraint('color', 'brand', 'material', 'owner_id', name='_color_brand_material_owner_uc'),
    )


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)

    print_time_hrs = Column(Float, nullable=False, default=0.0)
    additional_parts_cost = Column(Float, nullable=False, default=0.0)

    # legacy single-filament weight (kept for not-null constraint)
    filament_weight_g = Column(Float, nullable=False, default=0.0)

    license_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    file_path = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Filament usage relationship
    filament_usages = relationship("FilamentUsage", back_populates="product", cascade="all, delete-orphan")
    owner = relationship("User", foreign_keys=[owner_id])

    @property
    def cop(self) -> float:
        """Compute Cost of Product (filament costs + additional parts cost)."""
        filament_cost = sum(
            (fu.grams_used / 1000.0) * fu.filament.price_per_kg for fu in self.filament_usages if fu.filament
        )
        total_cost = filament_cost + (self.additional_parts_cost or 0.0)
        return round(total_cost, 2)

    @property
    def total_print_time_hrs(self) -> float:
        """Return the product's print time."""
        return round(self.print_time_hrs, 2)




class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    platform = Column(String, nullable=False, default="No Platform")
    vendor = Column(String, nullable=True)  # kept for backward compatibility
    license_uri = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)  # nullable when ongoing
    price_eur = Column(Float, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    owner = relationship("User", foreign_keys=[owner_id])


class FilamentPurchase(Base):
    __tablename__ = "filament_purchases"

    id = Column(Integer, primary_key=True, index=True)
    filament_id = Column(Integer, ForeignKey("filaments.id"), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)
    purchase_date = Column(Date, nullable=True)
    channel = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    filament = relationship("Filament", back_populates="purchases")
    owner = relationship("User", foreign_keys=[owner_id])


# Association table for multi-filament usage per product


class FilamentUsage(Base):
    __tablename__ = "filament_usages"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    filament_id = Column(Integer, ForeignKey("filaments.id"))
    grams_used = Column(Float, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    product = relationship("Product", back_populates="filament_usages")
    filament = relationship("Filament")
    owner = relationship("User", foreign_keys=[owner_id])




class PrinterType(Base):
    __tablename__ = "printer_types"

    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String, nullable=False)
    model = Column(String, nullable=False)
    expected_life_hours = Column(Float, nullable=False, default=10000.0)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    printers = relationship("Printer", back_populates="printer_type", cascade="all, delete-orphan")
    owner = relationship("User", foreign_keys=[owner_id])
    
    # Unique constraint handled at database level
    __table_args__ = (
        UniqueConstraint('brand', 'model', 'owner_id', name='_brand_model_owner_uc'),
    )


class Printer(Base):
    """Renamed from PrinterProfile - represents actual printer instances"""
    __tablename__ = "printers"

    id = Column(Integer, primary_key=True, index=True)
    printer_type_id = Column(Integer, ForeignKey("printer_types.id"), nullable=False)
    name = Column(String, nullable=False)  # Custom name like "Prusa 1", "Prusa 2"
    name_normalized = Column(String, nullable=False)  # Lowercase, trimmed for uniqueness check
    purchase_price_eur = Column(Float, nullable=False, default=0.0)
    purchase_date = Column(Date, nullable=True)
    working_hours = Column(Float, nullable=False, default=0.0)
    status = Column(String, nullable=False, default="idle")  # idle, printing, maintenance, offline
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    printer_type = relationship("PrinterType", back_populates="printers")
    print_jobs = relationship("PrintJobPrinter", 
                            primaryjoin="Printer.id == foreign(PrintJobPrinter.printer_profile_id)",
                            viewonly=True)
    owner = relationship("User", foreign_keys=[owner_id])
    usage_history = relationship("PrinterUsageHistory", back_populates="printer", cascade="all, delete-orphan")

    @property
    def life_left_hours(self) -> float:
        """Calculate remaining lifetime hours based on printer type."""
        if self.printer_type:
            return max(0, self.printer_type.expected_life_hours - self.working_hours)
        return 0

    @property
    def life_percentage(self) -> float:
        """Calculate remaining lifetime as percentage."""
        if self.printer_type and self.printer_type.expected_life_hours > 0:
            return (self.life_left_hours / self.printer_type.expected_life_hours) * 100
        return 0
    
    __table_args__ = (
        UniqueConstraint('name_normalized', 'owner_id', name='_printer_name_normalized_owner_uc'),
    )


# Keep backward compatibility alias
PrinterProfile = Printer


class PrintJobProduct(Base):
    __tablename__ = "print_job_products"

    id = Column(Integer, primary_key=True)
    print_job_id = Column(UUID(as_uuid=True), ForeignKey("print_jobs.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    items_qty = Column(Integer, nullable=False, default=1)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    product = relationship("Product")
    owner = relationship("User", foreign_keys=[owner_id])


class PrintJobPrinter(Base):
    __tablename__ = "print_job_printers"

    id = Column(Integer, primary_key=True)
    print_job_id = Column(UUID(as_uuid=True), ForeignKey("print_jobs.id"), nullable=False)
    printer_profile_id = Column(Integer, nullable=True)  # Legacy field, still named printer_profile_id in DB
    printer_type_id = Column(Integer, ForeignKey("printer_types.id"), nullable=True)  # Type selected during job creation
    assigned_printer_id = Column(Integer, ForeignKey("printers.id"), nullable=True)  # Actual printer assigned when started
    hours_each = Column(Float, nullable=False, default=0.0)
    
    # Stored printer data at time of print job creation (for historical purposes)
    printer_name = Column(String, nullable=True)
    printer_manufacturer = Column(String, nullable=True)
    printer_model = Column(String, nullable=True)
    printer_price_eur = Column(Float, nullable=True)
    printer_expected_life_hours = Column(Float, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Relationships
    printer_type = relationship("PrinterType")
    assigned_printer = relationship("Printer", foreign_keys=[assigned_printer_id])
    # Legacy relationship for backward compatibility (using printer_profile_id column)
    printer = relationship("Printer", 
                          primaryjoin="foreign(PrintJobPrinter.printer_profile_id) == Printer.id",
                          viewonly=True)
    owner = relationship("User", foreign_keys=[owner_id])


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=True)

    packaging_cost_eur = Column(Float, nullable=False, default=0.0)

    calculated_cogs_eur = Column(Float, nullable=True)
    
    printer_type_id = Column(Integer, ForeignKey("printer_types.id"), nullable=True)  # For COGS calculation

    status = Column(String, nullable=False, default="pending")  # pending, printing, completed, failed
    started_at = Column(DateTime(timezone=True), nullable=True)
    estimated_completion_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    products = relationship("PrintJobProduct", cascade="all, delete-orphan")
    printers = relationship("PrintJobPrinter", cascade="all, delete-orphan")
    printer_type = relationship("PrinterType")
    owner = relationship("User", foreign_keys=[owner_id])


class PrinterUsageHistory(Base):
    __tablename__ = "printer_usage_history"

    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id", ondelete="CASCADE"), nullable=False)
    print_job_id = Column(UUID(as_uuid=True), ForeignKey("print_jobs.id", ondelete="CASCADE"), nullable=False)
    hours_used = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Denormalized fields for faster aggregation
    week_year = Column(Integer, nullable=False)  # Format: YYYYWW
    month_year = Column(Integer, nullable=False)  # Format: YYYYMM
    quarter_year = Column(Integer, nullable=False)  # Format: YYYYQ
    
    # Relationships
    printer = relationship("Printer", back_populates="usage_history")
    print_job = relationship("PrintJob")


class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="pending")  # pending, approved, rejected
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    processed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(String, nullable=True)  # Optional notes from god user

    processed_by = relationship("User", foreign_keys=[processed_by_user_id])
