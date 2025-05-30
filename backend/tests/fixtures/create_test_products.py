#!/usr/bin/env python3
"""Create test products for e2e tests"""

import os
import sys
import json

# Add the app directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database import SessionLocal
from app.models import Filament, Product, FilamentUsage, Plate, PlateFilamentUsage
from sqlalchemy.orm import Session


def create_test_products():
    """Create test products with plates"""
    db = SessionLocal()
    try:
        # First ensure we have a test filament
        filament = db.query(Filament).first()
        if not filament:
            # Create a test filament
            filament = Filament(
                color="Black",
                brand="Test Brand",
                material="PLA",
                total_qty_kg=10.0,
                price_per_kg=20.0
            )
            db.add(filament)
            db.commit()
            print("✅ Created test filament")
        
        # Check if test product already exists
        test_product = db.query(Product).filter(Product.name == "Test Product for Nested Dialog").first()
        if not test_product:
            # Create a test product
            test_product = Product(
                name="Test Product for Nested Dialog",
                sku="TEST-NESTED-001",
                print_time_hrs=2.0,
                filament_weight_g=100.0
            )
            db.add(test_product)
            db.flush()
            
            # Add filament usage
            filament_usage = FilamentUsage(
                product_id=test_product.id,
                filament_id=filament.id,
                grams_used=100.0
            )
            db.add(filament_usage)
            
            # Create a default plate
            plate = Plate(
                product_id=test_product.id,
                name="Main Plate",
                quantity=1,
                print_time_hrs=2.0
            )
            db.add(plate)
            db.flush()
            
            # Add plate filament usage
            plate_usage = PlateFilamentUsage(
                plate_id=plate.id,
                filament_id=filament.id,
                grams_used=100.0
            )
            db.add(plate_usage)
            
            db.commit()
            print("✅ Created test product with plate")
        else:
            print("ℹ️  Test product already exists")
            
    finally:
        db.close()


if __name__ == "__main__":
    create_test_products()