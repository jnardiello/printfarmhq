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
        
        # Create mock product with proper COP calculation
        mock_product = Mock()
        mock_product.id = 1
        mock_product.name = "Test Widget"
        mock_product.filament_usages = [mock_filament_usage]
        mock_product.cop = (50.0 * 25.00 / 1000)  # €1.25 per unit
        
        # Create mock print job product
        mock_job_product = Mock()
        mock_job_product.product_id = 1
        mock_job_product.items_qty = 2  # 2 items
        mock_job_product.product = mock_product
        
        # Create mock printer type
        class MockPrinterType:
            def __init__(self):
                self.id = 1
                self.brand = "Test"
                self.model = "Printer"
                self.expected_life_hours = 10000.0
        
        mock_printer_type = MockPrinterType()
        
        # Mock db.get to return printer type
        def mock_db_get(model_class, id_value):
            if model_class == models.PrinterType:
                return mock_printer_type
            return None
        
        db.get.side_effect = mock_db_get
        
        # Mock the average price query for printers
        mock_query = Mock()
        mock_query.filter.return_value.scalar.return_value = 1000.0  # Average printer price
        db.query.return_value = mock_query
        
        # Create mock print job printer
        mock_job_printer = Mock()
        mock_job_printer.printer_type_id = 1
        mock_job_printer.hours_each = 3.0  # 3 hours total (1.5 hrs/product * 2 products)
        mock_job_printer.printer_price_eur = None  # Not yet assigned
        mock_job_printer.printer_expected_life_hours = None
        mock_job_printer.assigned_printer_id = None
        mock_job_printer.assigned_printer = None
        
        # Create mock print job
        mock_print_job = Mock()
        mock_print_job.id = "test-job-id"
        mock_print_job.name = "Test Job"
        mock_print_job.products = [mock_job_product]
        mock_print_job.printers = [mock_job_printer]
        mock_print_job.packaging_cost_eur = 2.50
        mock_print_job.owner_id = 1
        
        # Calculate COGS
        total_cogs = _calculate_print_job_cogs(mock_print_job, db)
        
        # Expected calculations:
        # Product cost: €1.25 * 2 items = €2.50
        # Printer cost: (€1000 / 10000 hrs) * 3 hrs = €0.30
        # Packaging cost: €2.50
        # Total expected: €5.30
        
        expected_product_cost = 1.25 * 2  # €2.50
        expected_printer_cost = (1000.0 / 10000.0) * 3.0  # €0.30
        expected_packaging = 2.50
        expected_total = expected_product_cost + expected_printer_cost + expected_packaging
        
        assert abs(total_cogs - expected_total) < 0.01
        assert abs(total_cogs - 5.30) < 0.01

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
        
        # Calculate COP from multiple filaments
        cop = (75.0 * 24.00 / 1000) + (25.0 * 35.00 / 1000)  # €1.80 + €0.875 = €2.675
        
        product = Mock()
        product.id = 1
        product.name = "Multi-Material Part"
        product.filament_usages = [usage1, usage2]
        product.cop = cop  # €2.675 per unit
        
        # Mock job product
        job_product = Mock()
        job_product.product_id = 1
        job_product.items_qty = 5
        job_product.product = product
        
        # Create mock printer type
        class MockPrinterType:
            def __init__(self):
                self.id = 2
                self.brand = "Advanced"
                self.model = "Printer"
                self.expected_life_hours = 20000.0
        
        mock_printer_type = MockPrinterType()
        
        # Mock db.get to return printer type
        def mock_db_get(model_class, id_value):
            if model_class == models.PrinterType and id_value == 2:
                return mock_printer_type
            return None
        
        db.get.side_effect = mock_db_get
        
        # Mock the average price query
        mock_query = Mock()
        mock_query.filter.return_value.scalar.return_value = 2000.0  # Average printer price
        db.query.return_value = mock_query
        
        job_printer = Mock()
        job_printer.printer_type_id = 2
        job_printer.hours_each = 10.0  # 10 hours for 5 products
        job_printer.printer_price_eur = None
        job_printer.printer_expected_life_hours = None
        job_printer.assigned_printer_id = None
        job_printer.assigned_printer = None
        
        # Mock print job
        print_job = Mock()
        print_job.id = "multi-filament-job"
        print_job.products = [job_product]
        print_job.printers = [job_printer]
        print_job.packaging_cost_eur = 0.0
        print_job.owner_id = 1
        
        total_cogs = _calculate_print_job_cogs(print_job, db)
        
        # Expected calculations:
        # Product cost: €2.675 * 5 items = €13.375
        # Printer cost: (€2000 / 20000 hrs) * 10 hrs = €1.00
        # Total: €14.375
        
        expected_product_cost = 2.675 * 5  # €13.375
        expected_printer_cost = (2000.0 / 20000.0) * 10.0  # €1.00
        expected_total = expected_product_cost + expected_printer_cost
        
        assert abs(total_cogs - expected_total) < 0.01
        assert abs(total_cogs - 14.375) < 0.01

    def test_print_job_single_printer_type_calculation(self):
        """Test COGS calculation with the current single printer type per job model."""
        db = Mock(spec=Session)
        
        # Create mock product
        product = Mock()
        product.id = 1
        product.name = "Test Product"
        product.cop = 3.00  # €3.00 per unit
        
        job_product = Mock()
        job_product.product_id = 1
        job_product.items_qty = 2
        job_product.product = product
        
        # Create mock printer type
        class MockPrinterType:
            def __init__(self):
                self.id = 1
                self.brand = "Test"
                self.model = "Printer"
                self.expected_life_hours = 20000.0
        
        mock_printer_type = MockPrinterType()
        
        # Mock db.get to return printer type
        def mock_db_get(model_class, id_value):
            if model_class == models.PrinterType:
                return mock_printer_type
            return None
        
        db.get.side_effect = mock_db_get
        
        # Mock the average price query
        mock_query = Mock()
        mock_query.filter.return_value.scalar.return_value = 1500.0  # Average printer price
        db.query.return_value = mock_query
        
        # Single printer type (current implementation)
        job_printer = Mock()
        job_printer.printer_type_id = 1
        job_printer.hours_each = 10.0  # Total hours for the job
        job_printer.printer_price_eur = None
        job_printer.printer_expected_life_hours = None
        job_printer.assigned_printer_id = None
        job_printer.assigned_printer = None
        
        print_job = Mock()
        print_job.id = "single-printer-job"
        print_job.products = [job_product]
        print_job.printers = [job_printer]  # Single printer type
        print_job.packaging_cost_eur = 1.00
        print_job.owner_id = 1
        
        total_cogs = _calculate_print_job_cogs(print_job, db)
        
        # Expected calculations:
        # Product cost: €3.00 * 2 items = €6.00
        # Printer cost: (€1500 / 20000 hrs) * 10 hrs = €0.75
        # Packaging: €1.00
        # Total: €7.75
        
        expected_product_cost = 3.00 * 2
        expected_printer_cost = (1500.0 / 20000.0) * 10.0
        expected_total = expected_product_cost + expected_printer_cost + 1.00
        
        assert abs(total_cogs - expected_total) < 0.01
        assert abs(total_cogs - 7.75) < 0.01

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
        
        product = Mock()
        product.id = 1
        product.name = "Zero Package Part"
        product.filament_usages = [usage]
        product.cop = (30.0 * 20.00 / 1000)  # €0.60 per unit
        
        job_product = Mock()
        job_product.product_id = 1
        job_product.items_qty = 1
        job_product.product = product
        
        # Create mock printer type
        class MockPrinterType:
            def __init__(self):
                self.id = 3
                self.brand = "Budget"
                self.model = "Printer"
                self.expected_life_hours = 10000.0
        
        mock_printer_type = MockPrinterType()
        
        # Mock db.get to return printer type
        def mock_db_get(model_class, id_value):
            if model_class == models.PrinterType and id_value == 3:
                return mock_printer_type
            return None
        
        db.get.side_effect = mock_db_get
        
        # Mock the average price query
        mock_query = Mock()
        mock_query.filter.return_value.scalar.return_value = 500.0  # Average printer price
        db.query.return_value = mock_query
        
        job_printer = Mock()
        job_printer.printer_type_id = 3
        job_printer.hours_each = 1.0
        job_printer.printer_price_eur = None
        job_printer.printer_expected_life_hours = None
        job_printer.assigned_printer_id = None
        job_printer.assigned_printer = None
        
        print_job = Mock()
        print_job.id = "zero-packaging-job"
        print_job.products = [job_product]
        print_job.printers = [job_printer]
        print_job.packaging_cost_eur = 0.0  # Zero packaging
        print_job.owner_id = 1
        
        total_cogs = _calculate_print_job_cogs(print_job, db)
        
        # Should only include product and printer costs
        expected_product_cost = 0.60  # €0.60
        expected_printer_cost = (500.0 / 10000.0) * 1.0  # €0.05
        expected_total = expected_product_cost + expected_printer_cost
        
        assert abs(total_cogs - expected_total) < 0.01
        assert abs(total_cogs - 0.65) < 0.01


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

    # REMOVED: test_print_job_cogs_with_plates - Plates feature no longer exists
    # REMOVED: test_print_job_cogs_fallback_to_legacy - Plates feature no longer exists