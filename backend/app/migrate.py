#!/usr/bin/env python3
"""
Database Migration Runner

This script handles database migrations for PrintFarmHQ.
It can be run manually or automatically during deployments.
"""

import os
import sqlite3
import sys
from pathlib import Path
from typing import List, Optional
import re
from datetime import datetime

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import get_database_path


class MigrationRunner:
    def __init__(self, db_path: Optional[str] = None):
        """Initialize the migration runner with database path."""
        self.db_path = db_path or get_database_path()
        self.migrations_dir = Path(__file__).parent.parent / "migrations"
        
    def ensure_migrations_table(self) -> None:
        """Create the schema_migrations table if it doesn't exist."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    filename TEXT NOT NULL
                )
            """)
            conn.commit()

    def get_applied_migrations(self) -> List[str]:
        """Get list of already applied migration versions."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT version FROM schema_migrations ORDER BY version")
            return [row[0] for row in cursor.fetchall()]

    def get_pending_migrations(self) -> List[Path]:
        """Get list of migration files that haven't been applied yet."""
        if not self.migrations_dir.exists():
            return []
            
        # Find all .sql files in migrations directory
        migration_files = list(self.migrations_dir.glob("*.sql"))
        
        # Sort by filename to ensure proper order
        migration_files.sort()
        
        # Filter out already applied migrations
        applied_versions = set(self.get_applied_migrations())
        pending = []
        
        for migration_file in migration_files:
            version = self.extract_version_from_filename(migration_file.name)
            if version and version not in applied_versions:
                pending.append(migration_file)
                
        return pending

    def extract_version_from_filename(self, filename: str) -> Optional[str]:
        """Extract version timestamp from migration filename."""
        # Match pattern: YYYYMMDD_HHMMSS_description.sql
        match = re.match(r'^(\d{8}_\d{6})_.*\.sql$', filename)
        return match.group(1) if match else None

    def validate_migration_filename(self, filename: str) -> bool:
        """Validate that migration filename follows the correct pattern."""
        pattern = r'^\d{8}_\d{6}_[a-z0-9_]+\.sql$'
        return bool(re.match(pattern, filename))

    def execute_migration(self, migration_file: Path) -> None:
        """Execute a single migration file."""
        version = self.extract_version_from_filename(migration_file.name)
        if not version:
            raise ValueError(f"Invalid migration filename: {migration_file.name}")

        print(f"Applying migration: {migration_file.name}")
        
        # Read migration content
        migration_sql = migration_file.read_text(encoding='utf-8')
        
        # Execute migration in a transaction
        with sqlite3.connect(self.db_path) as conn:
            try:
                # Execute the migration SQL
                conn.executescript(migration_sql)
                
                # Record that this migration was applied
                conn.execute(
                    "INSERT INTO schema_migrations (version, filename) VALUES (?, ?)",
                    (version, migration_file.name)
                )
                conn.commit()
                print(f"✅ Successfully applied migration: {migration_file.name}")
                
            except Exception as e:
                conn.rollback()
                print(f"❌ Failed to apply migration {migration_file.name}: {e}")
                raise

    def run_migrations(self, dry_run: bool = False) -> int:
        """Run all pending migrations."""
        print("🔄 Checking for pending database migrations...")
        
        # Ensure migrations table exists
        self.ensure_migrations_table()
        
        # Get pending migrations
        pending_migrations = self.get_pending_migrations()
        
        if not pending_migrations:
            print("✅ No pending migrations found. Database is up to date.")
            return 0

        print(f"📋 Found {len(pending_migrations)} pending migration(s):")
        for migration in pending_migrations:
            print(f"  - {migration.name}")

        if dry_run:
            print("🔍 Dry run mode - no migrations will be executed.")
            return 0

        # Execute migrations
        applied_count = 0
        for migration_file in pending_migrations:
            try:
                self.execute_migration(migration_file)
                applied_count += 1
            except Exception as e:
                print(f"💥 Migration failed: {e}")
                return 1

        print(f"🎉 Successfully applied {applied_count} migration(s)!")
        return 0

    def list_migrations(self) -> None:
        """List all migrations and their status."""
        print("📋 Migration Status:")
        print("-" * 80)
        
        applied_versions = set(self.get_applied_migrations())
        
        if not self.migrations_dir.exists():
            print("No migrations directory found.")
            return
            
        migration_files = list(self.migrations_dir.glob("*.sql"))
        migration_files.sort()
        
        if not migration_files:
            print("No migration files found.")
            return
            
        for migration_file in migration_files:
            version = self.extract_version_from_filename(migration_file.name)
            status = "✅ Applied" if version in applied_versions else "⏳ Pending"
            print(f"{status:12} {migration_file.name}")

    def create_migration(self, description: str) -> Path:
        """Create a new migration file with the given description."""
        # Ensure migrations directory exists
        self.migrations_dir.mkdir(exist_ok=True)
        
        # Generate timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Clean up description (lowercase, replace spaces/special chars with underscores)
        clean_description = re.sub(r'[^a-z0-9_]', '_', description.lower().strip())
        clean_description = re.sub(r'_+', '_', clean_description).strip('_')
        
        # Create filename
        filename = f"{timestamp}_{clean_description}.sql"
        migration_file = self.migrations_dir / filename
        
        # Create migration template
        template = f"""-- {filename}
-- Migration: {description}
-- Created: {datetime.now().isoformat()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     name TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE INDEX IF NOT EXISTS idx_example_name ON example_table(name);
"""
        
        migration_file.write_text(template, encoding='utf-8')
        print(f"📝 Created migration file: {filename}")
        return migration_file


def main():
    """Main entry point for the migration runner."""
    import argparse
    
    parser = argparse.ArgumentParser(description="PrintFarmHQ Database Migration Runner")
    parser.add_argument(
        "command", 
        choices=["migrate", "list", "create"],
        help="Command to execute"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true",
        help="Show what migrations would be applied without executing them"
    )
    parser.add_argument(
        "--description",
        help="Description for new migration (required for 'create' command)"
    )
    parser.add_argument(
        "--db-path",
        help="Path to database file (optional, defaults to app database)"
    )
    
    args = parser.parse_args()
    
    if args.command == "create" and not args.description:
        print("❌ Error: --description is required for 'create' command")
        return 1
    
    runner = MigrationRunner(db_path=args.db_path)
    
    try:
        if args.command == "migrate":
            return runner.run_migrations(dry_run=args.dry_run)
        elif args.command == "list":
            runner.list_migrations()
            return 0
        elif args.command == "create":
            runner.create_migration(args.description)
            return 0
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())