from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Table, DateTime, Boolean
from sqlalchemy.orm import relationship
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
    token_version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Filament(Base):
    __tablename__ = "filaments"

    id = Column(Integer, primary_key=True, index=True)
    color = Column(String, nullable=False)
    brand = Column(String, nullable=False)
    material = Column(String, nullable=False)
    price_per_kg = Column(Float, nullable=False, default=0.0)  # weighted average EUR/kg
    total_qty_kg = Column(Float, nullable=False, default=0.0)
    min_filaments_kg = Column(Float, nullable=True)  # Minimum threshold for low stock alert

    products = relationship("Product", secondary="filament_usages", viewonly=True)
    purchases = relationship(
        "FilamentPurchase",
        back_populates="filament",
        cascade="all, delete-orphan",
    )


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)

    print_time_hrs = Column(Float, nullable=False, default=0.0)

    # legacy single-filament weight (kept for not-null constraint)
    filament_weight_g = Column(Float, nullable=False, default=0.0)

    license_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    file_path = Column(String, nullable=True)

    filament_usages = relationship("FilamentUsage", back_populates="product", cascade="all, delete-orphan")

    @property
    def cop(self) -> float:
        """Compute Cost of Product (sum of filament costs)."""
        cost_fila = sum(
            (fu.grams_used / 1000.0) * fu.filament.price_per_kg for fu in self.filament_usages if fu.filament
        )
        return round(cost_fila, 2)


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


class FilamentPurchase(Base):
    __tablename__ = "filament_purchases"

    id = Column(Integer, primary_key=True, index=True)
    filament_id = Column(Integer, ForeignKey("filaments.id"), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)
    purchase_date = Column(Date, nullable=True)
    channel = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    filament = relationship("Filament", back_populates="purchases")


# Association table for multi-filament usage per product


class FilamentUsage(Base):
    __tablename__ = "filament_usages"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    filament_id = Column(Integer, ForeignKey("filaments.id"))
    grams_used = Column(Float, nullable=False)

    product = relationship("Product", back_populates="filament_usages")
    filament = relationship("Filament")


class PrinterProfile(Base):
    __tablename__ = "printer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price_eur = Column(Float, nullable=False)
    expected_life_hours = Column(Float, nullable=False)

    print_jobs = relationship("PrintJobPrinter", back_populates="printer_profile")


class PrintJobProduct(Base):
    __tablename__ = "print_job_products"

    id = Column(Integer, primary_key=True)
    print_job_id = Column(UUID(as_uuid=True), ForeignKey("print_jobs.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    items_qty = Column(Integer, nullable=False, default=1)

    product = relationship("Product")


class PrintJobPrinter(Base):
    __tablename__ = "print_job_printers"

    id = Column(Integer, primary_key=True)
    print_job_id = Column(UUID(as_uuid=True), ForeignKey("print_jobs.id"), nullable=False)
    printer_profile_id = Column(Integer, ForeignKey("printer_profiles.id"), nullable=False)
    printers_qty = Column(Integer, nullable=False, default=1)
    hours_each = Column(Float, nullable=False, default=0.0)

    printer_profile = relationship("PrinterProfile", back_populates="print_jobs")


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=True)

    packaging_cost_eur = Column(Float, nullable=False, default=0.0)

    calculated_cogs_eur = Column(Float, nullable=True)

    status = Column(String, nullable=False, default="pending")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    products = relationship("PrintJobProduct", cascade="all, delete-orphan")
    printers = relationship("PrintJobPrinter", cascade="all, delete-orphan") 