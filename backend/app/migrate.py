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
            # Create the table with new schema
            conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    filename TEXT NOT NULL,
                    up_sql TEXT,
                    down_sql TEXT
                )
            """)
            
            # Check if we need to migrate existing schema_migrations table
            cursor = conn.execute("PRAGMA table_info(schema_migrations)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'up_sql' not in columns:
                print("🔄 Upgrading schema_migrations table...")
                conn.execute("ALTER TABLE schema_migrations ADD COLUMN up_sql TEXT")
                conn.execute("ALTER TABLE schema_migrations ADD COLUMN down_sql TEXT")
                print("✅ Schema_migrations table upgraded")
            
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

    def parse_migration_content(self, migration_content: str) -> tuple[str, str]:
        """Parse migration content into up and down sections."""
        # Split migration content by -- UP and -- DOWN markers
        lines = migration_content.split('\n')
        up_sql = []
        down_sql = []
        current_section = 'up'  # Default to up section
        
        for line in lines:
            line_stripped = line.strip().upper()
            if line_stripped.startswith('-- UP') or line_stripped.startswith('--UP'):
                current_section = 'up'
                continue
            elif line_stripped.startswith('-- DOWN') or line_stripped.startswith('--DOWN'):
                current_section = 'down'
                continue
            
            if current_section == 'up':
                up_sql.append(line)
            elif current_section == 'down':
                down_sql.append(line)
        
        return '\n'.join(up_sql).strip(), '\n'.join(down_sql).strip()

    def execute_migration(self, migration_file: Path) -> None:
        """Execute a single migration file (up direction)."""
        version = self.extract_version_from_filename(migration_file.name)
        if not version:
            raise ValueError(f"Invalid migration filename: {migration_file.name}")

        print(f"Applying migration: {migration_file.name}")
        
        # Read and parse migration content
        migration_content = migration_file.read_text(encoding='utf-8')
        up_sql, down_sql = self.parse_migration_content(migration_content)
        
        if not up_sql:
            print(f"⚠️  No UP migration found in {migration_file.name}")
            return
        
        # Execute migration in a transaction
        with sqlite3.connect(self.db_path) as conn:
            try:
                # Execute the up migration SQL
                conn.executescript(up_sql)
                
                # Store both up and down SQL for potential rollback
                conn.execute(
                    "INSERT INTO schema_migrations (version, filename, up_sql, down_sql) VALUES (?, ?, ?, ?)",
                    (version, migration_file.name, up_sql, down_sql)
                )
                conn.commit()
                print(f"✅ Successfully applied migration: {migration_file.name}")
                
            except Exception as e:
                conn.rollback()
                print(f"❌ Failed to apply migration {migration_file.name}: {e}")
                raise

    def revert_migration(self, version: str) -> None:
        """Revert a single migration by version."""
        print(f"Reverting migration: {version}")
        
        with sqlite3.connect(self.db_path) as conn:
            # Get the migration details
            cursor = conn.execute(
                "SELECT filename, down_sql FROM schema_migrations WHERE version = ?",
                (version,)
            )
            row = cursor.fetchone()
            
            if not row:
                raise ValueError(f"Migration {version} not found in applied migrations")
            
            filename, down_sql = row
            
            if not down_sql or down_sql.strip() == '':
                raise ValueError(f"No DOWN migration found for {filename}. Cannot revert.")
            
            try:
                # Execute the down migration SQL
                conn.executescript(down_sql)
                
                # Remove migration from applied migrations
                conn.execute(
                    "DELETE FROM schema_migrations WHERE version = ?",
                    (version,)
                )
                conn.commit()
                print(f"✅ Successfully reverted migration: {filename}")
                
            except Exception as e:
                conn.rollback()
                print(f"❌ Failed to revert migration {filename}: {e}")
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

    def revert_migrations(self, count: int = 1, dry_run: bool = False) -> int:
        """Revert the last N migrations."""
        print(f"🔄 Reverting last {count} migration(s)...")
        
        # Ensure migrations table exists
        self.ensure_migrations_table()
        
        # Get applied migrations in reverse order
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT version, filename FROM schema_migrations ORDER BY version DESC LIMIT ?",
                (count,)
            )
            migrations_to_revert = cursor.fetchall()
        
        if not migrations_to_revert:
            print("✅ No migrations to revert.")
            return 0

        print(f"📋 Will revert {len(migrations_to_revert)} migration(s):")
        for version, filename in migrations_to_revert:
            print(f"  - {filename} ({version})")

        if dry_run:
            print("🔍 Dry run mode - no migrations will be reverted.")
            return 0

        # Revert migrations in reverse order
        reverted_count = 0
        for version, filename in migrations_to_revert:
            try:
                self.revert_migration(version)
                reverted_count += 1
            except Exception as e:
                print(f"💥 Revert failed: {e}")
                return 1

        print(f"🎉 Successfully reverted {reverted_count} migration(s)!")
        return 0

    def revert_to_version(self, target_version: str, dry_run: bool = False) -> int:
        """Revert migrations to a specific version (exclusive)."""
        print(f"🔄 Reverting migrations to version {target_version}...")
        
        # Ensure migrations table exists
        self.ensure_migrations_table()
        
        # Get migrations to revert (all versions > target_version)
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT version, filename FROM schema_migrations WHERE version > ? ORDER BY version DESC",
                (target_version,)
            )
            migrations_to_revert = cursor.fetchall()
        
        if not migrations_to_revert:
            print(f"✅ Already at or before version {target_version}. No migrations to revert.")
            return 0

        print(f"📋 Will revert {len(migrations_to_revert)} migration(s):")
        for version, filename in migrations_to_revert:
            print(f"  - {filename} ({version})")

        if dry_run:
            print("🔍 Dry run mode - no migrations will be reverted.")
            return 0

        # Revert migrations
        reverted_count = 0
        for version, filename in migrations_to_revert:
            try:
                self.revert_migration(version)
                reverted_count += 1
            except Exception as e:
                print(f"💥 Revert failed: {e}")
                return 1

        print(f"🎉 Successfully reverted to version {target_version}!")
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

-- UP: Apply the migration
-- Add your forward migration SQL here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     name TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE INDEX IF NOT EXISTS idx_example_name ON example_table(name);

-- DOWN: Revert the migration
-- Add your rollback migration SQL here
-- Example:
-- DROP INDEX IF EXISTS idx_example_name;
-- DROP TABLE IF EXISTS example_table;
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
        choices=["migrate", "list", "create", "revert", "revert-to"],
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
        "--count",
        type=int,
        default=1,
        help="Number of migrations to revert (for 'revert' command)"
    )
    parser.add_argument(
        "--version",
        help="Target version for revert-to command"
    )
    parser.add_argument(
        "--db-path",
        help="Path to database file (optional, defaults to app database)"
    )
    
    args = parser.parse_args()
    
    if args.command == "create" and not args.description:
        print("❌ Error: --description is required for 'create' command")
        return 1
    
    if args.command == "revert-to" and not args.version:
        print("❌ Error: --version is required for 'revert-to' command")
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
        elif args.command == "revert":
            return runner.revert_migrations(count=args.count, dry_run=args.dry_run)
        elif args.command == "revert-to":
            return runner.revert_to_version(target_version=args.version, dry_run=args.dry_run)
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())