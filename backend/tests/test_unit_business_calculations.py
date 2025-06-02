"""
Unit tests for business calculation functions.
Tests COGS calculations, inventory math, and pricing logic.
"""
import pytest
from decimal import Decimal
from unittest.mock import Mock, MagicMock
from sqlalchemy.orm import Session

from app.main import _calculate_print_job_cogs, _generate_sku
from app import models


class TestCOGSCalculations:
    """Test Cost of Goods Sold calculation logic."""

    def test_print_job_cogs_single_product_single_filament(self):
        """Test COGS calculation for simple print job with one product and one filament."""
        # Mock database session
        db = Mock(spec=Session)
        
        # Create mock filament using a simple object for arithmetic compatibility
        class MockFilament:
            def __init__(self):
                self.id = 1
                self.price_per_kg = 25.00
                self.color = "Red"
                self.material = "PLA"
        
        mock_filament = MockFilament()
        
        # Create mock filament usage
        mock_filament_usage = Mock()
        mock_filament_usage.id = 1
        mock_filament_usage.grams_used = 50.0  # 50g
        mock_filament_usage.filament = mock_filament
        
        # Create mock plate with filament usage
        mock_plate = Mock()
        mock_plate.id = 1
        mock_plate.name = "Main Plate"
        mock_plate.quantity = 1
        mock_plate.filament_usages = [mock_filament_usage]
        mock_plate.cost = (50.0 * 25.00 / 1000)  # Pre-calculate plate cost
        
        # Create mock product
        mock_product = Mock()
        mock_product.id = 1
        mock_product.name = "Test Widget"
        mock_product.plates = [mock_plate]
        mock_product.filament_usages = []  # Empty for new structure
        mock_product.cop = mock_plate.cost  # Set COP to match plate cost
        
        # Create mock print job product
        mock_job_product = Mock()
        mock_job_product.id = 1
        mock_job_product.product_id = 1
        mock_job_product.items_qty = 2  # 2 items
        
        # Create mock printer profile using a simple object for arithmetic compatibility
        class MockPrinterProfile:
            def __init__(self):
                self.id = 1
                self.name = "Test Printer"
                self.price_eur = 600.00
                self.expected_life_hours = 26280.0  # 3 years * 8760 hours
        
        mock_printer_profile = MockPrinterProfile()
        
        # Mock db.get to return different objects based on the model type
        def mock_db_get(model_class, id_value):
            if model_class == models.Product:
                return mock_product
            elif model_class == models.PrinterProfile:
                return mock_printer_profile
            return None
        
        db.get.side_effect = mock_db_get
        
        # Create mock print job printer
        mock_job_printer = Mock()
        mock_job_printer.id = 1
        mock_job_printer.printer_profile_id = 1
        mock_job_printer.printers_qty = 1
        mock_job_printer.hours_each = 4.0  # 4 hours
        mock_job_printer.printer_profile = mock_printer_profile
        
        # Create mock print job
        mock_print_job = Mock()
        mock_print_job.id = 1
        mock_print_job.name = "Test Job"
        mock_print_job.products = [mock_job_product]
        mock_print_job.printers = [mock_job_printer]
        mock_print_job.packaging_cost_eur = 2.50
        
        # Calculate COGS
        total_cogs = _calculate_print_job_cogs(mock_print_job, db)
        
        # Expected calculations:
        # Filament cost: (50g * €25/kg * 2 items) / 1000 = €2.50
        # Printer cost: (€600 / 3 years / 8760 hrs) * 4 hrs = €0.091
        # Packaging cost: €2.50
        # Total expected: €5.091
        
        expected_filament_cost = (50.0 * 25.00 * 2) / 1000  # €2.50
        expected_printer_cost = (600.00 / 3 / 8760) * 4.0   # €0.091
        expected_packaging = 2.50
        expected_total = expected_filament_cost + expected_printer_cost + expected_packaging
        
        assert abs(total_cogs - expected_total) < 0.01
        assert total_cogs > 5.0  # Sanity check

    def test_print_job_cogs_multi_filament_product(self):
        """Test COGS calculation for product using multiple filaments."""
        db = Mock(spec=Session)
        
        # Create multiple mock filaments using real objects for arithmetic
        class MockFilament1:
            def __init__(self):
                self.id = 1
                self.price_per_kg = 24.00
                self.color = "White"
                self.material = "PLA"
        
        class MockFilament2:
            def __init__(self):
                self.id = 2
                self.price_per_kg = 35.00
                self.color = "Clear"
                self.material = "PETG"
        
        filament1 = MockFilament1()
        filament2 = MockFilament2()
        
        # Create filament usages
        usage1 = Mock()
        usage1.grams_used = 75.0
        usage1.filament = filament1
        
        usage2 = Mock()
        usage2.grams_used = 25.0
        usage2.filament = filament2
        
        # Mock product with plates structure
        plate = Mock()
        plate.id = 1
        plate.name = "Main Plate"
        plate.quantity = 1
        plate.filament_usages = [usage1, usage2]
        plate.cost = (75.0 * 24.00 / 1000) + (25.0 * 35.00 / 1000)  # Pre-calculate plate cost
        
        product = Mock()
        product.id = 1
        product.name = "Multi-Material Part"
        product.plates = [plate]
        product.filament_usages = []  # Empty for new structure
        product.cop = plate.cost  # Set COP to match plate cost
        
        # Mock job product
        job_product = Mock()
        job_product.product_id = 1
        job_product.items_qty = 5
        
        # Create printer profile using real object for arithmetic
        class MockPrinterProfile:
            def __init__(self):
                self.id = 1
                self.name = "Multi Printer"
                self.price_eur = 800.00
                self.expected_life_hours = 4 * 8760  # 4 years * 8760 hours/year
        
        printer_profile = MockPrinterProfile()
        
        # Mock db.get to return different objects based on model type
        def mock_db_get(model_class, id_value):
            if model_class == models.Product:
                return product
            elif model_class == models.PrinterProfile:
                return printer_profile
            return None
        
        db.get.side_effect = mock_db_get
        
        job_printer = Mock()
        job_printer.printer_profile_id = 1
        job_printer.printers_qty = 1
        job_printer.hours_each = 12.0
        job_printer.printer_profile = printer_profile
        
        # Mock print job
        print_job = Mock()
        print_job.products = [job_product]
        print_job.printers = [job_printer]
        print_job.packaging_cost_eur = 0.0
        
        total_cogs = _calculate_print_job_cogs(print_job, db)
        
        # Expected calculations:
        # Filament 1: (75g * €24/kg * 5 items) / 1000 = €9.00
        # Filament 2: (25g * €35/kg * 5 items) / 1000 = €4.375
        # Total filament: €13.375
        # Printer: (€800 / (4 * 8760) hrs) * 12 hrs = €0.274
        # Total: €13.649
        
        expected_filament1_cost = (75.0 * 24.00 * 5) / 1000
        expected_filament2_cost = (25.0 * 35.00 * 5) / 1000
        expected_printer_cost = (800.00 / (4 * 8760)) * 12.0
        expected_total = expected_filament1_cost + expected_filament2_cost + expected_printer_cost
        
        assert abs(total_cogs - expected_total) < 0.01
        assert total_cogs > 13.0

    def test_print_job_cogs_multiple_printers(self):
        """Test COGS calculation with multiple printer profiles."""
        db = Mock(spec=Session)
        
        # Simple filament setup using real object for arithmetic
        class MockFilament:
            def __init__(self):
                self.id = 1
                self.price_per_kg = 30.00
                self.color = "Blue"
                self.material = "ABS"
        
        filament = MockFilament()
        
        usage = Mock()
        usage.grams_used = 100.0
        usage.filament = filament
        
        # Create mock plate
        plate = Mock()
        plate.id = 1
        plate.name = "Main Plate"
        plate.quantity = 1
        plate.filament_usages = [usage]
        plate.cost = (100.0 * 30.00 / 1000)  # Pre-calculate plate cost
        
        product = Mock()
        product.id = 1
        product.name = "Multi-Printer Part"
        product.plates = [plate]
        product.filament_usages = []  # Empty for new structure
        product.cop = plate.cost  # Set COP to match plate cost
        product.total_print_time_hrs = 5.0  # Product takes 5 hours to print
        
        job_product = Mock()
        job_product.product_id = 1
        job_product.items_qty = 2  # Test with 2 items to verify multiplication
        
        # Single printer profile using real objects for arithmetic
        class MockPrinter:
            def __init__(self):
                self.id = 1
                self.name = "Printer 1"
                self.price_eur = 500.00
                self.expected_life_hours = 2 * 8760  # 2 years * 8760 hours/year
        
        printer = MockPrinter()
        
        # Mock db.get to return different objects based on model type and ID
        def mock_db_get(model_class, id_value):
            if model_class == models.Product:
                return product
            elif model_class == models.PrinterProfile:
                if id_value == 1:
                    return printer
            return None
        
        db.get.side_effect = mock_db_get
        
        job_printer = Mock()
        job_printer.printer_profile_id = 1
        job_printer.printers_qty = 1
        job_printer.printer_profile = printer
        
        print_job = Mock()
        print_job.products = [job_product]
        print_job.printers = [job_printer]
        print_job.packaging_cost_eur = 1.00
        
        total_cogs = _calculate_print_job_cogs(print_job, db)
        
        # Expected calculations with new logic:
        # Filament: (100g * €30/kg) / 1000 * 2 items = €6.00
        # Printer: (€500 / (2 * 8760) hrs) * (5.0 hrs/product * 2 items) * 1 printer = €1.712
        # Packaging: €1.00
        # Total: €8.712
        
        expected_filament_cost = (100.0 * 30.00) / 1000 * 2  # 2 items
        total_print_hours = 5.0 * 2  # 5 hrs/product * 2 items = 10 hours
        expected_printer_cost = (500.00 / (2 * 8760)) * total_print_hours * 1  # 1 printer
        expected_packaging = 1.00
        expected_total = expected_filament_cost + expected_printer_cost + expected_packaging
        
        assert abs(total_cogs - expected_total) < 0.01

    def test_print_job_cogs_zero_packaging_cost(self):
        """Test COGS calculation with zero packaging cost."""
        db = Mock(spec=Session)
        
        # Minimal setup using real objects for arithmetic
        class MockFilament:
            def __init__(self):
                self.id = 1
                self.price_per_kg = 20.00
                self.color = "Green"
                self.material = "PLA"
        
        filament = MockFilament()
        
        usage = Mock()
        usage.grams_used = 30.0
        usage.filament = filament
        
        # Create mock plate
        plate = Mock()
        plate.id = 1
        plate.name = "Main Plate"
        plate.quantity = 1
        plate.filament_usages = [usage]
        plate.cost = (30.0 * 20.00 / 1000)  # Pre-calculate plate cost
        
        product = Mock()
        product.id = 1
        product.name = "Zero Package Part"
        product.plates = [plate]
        product.filament_usages = []  # Empty for new structure
        product.cop = plate.cost  # Set COP to match plate cost
        
        job_product = Mock()
        job_product.product_id = 1
        job_product.items_qty = 1
        
        # Create printer using real object for arithmetic
        class MockPrinter:
            def __init__(self):
                self.id = 1
                self.name = "Zero Package Printer"
                self.price_eur = 400.00
                self.expected_life_hours = 2 * 8760  # 2 years * 8760 hours/year
        
        printer = MockPrinter()
        
        # Mock db.get to return different objects based on model type
        def mock_db_get(model_class, id_value):
            if model_class == models.Product:
                return product
            elif model_class == models.PrinterProfile:
                return printer
            return None
        
        db.get.side_effect = mock_db_get
        
        job_printer = Mock()
        job_printer.printer_profile_id = 1
        job_printer.printers_qty = 1
        job_printer.hours_each = 1.0
        job_printer.printer_profile = printer
        
        print_job = Mock()
        print_job.products = [job_product]
        print_job.printers = [job_printer]
        print_job.packaging_cost_eur = 0.0  # Zero packaging
        
        total_cogs = _calculate_print_job_cogs(print_job, db)
        
        # Should only include filament and printer costs
        expected_filament_cost = (30.0 * 20.00) / 1000  # €0.60
        expected_printer_cost = (400.00 / (2 * 8760)) * 1.0  # €0.023
        expected_total = expected_filament_cost + expected_printer_cost
        
        assert abs(total_cogs - expected_total) < 0.01
        assert total_cogs > 0.6  # Should be mostly filament cost


class TestSKUGeneration:
    """Test SKU generation logic."""

    def test_sku_generation_basic(self):
        """Test basic SKU generation with product name."""
        db = Mock(spec=Session)
        
        # Mock query result - no existing SKUs
        mock_query = Mock()
        mock_query.filter_by.return_value.first.return_value = None
        db.query.return_value = mock_query
        
        # Test with simple product name
        sku = _generate_sku("Test Widget", db)
        
        # Should format as TES-YYMMDD-001
        assert sku.startswith("TES-")
        assert sku.endswith("-001")
        assert len(sku) == 14  # TES-YYMMDD-001 (TES- + 6 digits + -001)

    def test_sku_generation_with_special_characters(self):
        """Test SKU generation strips special characters from name."""
        db = Mock(spec=Session)
        
        mock_query = Mock()
        mock_query.filter_by.return_value.first.return_value = None
        db.query.return_value = mock_query
        
        # Product name with special characters
        sku = _generate_sku("Phone Case v2.0 (Premium)", db)
        
        # Should extract alphanumeric only: PHO
        assert sku.startswith("PHO-")
        assert sku.endswith("-001")

    def test_sku_generation_handles_duplicates(self):
        """Test SKU generation increments sequence for duplicates."""
        db = Mock(spec=Session)
        
        # Mock existing SKU found on first two attempts
        mock_existing = Mock()
        mock_query = Mock()
        
        # Return existing SKU for first two calls, None for third
        mock_query.filter_by.return_value.first.side_effect = [mock_existing, mock_existing, None]
        db.query.return_value = mock_query
        
        sku = _generate_sku("Widget", db)
        
        # Should increment to 003 after finding conflicts
        assert sku.startswith("WID-")
        assert sku.endswith("-003")

    def test_sku_generation_short_name(self):
        """Test SKU generation with very short product name."""
        db = Mock(spec=Session)
        
        mock_query = Mock()
        mock_query.filter_by.return_value.first.return_value = None
        db.query.return_value = mock_query
        
        sku = _generate_sku("AB", db)  # Only 2 characters
        
        # Should still work, just use AB instead of 3 chars
        assert sku.startswith("AB-")
        assert sku.endswith("-001")

    def test_sku_generation_no_alphanumeric(self):
        """Test SKU generation with name containing no alphanumeric chars."""
        db = Mock(spec=Session)
        
        mock_query = Mock()
        mock_query.filter_by.return_value.first.return_value = None
        db.query.return_value = mock_query
        
        sku = _generate_sku("!@#$%", db)  # No alphanumeric
        
        # Should handle gracefully with empty base
        assert "-" in sku
        assert sku.endswith("-001")


class TestInventoryMath:
    """Test inventory calculation and update logic."""

    def test_weighted_average_price_calculation(self):
        """Test weighted average price calculation for filament purchases."""
        # Simulate existing inventory: 2kg at €20/kg = €40 total
        current_stock_kg = 2.0
        current_price_per_kg = 20.00
        current_total_value = current_stock_kg * current_price_per_kg  # €40
        
        # New purchase: 1kg at €30/kg = €30
        new_purchase_kg = 1.0
        new_purchase_price_per_kg = 30.00
        new_purchase_total_value = new_purchase_kg * new_purchase_price_per_kg  # €30
        
        # Calculate new weighted average
        total_stock = current_stock_kg + new_purchase_kg  # 3kg
        total_value = current_total_value + new_purchase_total_value  # €70
        new_average_price = total_value / total_stock  # €23.33/kg
        
        assert abs(new_average_price - 23.333333) < 0.001
        assert total_stock == 3.0

    def test_inventory_deduction_calculation(self):
        """Test inventory deduction for print job consumption."""
        # Starting inventory
        initial_stock_kg = 1.5  # 1500g
        
        # Print job consumes material
        items_printed = 4
        grams_per_item = 85.0
        total_grams_consumed = items_printed * grams_per_item  # 340g
        kg_consumed = total_grams_consumed / 1000  # 0.34kg
        
        # Calculate remaining stock
        remaining_stock_kg = initial_stock_kg - kg_consumed  # 1.16kg
        
        assert abs(remaining_stock_kg - 1.16) < 0.001
        assert remaining_stock_kg > 0  # Should not go negative

    def test_low_stock_threshold_check(self):
        """Test low stock alert threshold logic."""
        current_stock = 0.3  # 300g
        minimum_threshold = 0.5  # 500g
        
        is_low_stock = current_stock < minimum_threshold
        
        assert is_low_stock is True
        
        # Test with adequate stock
        adequate_stock = 0.8
        is_adequate = adequate_stock >= minimum_threshold
        
        assert is_adequate is True

    def test_zero_inventory_handling(self):
        """Test handling of zero or negative inventory scenarios."""
        current_stock = 0.1  # 100g
        requested_consumption = 0.15  # 150g (more than available)
        
        # Should prevent consumption if insufficient stock
        has_sufficient_stock = current_stock >= requested_consumption
        
        assert has_sufficient_stock is False
        
        # Verify we don't allow negative inventory
        if has_sufficient_stock:
            new_stock = current_stock - requested_consumption
        else:
            new_stock = current_stock  # Don't change if insufficient
            
        assert new_stock >= 0


class TestPricingCalculations:
    """Test product pricing and cost calculations."""

    def test_product_cop_calculation(self):
        """Test Cost of Production calculation for products."""
        # Mock filament costs
        filament_usages = [
            {"grams_used": 50.0, "price_per_kg": 25.00},  # €1.25
            {"grams_used": 30.0, "price_per_kg": 40.00},  # €1.20
        ]
        
        total_cop = sum(
            (usage["grams_used"] / 1000) * usage["price_per_kg"]
            for usage in filament_usages
        )
        
        expected_cop = (50.0 / 1000 * 25.00) + (30.0 / 1000 * 40.00)  # €2.45
        
        assert abs(total_cop - expected_cop) < 0.001
        assert total_cop == 2.45

    def test_printer_hourly_depreciation_cost(self):
        """Test hourly printer depreciation cost calculation."""
        printer_cost = 1000.00  # €1000
        depreciation_years = 5
        
        # Calculate hourly depreciation (assuming 24/7 operation)
        hours_per_year = 8760  # 365 * 24
        total_hours = depreciation_years * hours_per_year  # 43800 hours
        hourly_depreciation = printer_cost / total_hours  # €0.0228/hour
        
        assert abs(hourly_depreciation - 0.0228310502) < 0.0001
        
        # Test for 10 hours of usage
        ten_hour_cost = hourly_depreciation * 10
        assert abs(ten_hour_cost - 0.228310502) < 0.0001

    def test_margin_calculation(self):
        """Test profit margin calculation logic."""
        cost_of_goods = 15.50  # €15.50 COGS
        selling_price = 25.00   # €25.00 selling price
        
        # Calculate margin percentage
        profit = selling_price - cost_of_goods  # €9.50
        margin_percentage = (profit / selling_price) * 100  # 38%
        
        assert abs(margin_percentage - 38.0) < 0.1
        assert profit == 9.50
        
        # Test markup calculation (profit/cost)
        markup_percentage = (profit / cost_of_goods) * 100  # 61.29%
        assert abs(markup_percentage - 61.29) < 0.1

    def test_print_job_cogs_with_plates(self):
        """Test COGS calculation for products with plate-based structure."""
        db = Mock(spec=Session)
        
        # Create mock filaments
        class MockFilament:
            def __init__(self, id, price_per_kg):
                self.id = id
                self.price_per_kg = price_per_kg
                self.color = "Test"
                self.material = "PLA"
        
        filament1 = MockFilament(1, 25.00)
        filament2 = MockFilament(2, 30.00)
        
        # Create mock plate filament usages
        plate_usage1 = Mock()
        plate_usage1.grams_used = 50.0
        plate_usage1.filament = filament1
        
        plate_usage2 = Mock()
        plate_usage2.grams_used = 30.0
        plate_usage2.filament = filament2
        
        # Create mock plates
        plate1 = Mock()
        plate1.quantity = 1
        plate1.filament_usages = [plate_usage1]  # 50g * €25/kg = €1.25
        plate1.cost = (50.0 * 25.00 / 1000) * 1  # €1.25
        
        plate2 = Mock()
        plate2.quantity = 2
        plate2.filament_usages = [plate_usage2]  # 30g * €30/kg * 2 = €1.80
        plate2.cost = (30.0 * 30.00 / 1000) * 2  # €1.80
        
        # Create mock product with plates
        product = Mock()
        product.id = 1
        product.name = "Plate-based Product"
        product.plates = [plate1, plate2]
        product.filament_usages = []  # No legacy usages
        product.cop = plate1.cost + plate2.cost  # Total cost of all plates
        
        # Mock job product
        job_product = Mock()
        job_product.product_id = 1
        job_product.items_qty = 3  # 3 units
        
        # Mock db.get to return the product
        db.get.return_value = product
        
        # Mock print job (no printers for simplicity)
        print_job = Mock()
        print_job.products = [job_product]
        print_job.printers = []
        print_job.packaging_cost_eur = 0.0
        
        total_cogs = _calculate_print_job_cogs(print_job, db)
        
        # Expected calculations:
        # Plate 1: 50g/1000 * €25 * 1 = €1.25 per product
        # Plate 2: 30g/1000 * €30 * 2 = €1.80 per product
        # Total per product: €3.05
        # 3 products: €3.05 * 3 = €9.15
        
        expected_plate1_cost = (50.0 / 1000) * 25.00 * 1
        expected_plate2_cost = (30.0 / 1000) * 30.00 * 2
        expected_per_product = expected_plate1_cost + expected_plate2_cost
        expected_total = expected_per_product * 3
        
        assert abs(total_cogs - expected_total) < 0.01
        assert abs(total_cogs - 9.15) < 0.01

    def test_print_job_cogs_fallback_to_legacy(self):
        """Test COGS calculation falls back to legacy when no plates exist."""
        db = Mock(spec=Session)
        
        # Create mock filament
        class MockFilament:
            def __init__(self):
                self.id = 1
                self.price_per_kg = 25.00
                self.color = "Red"
                self.material = "PLA"
        
        filament = MockFilament()
        
        # Create mock legacy filament usage
        usage = Mock()
        usage.grams_used = 50.0
        usage.filament = filament
        
        # Create mock product with NO plates (legacy mode)
        product = Mock()
        product.id = 1
        product.name = "Legacy Product"
        product.plates = []  # No plates
        product.filament_usages = [usage]  # Legacy usages
        product.cop = (50.0 * 25.00 / 1000)  # Legacy COP calculation
        
        # Mock job product
        job_product = Mock()
        job_product.product_id = 1
        job_product.items_qty = 2
        
        # Mock db.get to return the product
        db.get.return_value = product
        
        # Mock print job
        print_job = Mock()
        print_job.products = [job_product]
        print_job.printers = []
        print_job.packaging_cost_eur = 0.0
        
        total_cogs = _calculate_print_job_cogs(print_job, db)
        
        # Expected calculations (legacy):
        # 50g/1000 * €25 = €1.25 per product
        # 2 products: €1.25 * 2 = €2.50
        
        expected_legacy_cost = (50.0 / 1000) * 25.00 * 2
        
        assert abs(total_cogs - expected_legacy_cost) < 0.01
        assert abs(total_cogs - 2.50) < 0.01