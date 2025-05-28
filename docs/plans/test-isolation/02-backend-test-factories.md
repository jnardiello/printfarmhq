# Task 02: Backend Test Factories

## Context Description
Currently, tests create data using raw model instantiation or custom setup functions. This leads to:
- Duplicate code across tests
- Inconsistent test data
- Difficult to maintain when models change
- Complex setup for related objects

We need a factory pattern that provides consistent, flexible test data creation.

## Desired Solution
Implement factory classes using Factory Boy that:
1. Generate valid test data automatically
2. Handle model relationships
3. Allow customization per test
4. Provide realistic fake data
5. Integrate with our transaction isolation

## Implementation Steps

### Step 1: Install Dependencies
```bash
# Add to backend/requirements.txt
factory-boy==3.3.0
faker==19.12.0
```

### Step 2: Create Base Factory Configuration
```python
# backend/tests/factories/__init__.py
import factory
from sqlalchemy.orm import scoped_session
from app.database import SessionLocal

# Create a scoped session for factories
session = scoped_session(SessionLocal)

class BaseFactory(factory.alchemy.SQLAlchemyModelFactory):
    """Base factory for all model factories"""
    
    class Meta:
        abstract = True
        sqlalchemy_session = session
        sqlalchemy_session_persistence = "flush"  # Don't commit
    
    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """Override to use the test session"""
        if hasattr(cls._meta, 'sqlalchemy_session_factory'):
            session = cls._meta.sqlalchemy_session_factory()
        else:
            session = cls._meta.sqlalchemy_session
        
        obj = model_class(*args, **kwargs)
        session.add(obj)
        session.flush()  # Make ID available without committing
        return obj
```

### Step 3: Create Model Factories
```python
# backend/tests/factories/user.py
import factory
from app.models import User
from app.auth import get_password_hash
from .import BaseFactory

class UserFactory(BaseFactory):
    class Meta:
        model = User
    
    id = factory.Faker('uuid4')
    email = factory.Sequence(lambda n: f'user{n}@test.com')
    name = factory.Faker('name')
    hashed_password = factory.LazyFunction(lambda: get_password_hash('testpass123'))
    is_active = True
    is_admin = False
    is_superadmin = False
    token_version = 0
    
    class Params:
        # Traits for common variations
        admin = factory.Trait(
            is_admin=True,
            email=factory.Sequence(lambda n: f'admin{n}@test.com')
        )
        superadmin = factory.Trait(
            is_admin=True,
            is_superadmin=True,
            email=factory.Sequence(lambda n: f'superadmin{n}@test.com')
        )
        inactive = factory.Trait(
            is_active=False
        )

# backend/tests/factories/filament.py
class FilamentFactory(BaseFactory):
    class Meta:
        model = Filament
    
    id = factory.Faker('uuid4')
    material = factory.Faker('random_element', elements=['PLA', 'ABS', 'PETG', 'TPU', 'Nylon'])
    brand = factory.Faker('company')
    color = factory.Faker('color_name')
    price_per_kg = factory.Faker('pydecimal', left_digits=2, right_digits=2, positive=True, min_value=15, max_value=100)
    
    # Available grams calculated from purchases
    @factory.lazy_attribute
    def available_grams(self):
        return 0  # Will be updated by purchases

# backend/tests/factories/purchase.py  
class FilamentPurchaseFactory(BaseFactory):
    class Meta:
        model = FilamentPurchase
    
    id = factory.Faker('uuid4')
    filament = factory.SubFactory(FilamentFactory)
    grams = factory.Faker('random_int', min=100, max=5000, step=100)
    price_eur = factory.Faker('pydecimal', left_digits=2, right_digits=2, positive=True, min_value=10, max_value=150)
    
    @factory.lazy_attribute
    def price_per_kg(self):
        return float(self.price_eur) / (self.grams / 1000)
    
    @factory.post_generation
    def update_filament_inventory(obj, create, extracted, **kwargs):
        """Update the filament's available_grams after purchase creation"""
        if obj.filament:
            obj.filament.available_grams += obj.grams

# backend/tests/factories/product.py
class ProductFactory(BaseFactory):
    class Meta:
        model = Product
    
    id = factory.Faker('uuid4')
    sku = factory.Sequence(lambda n: f'SKU-{n:05d}')
    name = factory.Faker('catch_phrase')
    material_cost_eur = factory.Faker('pydecimal', left_digits=1, right_digits=2, positive=True, max_value=50)
    time_to_print_minutes = factory.Faker('random_int', min=30, max=480)
    
    @factory.post_generation
    def filament_usages(self, create, extracted, **kwargs):
        """Create FilamentUsage objects for this product"""
        if not create:
            return
        
        if extracted:
            # Use provided filament usages
            for usage in extracted:
                self.filament_usages.append(usage)
        else:
            # Create default usage
            FilamentUsageFactory(product=self)

class FilamentUsageFactory(BaseFactory):
    class Meta:
        model = FilamentUsage
    
    id = factory.Faker('uuid4')
    product = factory.SubFactory(ProductFactory)
    filament = factory.SubFactory(FilamentFactory)
    grams_used = factory.Faker('random_int', min=10, max=200)
```

### Step 4: Create Printer and Print Job Factories
```python
# backend/tests/factories/printer.py
class PrinterProfileFactory(BaseFactory):
    class Meta:
        model = PrinterProfile
    
    id = factory.Faker('uuid4')
    name = factory.Faker('random_element', elements=['Prusa i3 MK3S+', 'Ender 3 V2', 'Bambu Lab X1'])
    price_eur = factory.Faker('pydecimal', left_digits=3, right_digits=2, min_value=200, max_value=2000)
    expected_life_hours = factory.Faker('random_int', min=5000, max=20000, step=1000)

# backend/tests/factories/print_job.py
class PrintJobFactory(BaseFactory):
    class Meta:
        model = PrintJob
    
    id = factory.Faker('uuid4')
    name = factory.Faker('catch_phrase')
    status = 'pending'
    total_time_hours = factory.Faker('pydecimal', left_digits=2, right_digits=1, min_value=1, max_value=48)
    packaging_cost_eur = factory.Faker('pydecimal', left_digits=1, right_digits=2, min_value=0.5, max_value=5)
    
    @factory.post_generation
    def products(self, create, extracted, **kwargs):
        if not create:
            return
        
        if extracted:
            for product in extracted:
                PrintJobProductFactory(print_job=self, product=product)
    
    @factory.post_generation
    def printers(self, create, extracted, **kwargs):
        if not create:
            return
        
        if extracted:
            for printer in extracted:
                PrintJobPrinterFactory(print_job=self, printer_profile=printer)
```

### Step 5: Integration with Fixtures
```python
# backend/tests/conftest.py additions
@pytest.fixture
def factory_session(db_session):
    """Configure factories to use test session"""
    from tests.factories import BaseFactory
    
    # Override the session for all factories
    BaseFactory._meta.sqlalchemy_session = db_session
    
    yield db_session
    
    # Reset to default
    BaseFactory._meta.sqlalchemy_session = None

@pytest.fixture
def user_factory(factory_session):
    """Provide UserFactory with test session"""
    from tests.factories.user import UserFactory
    UserFactory._meta.sqlalchemy_session = factory_session
    return UserFactory

@pytest.fixture
def filament_factory(factory_session):
    """Provide FilamentFactory with test session"""
    from tests.factories.filament import FilamentFactory
    FilamentFactory._meta.sqlalchemy_session = factory_session
    return FilamentFactory

# Add fixtures for all factories...
```

### Step 6: Usage in Tests
```python
# backend/tests/test_example.py
def test_user_with_purchases(user_factory, filament_factory, purchase_factory):
    # Create admin user
    admin = user_factory(admin=True)
    
    # Create filament with inventory
    filament = filament_factory(color="Red", material="PLA")
    purchase = purchase_factory(filament=filament, grams=1000)
    
    assert admin.is_admin is True
    assert filament.available_grams == 1000

def test_complex_print_job(print_job_factory, product_factory):
    # Create products with specific requirements
    product1 = product_factory(name="Widget A")
    product2 = product_factory(name="Widget B")
    
    # Create print job with those products
    job = print_job_factory(
        name="Customer Order #123",
        products=[product1, product2]
    )
    
    assert len(job.products) == 2
```

## Guidelines for Implementation

### DO:
1. **Use traits** for common variations (admin, inactive, etc.)
2. **Leverage Faker** for realistic test data
3. **Handle relationships** with SubFactory and post_generation
4. **Keep factories simple** - test logic belongs in tests
5. **Document factory fields** and available traits

### DON'T:
1. **Don't hardcode values** unless necessary
2. **Don't create complex logic** in factories
3. **Don't commit in factories** - use flush
4. **Don't share factory instances** between tests
5. **Don't forget to update factories** when models change

### Best Practices
1. **One factory per model** in separate files
2. **Group related factories** in modules
3. **Use meaningful fake data** (company names, not "test123")
4. **Create helper methods** for complex scenarios
5. **Test factories themselves** to ensure they work

### Testing Factories
```python
# backend/tests/test_factories.py
def test_user_factory_creates_valid_user(user_factory, db_session):
    user = user_factory()
    assert user.id is not None
    assert '@test.com' in user.email
    assert user.check_password('testpass123')

def test_filament_factory_with_purchases(filament_factory, purchase_factory):
    filament = filament_factory()
    purchase1 = purchase_factory(filament=filament, grams=1000)
    purchase2 = purchase_factory(filament=filament, grams=500)
    
    assert filament.available_grams == 1500
```

### Common Patterns
```python
# Batch creation
users = user_factory.create_batch(5)

# Building without saving
user = user_factory.build()  # Not added to session

# Customizing nested objects
product = product_factory(
    filament_usages=[
        filament_usage_factory.build(grams_used=50),
        filament_usage_factory.build(grams_used=30)
    ]
)

# Using factory data in API tests
def test_create_product_api(client, auth_headers, filament_factory):
    filament = filament_factory()
    
    product_data = {
        "name": "Test Product",
        "sku": "TEST-001",
        "filament_usages": [
            {"filament_id": str(filament.id), "grams_used": 100}
        ]
    }
    
    response = client.post("/api/products", json=product_data, headers=auth_headers)
    assert response.status_code == 201
```

### Success Metrics
- Reduced test setup code by 70%
- Consistent test data across all tests
- Easy to add new test scenarios
- Tests remain readable and focused
- Model changes require minimal test updates