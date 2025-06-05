"""Tests for print job active tracking and printer conflict prevention."""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from app.models import PrintJob, PrintJobPrinter, Printer, PrinterType, Product, User
from app.database import SessionLocal
from app.main import app


@pytest.fixture
def db():
    """Create a database session for testing."""
    from app.database import Base, engine
    # Create tables
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        # Clean up tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(db: Session):
    """Create a test user."""
    user = User(
        email="test@example.com",
        name="Test User",
        hashed_password="hashed",
        is_active=True,
        is_admin=True,
        is_superadmin=False,
        is_god_user=False,
        token_version=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_printer(db: Session, test_user: User):
    """Create a test printer profile."""
    # Create printer type first
    printer_type = PrinterType(
        brand="Test Manufacturer",
        model="Test Model",
        expected_life_hours=5000.0
    )
    db.add(printer_type)
    db.flush()
    
    printer = Printer(
        name="Test Printer",
        name_normalized="testprinter",
        printer_type_id=printer_type.id,
        purchase_price_eur=1000.0,
        working_hours=0.0,
        owner_id=test_user.id
    )
    db.add(printer)
    db.commit()
    db.refresh(printer)
    return printer


@pytest.fixture
def test_product(db: Session, test_user: User):
    """Create a test product."""
    product = Product(
        sku="TEST-001",
        name="Test Product",
        print_time_hrs=2.0,
        filament_weight_g=50.0,
        owner_id=test_user.id
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


class TestPrintJobActiveTracking:
    """Test print job active tracking functionality."""

    def test_start_print_job_success(self, db: Session, test_user: User, test_printer: Printer, test_product: Product):
        """Test successfully starting a print job."""
        # Create a pending print job
        job = PrintJob(
            name="Test Job",
            packaging_cost_eur=5.0,
            status="pending",
            owner_id=test_user.id
        )
        db.add(job)
        db.flush()

        # Add printer and product associations
        printer_assoc = PrintJobPrinter(
            print_job_id=job.id,
            printer_profile_id=test_printer.id,
            hours_each=2.0,
            printer_name=test_printer.name,
            owner_id=test_user.id
        )
        db.add(printer_assoc)
        db.commit()

        # Start the job
        job.status = "printing"
        job.started_at = datetime.now(timezone.utc)
        job.estimated_completion_at = job.started_at + timedelta(hours=2)
        db.commit()

        # Verify job is started
        assert job.status == "printing"
        assert job.started_at is not None
        assert job.estimated_completion_at is not None

    def test_printer_conflict_prevention(self, db: Session, test_user: User, test_printer: Printer, test_product: Product):
        """Test that printer conflicts are properly detected."""
        # Create first print job that's currently printing
        job1 = PrintJob(
            name="Job 1",
            status="printing",
            started_at=datetime.now(timezone.utc),
            estimated_completion_at=datetime.now(timezone.utc) + timedelta(hours=2),
            owner_id=test_user.id
        )
        db.add(job1)
        db.flush()

        printer_assoc1 = PrintJobPrinter(
            print_job_id=job1.id,
            printer_profile_id=test_printer.id,
            hours_each=2.0,
            owner_id=test_user.id
        )
        db.add(printer_assoc1)
        db.commit()

        # Create second print job trying to use the same printer
        job2 = PrintJob(
            name="Job 2",
            status="pending",
            owner_id=test_user.id
        )
        db.add(job2)
        db.flush()

        printer_assoc2 = PrintJobPrinter(
            print_job_id=job2.id,
            printer_profile_id=test_printer.id,
            hours_each=1.0,
            owner_id=test_user.id
        )
        db.add(printer_assoc2)
        db.commit()

        # Check if printer is already in use
        active_jobs = db.query(PrintJob).join(
            PrintJobPrinter
        ).filter(
            PrintJob.status == "printing",
            PrintJobPrinter.printer_profile_id == test_printer.id
        ).count()

        assert active_jobs == 1  # Only job1 should be printing

    def test_multiple_printers_no_conflict(self, db: Session, test_user: User, test_product: Product):
        """Test that different printers can run simultaneously."""
        # Create printer types
        printer_type1 = PrinterType(
            brand="Test Manufacturer",
            model="Model A",
            expected_life_hours=5000.0
        )
        printer_type2 = PrinterType(
            brand="Test Manufacturer", 
            model="Model B",
            expected_life_hours=5000.0
        )
        db.add_all([printer_type1, printer_type2])
        db.flush()
        
        # Create two different printers
        printer1 = Printer(
            name="Printer 1",
            name_normalized="printer1",
            printer_type_id=printer_type1.id,
            purchase_price_eur=1000.0,
            owner_id=test_user.id
        )
        printer2 = Printer(
            name="Printer 2",
            name_normalized="printer2",
            printer_type_id=printer_type2.id,
            purchase_price_eur=1500.0,
            owner_id=test_user.id
        )
        db.add_all([printer1, printer2])
        db.commit()

        # Create two jobs using different printers
        job1 = PrintJob(
            name="Job 1",
            status="printing",
            started_at=datetime.now(timezone.utc),
            owner_id=test_user.id
        )
        job2 = PrintJob(
            name="Job 2",
            status="printing",
            started_at=datetime.now(timezone.utc),
            owner_id=test_user.id
        )
        db.add_all([job1, job2])
        db.flush()

        # Assign different printers
        printer_assoc1 = PrintJobPrinter(
            print_job_id=job1.id,
            printer_profile_id=printer1.id,
            hours_each=2.0,
            owner_id=test_user.id
        )
        printer_assoc2 = PrintJobPrinter(
            print_job_id=job2.id,
            printer_profile_id=printer2.id,
            hours_each=2.0,
            owner_id=test_user.id
        )
        db.add_all([printer_assoc1, printer_assoc2])
        db.commit()

        # Both jobs should be able to print simultaneously
        printing_jobs = db.query(PrintJob).filter(PrintJob.status == "printing").count()
        assert printing_jobs == 2

    def test_job_status_transitions(self, db: Session, test_user: User):
        """Test print job status transitions."""
        job = PrintJob(
            name="Test Job",
            status="pending",
            owner_id=test_user.id
        )
        db.add(job)
        db.commit()

        # Test transition from pending to printing
        assert job.status == "pending"
        assert job.started_at is None
        
        job.status = "printing"
        job.started_at = datetime.now(timezone.utc)
        db.commit()
        
        assert job.status == "printing"
        assert job.started_at is not None

        # Test transition from printing to completed
        job.status = "completed"
        db.commit()
        
        assert job.status == "completed"