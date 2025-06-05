#!/usr/bin/env python3
"""Setup test data for e2e tests"""

import os
import sys

# Add the app directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import Base, User
from app.auth import get_password_hash
from sqlalchemy.orm import Session


def setup_test_data():
    """Create test data for e2e tests"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if superadmin already exists
        existing_admin = db.query(User).filter(User.email == "admin@printfarmhq.com").first()
        if not existing_admin:
            # Create superadmin user
            admin_user = User(
                email="admin@printfarmhq.com",
                hashed_password=get_password_hash("admin123"),
                name="Admin User",
                is_active=True,
                is_admin=True,
                is_superadmin=True,
                is_god_user=False,
                token_version=1
            )
            db.add(admin_user)
            db.commit()
            print("✅ Test superadmin user created")
        else:
            print("ℹ️  Test superadmin user already exists")
            
    finally:
        db.close()


if __name__ == "__main__":
    setup_test_data()