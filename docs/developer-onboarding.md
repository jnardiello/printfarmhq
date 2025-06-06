# Developer Onboarding Guide

Welcome to PrintFarmHQ! This guide will help you get up and running as a developer.

## 🚀 Quick Start (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/printfarmhq.git
cd printfarmhq

# 2. Start development environment
make dev

# 3. Open in your browser
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

That's it! You now have a fully functional development environment with:
- ✅ Hot reload for both frontend and backend
- ✅ Database migrations automatically applied
- ✅ All services running in Docker containers

## 📁 Project Structure

```
printfarmhq/
├── frontend/          # Next.js React application
│   ├── app/          # App router pages
│   ├── components/   # React components
│   └── lib/          # Utilities and helpers
├── backend/          # FastAPI Python application
│   ├── app/          # Main application code
│   │   ├── models.py # SQLAlchemy database models
│   │   ├── main.py   # FastAPI app entry point
│   │   └── auth.py   # Authentication logic
│   ├── alembic/      # Database migrations
│   └── tests/        # Backend tests
├── database/         # SQLite container configuration
├── docs/            # Documentation
└── Makefile         # Development commands
```

## 🛠️ Development Workflow

### 1. Making Backend Changes

#### Modifying API Endpoints
```python
# backend/app/main.py or create new routers
@app.post("/api/products")
async def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    # Your code here
    pass
```

#### Modifying Database Models
```python
# backend/app/models.py
class Product(Base):
    __tablename__ = "products"
    # Add new field
    discount_percentage = Column(Float, default=0.0)
```

After model changes:
```bash
# Create and apply migration
make migrate-create DESC="Add discount to products"
make migrate
```

### 2. Making Frontend Changes

#### Creating New Pages
```typescript
// frontend/app/discounts/page.tsx
export default function DiscountsPage() {
  return <div>Discounts Management</div>
}
```

#### Adding Components
```typescript
// frontend/components/discount-badge.tsx
export function DiscountBadge({ discount }: { discount: number }) {
  return <Badge>{discount}% OFF</Badge>
}
```

### 3. Database Migrations

**Every database change needs a migration!**

```bash
# After changing models.py
make migrate-create DESC="Describe your change"

# Review the generated file
cat backend/alembic/versions/latest_migration.py

# Apply it
make migrate

# If something goes wrong
make migrate-revert
```

📚 See [Migration Workflow Guide](./database-migrations-workflow.md) for details.

## 🧪 Testing

### Running Tests
```bash
# All tests
make test

# Backend only
make test-backend

# Frontend only
make test-frontend
```

### Writing Backend Tests
```python
# backend/tests/test_products.py
def test_create_product(client, db_session):
    response = client.post("/api/products", json={
        "name": "Test Product",
        "sku": "TEST-001"
    })
    assert response.status_code == 200
```

### Writing Frontend Tests
```typescript
// frontend/e2e/tests/products.spec.ts
test('create product', async ({ page }) => {
  await page.goto('/products')
  await page.click('text=Add Product')
  // ... test interactions
})
```

## 🔍 Debugging

### Backend Debugging
```python
# Add breakpoints
import pdb; pdb.set_trace()

# Or use logging
import logging
logger = logging.getLogger(__name__)
logger.info(f"Product created: {product.id}")
```

View logs:
```bash
make logs
# or
docker logs printfarmhq-backend -f
```

### Frontend Debugging
- Use browser DevTools
- React Developer Tools extension
- Console.log debugging
- Next.js error overlay

### Database Debugging
```bash
# Connect to database
docker exec -it printfarmhq-database sqlite3 /data/hq.db

# Common queries
.tables
.schema products
SELECT * FROM products LIMIT 10;
```

## 🚢 Deployment Process

### Local Testing
```bash
# Test production build locally
make up

# Verify everything works
curl http://localhost:8000/health
```

### Creating a Release
1. Ensure all tests pass: `make test`
2. Update version in relevant files
3. Create PR with your changes
4. After merge, tag the release

## 📚 Key Documentation

1. **Database Migrations**
   - [Quick Reference](./migrations-quick-reference.md) - Cheat sheet
   - [Workflow Guide](./database-migrations-workflow.md) - Full workflow
   - [Technical Guide](./alembic-migration-guide.md) - Deep dive

2. **Architecture**
   - [Database Guide](../database/README.md) - Database architecture
   - [API Docs](http://localhost:8000/docs) - Auto-generated API docs

3. **Best Practices**
   - Always create migrations for model changes
   - Write tests for new features
   - Use meaningful commit messages
   - Review generated migrations carefully

## 🤝 Getting Help

- **Documentation**: Check `/docs` folder
- **API Reference**: http://localhost:8000/docs when running
- **Team Chat**: Ask in #printfarmhq-dev channel
- **Issues**: Create GitHub issue for bugs

## 🎯 Common Tasks

### Add a New API Endpoint
1. Create route in `backend/app/main.py` or new router file
2. Add request/response schemas in `schemas.py`
3. Write business logic
4. Add tests
5. Update frontend to use new endpoint

### Add a New Page
1. Create page in `frontend/app/your-page/page.tsx`
2. Add navigation link if needed
3. Implement data fetching
4. Add loading and error states
5. Write E2E tests

### Modify Database Schema
1. Update model in `backend/app/models.py`
2. Run `make migrate-create DESC="Your change"`
3. Review generated migration
4. Run `make migrate`
5. Update related API endpoints and tests

## ⚡ Pro Tips

1. **Use `make help`** to see all available commands
2. **Keep migrations small** - easier to review and rollback
3. **Test locally first** - `make dev` before `make up`
4. **Check logs often** - `make logs` is your friend
5. **Document complex code** - future you will thank you

Welcome to the team! 🎉