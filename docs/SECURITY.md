# Security Configuration

## Important: Before Deploying to Production

This application includes default development credentials that **MUST** be changed before production use.

### Required Security Steps:

1. **Generate a secure JWT secret key**:
   ```bash
   openssl rand -hex 32
   ```
   Set this value in your environment as `JWT_SECRET_KEY`.

2. **Change default superadmin credentials**:
   - Set `SUPERADMIN_EMAIL` to your admin email
   - Set `SUPERADMIN_PASSWORD` to a strong password
   - These can be set in `.env` files or environment variables

3. **Configure CORS properly**:
   - Update CORS settings in `backend/app/main.py` to only allow your frontend domain
   - Do not use `allow_origins=["*"]` in production

4. **Use HTTPS in production**:
   - Ensure all API calls use HTTPS
   - Set secure cookies flags

5. **Database security**:
   - Never commit the `.db` file to version control
   - Use proper database backups
   - Consider migrating from SQLite to PostgreSQL for production

## Default Development Credentials

For development only:
- Default admin email: `admin@example.com`
- Default admin password: `changeme123`

**WARNING**: These credentials are publicly visible in this repository. They are intended for local development only and must be changed for any deployment.

## Environment Variables

See `.env.example` files in both `backend/` and `frontend/` directories for required configuration.