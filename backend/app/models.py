from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Table, DateTime, Boolean
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

    # Legacy relationship - will be removed after migration
    filament_usages = relationship("FilamentUsage", back_populates="product", cascade="all, delete-orphan")
    
    # New plate-based relationship
    plates = relationship("Plate", back_populates="product", cascade="all, delete-orphan")
    owner = relationship("User", foreign_keys=[owner_id])

    @property
    def cop(self) -> float:
        """Compute Cost of Product (sum of all plate costs + additional parts cost)."""
        # New calculation: sum costs across all plates
        if self.plates:
            filament_cost = sum(plate.cost for plate in self.plates)
            total_cost = filament_cost + (self.additional_parts_cost or 0.0)
            return round(total_cost, 2)
        
        # Fallback to legacy calculation for backward compatibility during migration
        filament_cost = sum(
            (fu.grams_used / 1000.0) * fu.filament.price_per_kg for fu in self.filament_usages if fu.filament
        )
        total_cost = filament_cost + (self.additional_parts_cost or 0.0)
        return round(total_cost, 2)

    @property
    def total_print_time_hrs(self) -> float:
        """Compute total print time (sum of all plate print times * quantities)."""
        # New calculation: sum print times across all plates
        if self.plates:
            total_time = sum(plate.print_time_hrs * plate.quantity for plate in self.plates)
            return round(total_time, 2)
        
        # Fallback to legacy print_time_hrs for backward compatibility during migration
        return round(self.print_time_hrs, 2)


class Plate(Base):
    __tablename__ = "plates"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g., "Base", "Top", "Handle"
    quantity = Column(Integer, nullable=False, default=1)  # How many of this plate per product
    print_time_hrs = Column(Float, nullable=False, default=0.0)  # Print time for this plate
    file_path = Column(String, nullable=True)  # Optional STL/3MF file for this plate
    gcode_path = Column(String, nullable=True)  # Optional G-code file for this plate
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    product = relationship("Product", back_populates="plates")
    filament_usages = relationship("PlateFilamentUsage", back_populates="plate", cascade="all, delete-orphan")
    owner = relationship("User", foreign_keys=[owner_id])

    @property
    def cost(self) -> float:
        """Compute cost of this plate (sum of filament costs * quantity)."""
        filament_cost = sum(
            (fu.grams_used / 1000.0) * fu.filament.price_per_kg 
            for fu in self.filament_usages if fu.filament
        )
        return round(filament_cost * self.quantity, 2)


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


class PlateFilamentUsage(Base):
    __tablename__ = "plate_filament_usages"

    id = Column(Integer, primary_key=True)
    plate_id = Column(Integer, ForeignKey("plates.id"), nullable=False)
    filament_id = Column(Integer, ForeignKey("filaments.id"), nullable=False)
    grams_used = Column(Float, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    plate = relationship("Plate", back_populates="filament_usages")
    filament = relationship("Filament")
    owner = relationship("User", foreign_keys=[owner_id])


class PrinterProfile(Base):
    __tablename__ = "printer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    manufacturer = Column(String, nullable=True)  # New field for printer manufacturer/brand
    model = Column(String, nullable=True)  # New field for printer model
    price_eur = Column(Float, nullable=False)
    expected_life_hours = Column(Float, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Remove back_populates since we don't have a proper foreign key anymore
    print_jobs = relationship("PrintJobPrinter", 
                            primaryjoin="PrinterProfile.id == foreign(PrintJobPrinter.printer_profile_id)",
                            viewonly=True)
    owner = relationship("User", foreign_keys=[owner_id])


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
    printer_profile_id = Column(Integer, nullable=True)  # Now nullable, no foreign key
    printers_qty = Column(Integer, nullable=False, default=1)
    hours_each = Column(Float, nullable=False, default=0.0)
    
    # Stored printer data at time of print job creation
    printer_name = Column(String, nullable=True)
    printer_manufacturer = Column(String, nullable=True)
    printer_model = Column(String, nullable=True)
    printer_price_eur = Column(Float, nullable=True)
    printer_expected_life_hours = Column(Float, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Optional relationship - may be null if printer was deleted
    printer_profile = relationship("PrinterProfile", 
                                 primaryjoin="foreign(PrintJobPrinter.printer_profile_id) == PrinterProfile.id",
                                 viewonly=True)
    owner = relationship("User", foreign_keys=[owner_id])


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=True)

    packaging_cost_eur = Column(Float, nullable=False, default=0.0)

    calculated_cogs_eur = Column(Float, nullable=True)

    status = Column(String, nullable=False, default="pending")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    products = relationship("PrintJobProduct", cascade="all, delete-orphan")
    printers = relationship("PrintJobPrinter", cascade="all, delete-orphan")
    owner = relationship("User", foreign_keys=[owner_id])


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