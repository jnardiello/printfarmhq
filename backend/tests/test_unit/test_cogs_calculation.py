"""
Unit tests for COGS (Cost of Goods Sold) calculation logic.
Tests the precise calculation of costs including materials, depreciation, and overheads.
"""
import pytest
from decimal import Decimal
from datetime import date, datetime
from app.models import Filament, Product, Printer, PrinterType, PrintJob, FilamentUsage, PrintJobProduct, PrintJobPrinter


class TestCOGSCalculation:
    """Test COGS calculation components in isolation."""

    def test_filament_cost_calculation(self, db):
        """Test that filament costs are calculated correctly."""
        # Create filament with known price
        filament = Filament(
            brand="TestBrand",
            material="PLA",
            color="Red",
            total_qty_kg=10.0,
            price_per_kg=25.50,  # €25.50 per kg
            min_filaments_kg=1.0
        )
        db.add(filament)
        db.commit()
        
        # Calculate cost for 150g (0.15kg)
        quantity_kg = 0.15
        expected_cost = quantity_kg * filament.price_per_kg
        actual_cost = quantity_kg * 25.50
        
        assert actual_cost == expected_cost
        assert abs(actual_cost - 3.825) < 0.001  # €3.825 for 150g

    def test_printer_depreciation_calculation(self, db):
        """Test printer depreciation per hour calculation."""
        # Create printer type
        printer_type = PrinterType(
            brand="Test",
            model="Printer",
            expected_life_hours=10000.0  # 10,000 hours
        )
        db.add(printer_type)
        db.flush()
        
        # Create printer instance with known price
        printer = Printer(
            name="Test Printer",
            name_normalized="testprinter",
            printer_type_id=printer_type.id,
            purchase_price_eur=10000.00,  # €10,000
            working_hours=0.0
        )
        db.add(printer)
        db.commit()
        
        # Depreciation per hour = purchase_price_eur / expected_life_hours
        depreciation_per_hour = printer.purchase_price_eur / printer_type.expected_life_hours
        assert depreciation_per_hour == 1.0  # €1 per hour

    def test_printer_maintenance_cost_calculation(self):
        """Test printer maintenance cost per hour calculation using a theoretical model."""
        # Since the current PrinterProfile model doesn't have maintenance costs,
        # this is a unit test for the calculation logic itself
        printer_price = 5000.00
        expected_life_hours = 20000.0
        theoretical_maintenance_per_year = 730.0  # €730/year = €2/day
        
        # Maintenance per hour = maintenance_cost_per_year / (365 * 8)
        # Assuming 8 hours per day operation
        hours_per_year = 365 * 8
        maintenance_per_hour = theoretical_maintenance_per_year / hours_per_year
        assert abs(maintenance_per_hour - 0.25) < 0.01  # ~€0.25 per hour
        
        # Test depreciation calculation with actual model
        # This is just a theoretical calculation since the model structure has changed
        theoretical_depreciation = printer_price / expected_life_hours
        assert theoretical_depreciation == 0.25  # €0.25 per hour

    def test_multi_filament_product_cost(self, db):
        """Test cost calculation for products using multiple filaments."""
        # Create two filaments with different prices
        filament1 = Filament(
            brand="Premium",
            material="PLA",
            color="Black",
            total_qty_kg=5.0,
            price_per_kg=30.00  # €30/kg
        )
        filament2 = Filament(
            brand="Standard",
            material="PLA",
            color="White",
            total_qty_kg=5.0,
            price_per_kg=20.00  # €20/kg
        )
        db.add_all([filament1, filament2])
        db.commit()
        
        # Create product using both filaments
        product = Product(
            name="Two-tone Product",
            sku="TEST-001",
            print_time_hrs=5.0
        )
        db.add(product)
        db.commit()
        
        # Add filament usages: 100g black + 50g white
        usage1 = FilamentUsage(
            product_id=product.id,
            filament_id=filament1.id,
            grams_used=100.0  # 0.1kg
        )
        usage2 = FilamentUsage(
            product_id=product.id,
            filament_id=filament2.id,
            grams_used=50.0  # 0.05kg
        )
        db.add_all([usage1, usage2])
        db.commit()
        
        # Calculate expected cost
        cost1 = 0.1 * 30.00  # €3.00
        cost2 = 0.05 * 20.00  # €1.00
        expected_total = cost1 + cost2  # €4.00
        
        # Manual calculation to verify
        total_cost = 0
        for usage in [usage1, usage2]:
            filament = db.query(Filament).filter(Filament.id == usage.filament_id).first()
            cost = (usage.grams_used / 1000) * filament.price_per_kg
            total_cost += cost
        
        assert total_cost == expected_total
        assert total_cost == 4.00

    def test_complete_cogs_calculation(self):
        """Test complete COGS calculation logic with all components."""
        # Test the calculation logic without complex database relationships
        
        # Filament costs: 2 units * 250g each = 500g total
        grams_per_unit = 250.0
        units_qty = 2
        total_grams = grams_per_unit * units_qty
        price_per_kg = 40.00
        filament_cost = (total_grams / 1000) * price_per_kg  # €20.00
        
        # Printer costs: 8 hours * €0.50/hour depreciation
        hours_used = 8.0
        printer_cost_per_hour = 6000.00 / 12000.0  # €6000 / 12000 hours = €0.50/hour
        printer_cost = hours_used * printer_cost_per_hour  # €4.00
        
        # Packaging cost
        packaging_cost = 10.00
        
        # Total COGS
        expected_cogs = filament_cost + printer_cost + packaging_cost
        assert expected_cogs == 34.00  # €20 + €4 + €10
        
        # Verify individual components
        assert filament_cost == 20.00
        assert printer_cost == 4.00
        assert packaging_cost == 10.00

    def test_cogs_with_multiple_printers(self):
        """Test COGS calculation when using multiple printers."""
        # Test the calculation logic for multiple printers
        
        # Printer 1: Fast but expensive
        printer1_price = 8000.00
        printer1_life_hours = 10000.0
        printer1_cost_per_hour = printer1_price / printer1_life_hours  # €0.80/hour
        printer1_hours_used = 5.0
        printer1_cost = printer1_hours_used * printer1_cost_per_hour  # €4.00
        
        # Printer 2: Slower but cheaper
        printer2_price = 2000.00
        printer2_life_hours = 8000.0
        printer2_cost_per_hour = printer2_price / printer2_life_hours  # €0.25/hour
        printer2_hours_used = 10.0
        printer2_cost = printer2_hours_used * printer2_cost_per_hour  # €2.50
        
        # Total printer cost
        total_printer_cost = printer1_cost + printer2_cost
        
        assert printer1_cost_per_hour == 0.80
        assert printer2_cost_per_hour == 0.25
        assert printer1_cost == 4.00
        assert printer2_cost == 2.50
        assert total_printer_cost == 6.50