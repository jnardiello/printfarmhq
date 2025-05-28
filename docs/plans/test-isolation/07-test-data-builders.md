# Task 07: Test Data Builders

## Context Description
Both frontend and backend tests need consistent, flexible test data creation. Current approaches:
- Hardcode data in each test
- Use inconsistent patterns
- Duplicate data creation logic
- Difficult to create complex scenarios
- No clear API for test data

## Desired Solution
Implement builder pattern for test data that:
1. Provides fluent API for data creation
2. Handles relationships automatically
3. Generates realistic test data
4. Works in both frontend and backend tests
5. Supports complex scenarios easily

## Implementation Steps

### Step 1: Backend Test Data Builders
```python
# backend/tests/builders/base.py
from typing import TypeVar, Generic, Dict, Any, Optional
from abc import ABC, abstractmethod
import uuid
from datetime import datetime, timedelta
from faker import Faker

T = TypeVar('T')
fake = Faker()

class BaseBuilder(ABC, Generic[T]):
    """Base builder for all test data builders"""
    
    def __init__(self):
        self._data: Dict[str, Any] = {}
        self._post_build_hooks = []
        self.reset()
    
    def reset(self) -> 'BaseBuilder':
        """Reset builder to default state"""
        self._data = self._get_defaults()
        self._post_build_hooks = []
        return self
    
    @abstractmethod
    def _get_defaults(self) -> Dict[str, Any]:
        """Get default values for the model"""
        pass
    
    @abstractmethod
    def _create_instance(self, session, **kwargs) -> T:
        """Create actual model instance"""
        pass
    
    def with_custom(self, **kwargs) -> 'BaseBuilder':
        """Set custom attributes"""
        self._data.update(kwargs)
        return self
    
    def after_build(self, hook):
        """Add post-build hook"""
        self._post_build_hooks.append(hook)
        return self
    
    def build(self, session=None, persist=True) -> T:
        """Build the instance"""
        instance = self._create_instance(session, **self._data)
        
        # Run post-build hooks
        for hook in self._post_build_hooks:
            hook(instance)
        
        if persist and session:
            session.add(instance)
            session.flush()
        
        return instance
    
    def build_many(self, count: int, session=None, persist=True) -> list[T]:
        """Build multiple instances"""
        return [self.build(session, persist) for _ in range(count)]
```

### Step 2: Model-Specific Builders
```python
# backend/tests/builders/user_builder.py
from app.models import User
from app.auth import get_password_hash
from .base import BaseBuilder

class UserBuilder(BaseBuilder[User]):
    """Builder for User model"""
    
    def _get_defaults(self) -> Dict[str, Any]:
        return {
            'id': str(uuid.uuid4()),
            'email': fake.email(),
            'name': fake.name(),
            'hashed_password': get_password_hash('password123'),
            'is_active': True,
            'is_admin': False,
            'is_superadmin': False,
            'token_version': 0
        }
    
    def _create_instance(self, session, **kwargs) -> User:
        return User(**kwargs)
    
    # Fluent interface methods
    def with_email(self, email: str) -> 'UserBuilder':
        self._data['email'] = email
        return self
    
    def with_name(self, name: str) -> 'UserBuilder':
        self._data['name'] = name
        return self
    
    def with_password(self, password: str) -> 'UserBuilder':
        self._data['hashed_password'] = get_password_hash(password)
        return self
    
    def as_admin(self) -> 'UserBuilder':
        self._data['is_admin'] = True
        return self
    
    def as_superadmin(self) -> 'UserBuilder':
        self._data['is_admin'] = True
        self._data['is_superadmin'] = True
        return self
    
    def as_inactive(self) -> 'UserBuilder':
        self._data['is_active'] = False
        return self

# backend/tests/builders/filament_builder.py
class FilamentBuilder(BaseBuilder[Filament]):
    """Builder for Filament model"""
    
    def _get_defaults(self) -> Dict[str, Any]:
        return {
            'id': str(uuid.uuid4()),
            'material': fake.random_element(['PLA', 'ABS', 'PETG', 'TPU']),
            'color': fake.color_name(),
            'brand': fake.company(),
            'price_per_kg': round(fake.random.uniform(15.0, 50.0), 2),
            'available_grams': 0
        }
    
    def _create_instance(self, session, **kwargs) -> Filament:
        return Filament(**kwargs)
    
    def with_material(self, material: str) -> 'FilamentBuilder':
        self._data['material'] = material
        return self
    
    def with_color(self, color: str) -> 'FilamentBuilder':
        self._data['color'] = color
        return self
    
    def with_inventory(self, grams: int) -> 'FilamentBuilder':
        """Add inventory via purchase"""
        def add_purchase(filament):
            if hasattr(self, '_session'):
                purchase = FilamentPurchaseBuilder()\
                    .for_filament(filament)\
                    .with_grams(grams)\
                    .build(self._session)
        
        self.after_build(add_purchase)
        return self
    
    def in_price_range(self, min_price: float, max_price: float) -> 'FilamentBuilder':
        self._data['price_per_kg'] = round(fake.random.uniform(min_price, max_price), 2)
        return self

# backend/tests/builders/product_builder.py
class ProductBuilder(BaseBuilder[Product]):
    """Builder for Product model with relationships"""
    
    def __init__(self):
        super().__init__()
        self._filament_usages = []
    
    def _get_defaults(self) -> Dict[str, Any]:
        return {
            'id': str(uuid.uuid4()),
            'sku': f"SKU-{fake.random_number(digits=5, fix_len=True)}",
            'name': fake.catch_phrase(),
            'material_cost_eur': round(fake.random.uniform(0.5, 10.0), 2),
            'time_to_print_minutes': fake.random_int(30, 480)
        }
    
    def _create_instance(self, session, **kwargs) -> Product:
        product = Product(**kwargs)
        
        if session and self._filament_usages:
            for usage_data in self._filament_usages:
                usage = FilamentUsage(
                    product=product,
                    **usage_data
                )
                session.add(usage)
        
        return product
    
    def with_filament_usage(
        self, 
        filament: Filament, 
        grams: int
    ) -> 'ProductBuilder':
        """Add filament usage to product"""
        self._filament_usages.append({
            'filament': filament,
            'grams_used': grams
        })
        return self
    
    def with_multiple_filaments(
        self, 
        filaments: list[Filament], 
        grams_each: int = 50
    ) -> 'ProductBuilder':
        """Add multiple filament usages"""
        for filament in filaments:
            self.with_filament_usage(filament, grams_each)
        return self
    
    def quick_print(self) -> 'ProductBuilder':
        """Configure as quick print item"""
        self._data['time_to_print_minutes'] = fake.random_int(10, 60)
        return self
    
    def long_print(self) -> 'ProductBuilder':
        """Configure as long print item"""
        self._data['time_to_print_minutes'] = fake.random_int(240, 720)
        return self
```

### Step 3: Complex Scenario Builders
```python
# backend/tests/builders/scenario_builder.py
class ScenarioBuilder:
    """Builder for complex test scenarios"""
    
    def __init__(self, session):
        self.session = session
        self.data = {
            'users': [],
            'filaments': [],
            'products': [],
            'print_jobs': []
        }
    
    def with_inventory_setup(
        self, 
        filament_count: int = 5,
        min_inventory: int = 500,
        max_inventory: int = 2000
    ) -> 'ScenarioBuilder':
        """Create filaments with inventory"""
        for _ in range(filament_count):
            filament = FilamentBuilder()\
                .with_inventory(fake.random_int(min_inventory, max_inventory))\
                .build(self.session)
            self.data['filaments'].append(filament)
        
        return self
    
    def with_product_catalog(
        self,
        product_count: int = 10,
        filaments_per_product: int = 2
    ) -> 'ScenarioBuilder':
        """Create products using available filaments"""
        if not self.data['filaments']:
            self.with_inventory_setup()
        
        for _ in range(product_count):
            # Random selection of filaments
            selected_filaments = fake.random_elements(
                self.data['filaments'],
                length=min(filaments_per_product, len(self.data['filaments']))
            )
            
            product = ProductBuilder()\
                .with_multiple_filaments(selected_filaments)\
                .build(self.session)
            
            self.data['products'].append(product)
        
        return self
    
    def with_print_jobs(
        self,
        job_count: int = 5,
        products_per_job: int = 3
    ) -> 'ScenarioBuilder':
        """Create print jobs with products"""
        if not self.data['products']:
            self.with_product_catalog()
        
        for _ in range(job_count):
            selected_products = fake.random_elements(
                self.data['products'],
                length=min(products_per_job, len(self.data['products']))
            )
            
            job = PrintJobBuilder()\
                .with_products(selected_products)\
                .with_random_quantities()\
                .build(self.session)
            
            self.data['print_jobs'].append(job)
        
        return self
    
    def with_users(
        self,
        regular_users: int = 3,
        admin_users: int = 1
    ) -> 'ScenarioBuilder':
        """Create various user types"""
        # Regular users
        for i in range(regular_users):
            user = UserBuilder()\
                .with_email(f"user{i}@test.com")\
                .build(self.session)
            self.data['users'].append(user)
        
        # Admin users
        for i in range(admin_users):
            admin = UserBuilder()\
                .with_email(f"admin{i}@test.com")\
                .as_admin()\
                .build(self.session)
            self.data['users'].append(admin)
        
        return self
    
    def build(self) -> Dict[str, Any]:
        """Finalize and return scenario data"""
        self.session.commit()
        return self.data
```

### Step 4: Frontend Test Data Builders
```typescript
// frontend/e2e/builders/base-builder.ts
export abstract class BaseBuilder<T> {
  protected data: Partial<T> = {}
  protected postBuildHooks: Array<(item: T) => Promise<void>> = []

  constructor() {
    this.reset()
  }

  reset(): this {
    this.data = this.getDefaults()
    this.postBuildHooks = []
    return this
  }

  abstract getDefaults(): Partial<T>

  with(overrides: Partial<T>): this {
    Object.assign(this.data, overrides)
    return this
  }

  afterBuild(hook: (item: T) => Promise<void>): this {
    this.postBuildHooks.push(hook)
    return this
  }

  async build(): Promise<T> {
    const instance = { ...this.getDefaults(), ...this.data } as T
    
    for (const hook of this.postBuildHooks) {
      await hook(instance)
    }
    
    return instance
  }

  async buildMany(count: number): Promise<T[]> {
    const instances: T[] = []
    for (let i = 0; i < count; i++) {
      instances.push(await this.build())
    }
    return instances
  }
}

// frontend/e2e/builders/filament-builder.ts
import { faker } from '@faker-js/faker'

interface Filament {
  id?: string
  material: string
  color: string
  brand: string
  price_per_kg: number
  available_grams: number
}

export class FilamentBuilder extends BaseBuilder<Filament> {
  getDefaults(): Partial<Filament> {
    return {
      material: faker.helpers.arrayElement(['PLA', 'ABS', 'PETG', 'TPU']),
      color: faker.color.human(),
      brand: faker.company.name(),
      price_per_kg: faker.number.float({ min: 15, max: 50, precision: 0.01 }),
      available_grams: 0
    }
  }

  withMaterial(material: string): this {
    this.data.material = material
    return this
  }

  withColor(color: string): this {
    this.data.color = color
    return this
  }

  withInventory(grams: number): this {
    this.data.available_grams = grams
    return this
  }

  asEconomical(): this {
    this.data.price_per_kg = faker.number.float({ min: 15, max: 25, precision: 0.01 })
    return this
  }

  asPremium(): this {
    this.data.price_per_kg = faker.number.float({ min: 35, max: 50, precision: 0.01 })
    this.data.brand = faker.helpers.arrayElement(['Prusament', 'Polymaker', 'Proto-pasta'])
    return this
  }
}
```

### Step 5: API Integration for Frontend Builders
```typescript
// frontend/e2e/builders/api-builder.ts
import { Page } from '@playwright/test'

export class APIBuilder {
  constructor(private page: Page) {}

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await this.page.evaluate(() => 
      localStorage.getItem('auth_token') || localStorage.getItem('token')
    )
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  filament(): FilamentAPIBuilder {
    return new FilamentAPIBuilder(this.page, this.getAuthHeaders.bind(this))
  }

  product(): ProductAPIBuilder {
    return new ProductAPIBuilder(this.page, this.getAuthHeaders.bind(this))
  }

  scenario(): ScenarioAPIBuilder {
    return new ScenarioAPIBuilder(this.page, this.getAuthHeaders.bind(this))
  }
}

class FilamentAPIBuilder extends FilamentBuilder {
  constructor(
    private page: Page,
    private getHeaders: () => Promise<HeadersInit>
  ) {
    super()
  }

  async create(): Promise<any> {
    const data = await this.build()
    const headers = await this.getHeaders()
    
    const response = await this.page.request.post('/api/filaments', {
      headers,
      data
    })
    
    if (!response.ok()) {
      throw new Error(`Failed to create filament: ${response.status()}`)
    }
    
    return response.json()
  }

  async createMany(count: number): Promise<any[]> {
    const promises = Array(count).fill(null).map(() => this.create())
    return Promise.all(promises)
  }
}

// Usage in tests
test('create test data via API', async ({ page }) => {
  const builder = new APIBuilder(page)
  
  // Create single filament
  const filament = await builder.filament()
    .withMaterial('PLA')
    .withColor('Red')
    .withInventory(1000)
    .create()
  
  // Create multiple products
  const products = await builder.product()
    .withFilament(filament)
    .createMany(5)
  
  // Create complex scenario
  const scenario = await builder.scenario()
    .withInventory()
    .withProducts()
    .withPrintJobs()
    .create()
})
```

### Step 6: Usage Examples
```python
# Backend test example
def test_complex_cogs_calculation(db_session):
    # Build complete scenario
    scenario = ScenarioBuilder(db_session)\
        .with_inventory_setup(filament_count=10)\
        .with_product_catalog(product_count=20)\
        .with_print_jobs(job_count=5)\
        .build()
    
    # Test COGS calculation
    for job in scenario['print_jobs']:
        cogs = calculate_cogs(job)
        assert cogs > 0

# Simple builder usage
def test_user_permissions(db_session):
    admin = UserBuilder().as_admin().build(db_session)
    regular = UserBuilder().build(db_session)
    
    assert admin.is_admin == True
    assert regular.is_admin == False

# Specific data
def test_filament_api(client, db_session):
    filament = FilamentBuilder()\
        .with_material("PLA")\
        .with_color("Specific Red")\
        .in_price_range(20, 25)\
        .build(db_session)
    
    response = client.get(f"/api/filaments/{filament.id}")
    assert response.json()["color"] == "Specific Red"
```

```typescript
// Frontend test example
test('inventory management flow', async ({ page }) => {
  const builder = new APIBuilder(page)
  
  // Create realistic inventory
  const filaments = await builder.filament()
    .withMaterial('PLA')
    .createMany(5)
  
  // Add purchases
  for (const filament of filaments) {
    await builder.purchase()
      .forFilament(filament)
      .withGrams(1000)
      .create()
  }
  
  // Navigate and verify
  await page.goto('/dashboard/inventory')
  
  for (const filament of filaments) {
    await expect(page.locator(`text=${filament.color}`)).toBeVisible()
  }
})
```

## Guidelines for Implementation

### DO:
1. **Use fluent interface** for readable test data creation
2. **Provide sensible defaults** using Faker
3. **Handle relationships** automatically
4. **Support both API and direct creation**
5. **Make builders composable**

### DON'T:
1. **Don't hardcode test data** in builders
2. **Don't make builders too complex**
3. **Don't forget to handle errors**
4. **Don't create circular dependencies**
5. **Don't mix concerns** - builders should only build

### Best Practices
- One builder per model/entity
- Use traits for common variations
- Keep builders stateless when possible
- Document builder methods
- Test the builders themselves

### Success Metrics
- 80% reduction in test data setup code
- Consistent test data across all tests
- Easy to create complex scenarios
- Self-documenting test setup
- Faster test writing