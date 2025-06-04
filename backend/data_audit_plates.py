#!/usr/bin/env python3
"""
Data audit script to analyze plate usage before migration.
This script will help us understand the current state and plan the migration.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

def get_database_url():
    """Get database URL from environment or use SQLite default"""
    return os.getenv('DATABASE_URL', 'sqlite:///./hq.db')

def run_audit():
    """Run comprehensive data audit for plates migration"""
    
    engine = create_engine(get_database_url())
    Session = sessionmaker(bind=engine)
    session = Session()
    
    print("=== PLATES MIGRATION DATA AUDIT ===\n")
    
    try:
        # 1. Count total products
        result = session.execute(text("SELECT COUNT(*) FROM products"))
        total_products = result.scalar()
        print(f"Total products in database: {total_products}")
        
        # 2. Count products with plates
        result = session.execute(text("""
            SELECT COUNT(DISTINCT product_id) 
            FROM plates
        """))
        products_with_plates = result.scalar()
        print(f"Products using plates system: {products_with_plates}")
        
        # 3. Count products with legacy filament_usages
        result = session.execute(text("""
            SELECT COUNT(DISTINCT product_id) 
            FROM filament_usages
        """))
        products_with_legacy = result.scalar()
        print(f"Products using legacy system: {products_with_legacy}")
        
        # 4. Check for products using BOTH systems
        result = session.execute(text("""
            SELECT COUNT(DISTINCT p.id) 
            FROM products p
            WHERE p.id IN (SELECT DISTINCT product_id FROM plates)
            AND p.id IN (SELECT DISTINCT product_id FROM filament_usages)
        """))
        products_with_both = result.scalar()
        print(f"Products using BOTH systems: {products_with_both}")
        
        # 5. Products with neither system
        products_with_neither = total_products - products_with_plates - products_with_legacy + products_with_both
        print(f"Products with no filament data: {products_with_neither}")
        
        print("\n=== DETAILED PLATE ANALYSIS ===")
        
        # 6. Total plates count
        result = session.execute(text("SELECT COUNT(*) FROM plates"))
        total_plates = result.scalar()
        print(f"Total plates: {total_plates}")
        
        # 7. Products with multiple plates
        result = session.execute(text("""
            SELECT product_id, COUNT(*) as plate_count
            FROM plates 
            GROUP BY product_id 
            HAVING COUNT(*) > 1
            ORDER BY plate_count DESC
            LIMIT 10
        """))
        multi_plate_products = result.fetchall()
        print(f"\nProducts with multiple plates (showing top 10):")
        for product_id, count in multi_plate_products:
            print(f"  Product {product_id}: {count} plates")
        
        # 8. Plate quantities analysis
        result = session.execute(text("""
            SELECT quantity, COUNT(*) as count
            FROM plates 
            GROUP BY quantity 
            ORDER BY quantity
        """))
        plate_quantities = result.fetchall()
        print(f"\nPlate quantities distribution:")
        for qty, count in plate_quantities:
            print(f"  Quantity {qty}: {count} plates")
        
        # 9. Total filament usage records
        result = session.execute(text("SELECT COUNT(*) FROM plate_filament_usages"))
        total_plate_usages = result.scalar()
        print(f"\nTotal plate filament usage records: {total_plate_usages}")
        
        result = session.execute(text("SELECT COUNT(*) FROM filament_usages"))
        total_legacy_usages = result.scalar()
        print(f"Total legacy filament usage records: {total_legacy_usages}")
        
        # 10. Sample data for validation
        print("\n=== SAMPLE DATA FOR VALIDATION ===")
        
        # Sample product with plates
        result = session.execute(text("""
            SELECT p.id, p.name, p.sku, p.additional_parts_cost,
                   COUNT(pl.id) as plate_count,
                   SUM(pl.quantity * pfu.grams_used) as total_grams
            FROM products p
            JOIN plates pl ON p.id = pl.product_id
            LEFT JOIN plate_filament_usages pfu ON pl.id = pfu.plate_id
            GROUP BY p.id, p.name, p.sku, p.additional_parts_cost
            LIMIT 3
        """))
        sample_products = result.fetchall()
        print("Sample products with plates:")
        for product in sample_products:
            print(f"  ID: {product[0]}, Name: {product[1]}, SKU: {product[2]}")
            print(f"    Plates: {product[4]}, Total grams: {product[5] or 0}")
        
        # 11. Check for file attachments
        result = session.execute(text("""
            SELECT COUNT(*) FROM plates WHERE file_path IS NOT NULL
        """))
        plates_with_files = result.scalar()
        
        result = session.execute(text("""
            SELECT COUNT(*) FROM plates WHERE gcode_path IS NOT NULL
        """))
        plates_with_gcode = result.scalar()
        
        print(f"\nPlates with file attachments: {plates_with_files}")
        print(f"Plates with gcode files: {plates_with_gcode}")
        
        # 12. Migration impact summary
        print("\n=== MIGRATION IMPACT SUMMARY ===")
        print(f"✓ {products_with_plates} products will be migrated from plates to legacy system")
        print(f"✓ {total_plates} plate records will be consolidated")
        print(f"✓ {total_plate_usages} plate filament usage records will be converted")
        if plates_with_files > 0:
            print(f"⚠ WARNING: {plates_with_files} plates have file attachments that will be lost")
        if plates_with_gcode > 0:
            print(f"⚠ WARNING: {plates_with_gcode} plates have gcode files that will be lost")
        if products_with_both > 0:
            print(f"⚠ WARNING: {products_with_both} products use both systems - needs manual review")
        
    except Exception as e:
        print(f"Error during audit: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    run_audit()