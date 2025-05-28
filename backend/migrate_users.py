#!/usr/bin/env python3
"""
HISTORICAL MIGRATION SCRIPT - DO NOT DELETE

This script was used to migrate the User table from Google OAuth to local authentication.
It is preserved for historical reference and documentation purposes.

Migration performed:
1. Drop the google_id and picture columns
2. Add the hashed_password column
3. Delete all existing users (they needed to re-register)

Date: Part of the transition from Google OAuth to local authentication
Note: This migration has already been applied to production systems.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the app directory to the path so we can import our modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import SQLALCHEMY_DATABASE_URL as DATABASE_URL

def migrate_users():
    """Migrate users table from Google OAuth to local auth"""
    engine = create_engine(DATABASE_URL)
    
    with engine.begin() as conn:
        print("Starting user table migration...")
        
        # First, delete all existing users
        print("Deleting all existing users...")
        conn.execute(text("DELETE FROM users"))
        
        # Drop the old columns
        print("Dropping google_id column...")
        try:
            conn.execute(text("ALTER TABLE users DROP COLUMN google_id"))
        except Exception as e:
            print(f"Warning: Could not drop google_id column: {e}")
        
        print("Dropping picture column...")
        try:
            conn.execute(text("ALTER TABLE users DROP COLUMN picture"))
        except Exception as e:
            print(f"Warning: Could not drop picture column: {e}")
        
        # Add the hashed_password column
        print("Adding hashed_password column...")
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN hashed_password VARCHAR NOT NULL DEFAULT ''"))
        except Exception as e:
            print(f"Warning: Could not add hashed_password column: {e}")
            print("This might be expected if the column already exists.")
        
        print("User table migration completed successfully!")
        print("All users have been deleted and will need to re-register with the new local auth system.")

if __name__ == "__main__":
    migrate_users()