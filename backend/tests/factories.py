"""
Factory classes for generating test data.
"""
import factory
from factory.alchemy import SQLAlchemyModelFactory
from datetime import datetime

from app.models import User, Filament, Product, PrinterProfile, PrintJob, Subscription, FilamentPurchase, FilamentUsage


class UserFactory(SQLAlchemyModelFactory):
    class Meta:
        model = User
        sqlalchemy_session_persistence = "commit"

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    name = factory.Faker("name")
    hashed_password = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"  # secret
    is_admin = False
    is_superadmin = False
    token_version = 0


class FilamentFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Filament
        sqlalchemy_session_persistence = "commit"

    brand = factory.Faker("company")
    material = factory.Faker("random_element", elements=["PLA", "PETG", "ABS", "TPU"])
    color = factory.Faker("color_name")
    total_qty_kg = factory.Faker("pyfloat", min_value=0, max_value=10, right_digits=2)
    price_per_kg = factory.Faker("pyfloat", min_value=15, max_value=50, right_digits=2)
    min_filaments_kg = 1.0


class ProductFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Product
        sqlalchemy_session_persistence = "commit"

    sku = factory.Sequence(lambda n: f"PROD-{n:04d}")
    name = factory.Faker("catch_phrase")
    print_time_hours = factory.Faker("pyfloat", min_value=0.5, max_value=24, right_digits=1)
    model_file = None
    subscription_id = None
    cost_of_production = factory.Faker("pyfloat", min_value=1, max_value=50, right_digits=2)


class PrinterProfileFactory(SQLAlchemyModelFactory):
    class Meta:
        model = PrinterProfile
        sqlalchemy_session_persistence = "commit"

    name = factory.Sequence(lambda n: f"Printer {n}")
    price_eur = factory.Faker("pyfloat", min_value=200, max_value=5000, right_digits=2)
    expected_life_hours = factory.Faker("random_int", min=5000, max=20000)


class SubscriptionFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Subscription
        sqlalchemy_session_persistence = "commit"

    creator_name = factory.Faker("name")
    creator_website = factory.Faker("url")
    price_eur = factory.Faker("pyfloat", min_value=5, max_value=50, right_digits=2)
    active = True


class FilamentPurchaseFactory(SQLAlchemyModelFactory):
    class Meta:
        model = FilamentPurchase
        sqlalchemy_session_persistence = "commit"

    filament_id = None  # Must be set explicitly
    quantity_kg = factory.Faker("pyfloat", min_value=0.5, max_value=5, right_digits=2)
    price_per_kg = factory.Faker("pyfloat", min_value=15, max_value=50, right_digits=2)
    supplier = factory.Faker("company")
    purchase_date = factory.Faker("date_between", start_date="-1y", end_date="today")
    notes = factory.Faker("sentence")


class PrintJobFactory(SQLAlchemyModelFactory):
    class Meta:
        model = PrintJob
        sqlalchemy_session_persistence = "commit"

    job_name = factory.Sequence(lambda n: f"Job-{n:04d}")
    created_at = factory.LazyFunction(datetime.utcnow)
    cogs = factory.Faker("pyfloat", min_value=5, max_value=100, right_digits=2)
    packaging_cost = factory.Faker("pyfloat", min_value=0.5, max_value=5, right_digits=2)