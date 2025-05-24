from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./hq.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- simple migration helper for SQLite ---

def _ensure_columns():
    with engine.connect() as conn:
        res = conn.execute(text("PRAGMA table_info(filaments)"))
        cols = [row[1] for row in res.fetchall()]
        if "total_qty_kg" not in cols:
            conn.execute(text("ALTER TABLE filaments ADD COLUMN total_qty_kg FLOAT DEFAULT 0.0"))
        if "price_per_kg" not in cols and "avg_price_per_kg" in cols:
            # rename old column if present (SQLite lacks rename column prior v3.25; fallback: add new column)
            conn.execute(text("ALTER TABLE filaments ADD COLUMN price_per_kg FLOAT DEFAULT 0.0"))
        elif "price_per_kg" not in cols:
            conn.execute(text("ALTER TABLE filaments ADD COLUMN price_per_kg FLOAT DEFAULT 0.0"))
        if "min_filaments_kg" not in cols:
            conn.execute(text("ALTER TABLE filaments ADD COLUMN min_filaments_kg FLOAT"))

        # purchases table extra columns
        res_p = conn.execute(text("PRAGMA table_info(filament_purchases)"))
        pcols = [row[1] for row in res_p.fetchall()]
        if "channel" not in pcols:
            conn.execute(text("ALTER TABLE filament_purchases ADD COLUMN channel TEXT"))
        if "notes" not in pcols:
            conn.execute(text("ALTER TABLE filament_purchases ADD COLUMN notes TEXT"))

        # products table extra columns
        res_prod = conn.execute(text("PRAGMA table_info(products)"))
        prod_cols = [row[1] for row in res_prod.fetchall()]
        if "print_time_hrs" not in prod_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN print_time_hrs FLOAT DEFAULT 0.0"))
        if "printer_profile_id" not in prod_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN printer_profile_id INTEGER"))
        if "sku" not in prod_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN sku TEXT"))

        # users table extra columns
        res_users = conn.execute(text("PRAGMA table_info(users)"))
        user_cols = [row[1] for row in res_users.fetchall()]
        if "is_admin" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
        if "is_superadmin" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_superadmin BOOLEAN DEFAULT 0"))
        if "token_version" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1"))

        # products table: migrate model_file to file_path to avoid Pydantic namespace conflict
        res_prod_check = conn.execute(text("PRAGMA table_info(products)"))
        prod_check_cols = [row[1] for row in res_prod_check.fetchall()]
        if "model_file" in prod_check_cols:
            # Add file_path column if it doesn't exist
            if "file_path" not in prod_check_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN file_path TEXT"))
                conn.execute(text("UPDATE products SET file_path = model_file"))
            
            # Drop and recreate table without model_file column to avoid Pydantic warnings
            # This is safe because we're copying all data
            
            # Clean up any existing products_new table from failed migration
            conn.execute(text("DROP TABLE IF EXISTS products_new"))
            
            conn.execute(text("""
                CREATE TABLE products_new (
                    id INTEGER NOT NULL,
                    sku VARCHAR NOT NULL,
                    name VARCHAR NOT NULL,
                    print_time_hrs FLOAT NOT NULL,
                    filament_weight_g FLOAT NOT NULL,
                    license_id INTEGER,
                    printer_profile_id INTEGER,
                    file_path TEXT,
                    PRIMARY KEY (id),
                    FOREIGN KEY(license_id) REFERENCES subscriptions (id)
                )
            """))
            
            # Copy data from old table to new table
            conn.execute(text("""
                INSERT INTO products_new (id, sku, name, print_time_hrs, filament_weight_g, license_id, printer_profile_id, file_path)
                SELECT id, sku, name, print_time_hrs, filament_weight_g, license_id, printer_profile_id, 
                       COALESCE(file_path, model_file) as file_path
                FROM products
            """))
            
            # Drop old table and rename new one
            conn.execute(text("DROP TABLE products"))
            conn.execute(text("ALTER TABLE products_new RENAME TO products"))
            
            # Recreate indexes
            conn.execute(text("CREATE INDEX ix_products_id ON products (id)"))
            conn.execute(text("CREATE UNIQUE INDEX ix_products_sku ON products (sku)"))
            
            print("Migrated products table: removed model_file column, kept file_path")

# _ensure_columns will be called after tables are created 