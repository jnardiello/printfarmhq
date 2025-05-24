# Security and Code Quality Improvement Plan - WME HQ

## Critical Security Issues (Fix Immediately)

### 1. JWT Secret Key Hardcoded Default
**File**: `backend/app/auth.py:13`
**Issue**: JWT secret defaults to predictable value
**Fix**: 
- Generate cryptographically secure random key
- Require JWT_SECRET_KEY in environment
- Fail startup if not provided
- Add key rotation mechanism

### 3. CORS Security - All Origins Allowed
**File**: `backend/app/main.py:46-52`
**Issue**: `allow_origins=["*"]` permits any origin
**Fix**:
- Configure allowed origins from environment
- Use specific origin list for production
- Add CORS preflight handling
- Document CORS configuration

### 4. No CSRF Protection
**Issue**: API vulnerable to cross-site request forgery
**Fix**:
- Implement CSRF tokens for state-changing operations
- Use double-submit cookie pattern
- Add SameSite cookie attributes
- Validate Origin/Referer headers

### 5. JWT Storage in localStorage
**File**: `frontend/lib/auth.ts:44-45`
**Issue**: Tokens vulnerable to XSS attacks
**Fix**:
- Move to httpOnly cookies
- Implement refresh token flow
- Add token expiration handling
- Use secure flag in production

## High Priority Security Issues

### 6. File Upload Security
**File**: `backend/app/main.py:387-405`
**Issues**:
- No file size limits
- Limited file type validation
- Predictable filenames
- No virus scanning
**Fix**:
- Add file size limits (e.g., 10MB)
- Validate file content, not just extension
- Generate random filenames
- Store outside web root
- Add virus scanning integration

### 7. No Rate Limiting
**Issue**: Vulnerable to brute force and DoS
**Fix**:
- Add rate limiting middleware
- Implement account lockout after failed attempts
- Add CAPTCHA for repeated failures
- Monitor for abuse patterns

### 9. Missing Security Headers
**Issue**: No CSP, HSTS, X-Frame-Options
**Fix**:
- Add Content Security Policy
- Enable HSTS with preload
- Set X-Frame-Options DENY
- Add X-Content-Type-Options nosniff
- Implement security headers middleware

## Medium Priority Issues

### 10. Input Validation
**Issues**:
- No email format validation
- No password complexity requirements
- Missing input sanitization
**Fix**:
- Add email regex validation
- Implement password policy (min 12 chars, mixed case, numbers, symbols)
- Sanitize all user inputs
- Use parameterized queries (already done with SQLAlchemy)

### 11. Error Handling
**Issue**: Inconsistent error handling, internal details leaked
**Fix**:
- Create global error handler
- Log full errors internally
- Return generic errors to clients
- Add request ID for tracing

### 12. No Audit Logging
**Issue**: No security event logging
**Fix**:
- Log all authentication attempts
- Log permission changes
- Log sensitive operations
- Add log aggregation and monitoring

### 13. Docker Security
**Files**: `backend/Dockerfile`, `docker-compose.yml`
**Issues**:
- Running as root
- Hardcoded secrets
**Fix**:
- Create non-root user in containers
- Use Docker secrets or external secret management
- Add security scanning to CI/CD
- Use multi-stage builds

## Code Quality Improvements

### 14. Authentication Code Organization
**Issue**: Auth logic scattered across files
**Fix**:
- Centralize auth logic in auth module
- Create auth middleware
- Use dependency injection consistently
- Add comprehensive auth tests

### 15. API Structure
**Issue**: All endpoints in single file
**Fix**:
- Split into route modules
- Add API versioning (/api/v1/)
- Create OpenAPI documentation
- Add request/response schemas

### 16. Frontend Security
**Issues**:
- No input sanitization
- API URL exposed
**Fix**:
- Sanitize all user inputs before display
- Use environment variables properly
- Add frontend security tests
- Implement CSP-compatible practices

### 17. Testing
**Issue**: No security tests
**Fix**:
- Add authentication tests
- Add authorization tests
- Add input validation tests
- Add penetration testing

## Implementation Priority

### Phase 1 (Week 1) - Critical Security
1. Fix JWT secret key handling
2. Update superadmin credential system
3. Configure CORS properly
4. Move JWT to httpOnly cookies
5. Add basic rate limiting

### Phase 2 (Week 2) - Authentication & Authorization
1. Add CSRF protection
2. Implement password policies
3. Add account lockout
4. Improve error handling
5. Add security headers

### Phase 3 (Week 3) - Infrastructure
1. Migrate to PostgreSQL
2. Improve file upload security
3. Add audit logging
4. Improve Docker security
5. Add monitoring

### Phase 4 (Week 4) - Code Quality
1. Refactor authentication code
2. Split API into modules
3. Add comprehensive tests
4. Add API documentation
5. Security audit

## Testing Checklist

- [ ] Test with OWASP ZAP
- [ ] Run dependency vulnerability scan
- [ ] Test rate limiting
- [ ] Verify CORS configuration
- [ ] Test file upload restrictions
- [ ] Verify JWT expiration
- [ ] Test CSRF protection
- [ ] Check for XSS vulnerabilities
- [ ] Test SQL injection (should be protected by ORM)
- [ ] Verify error handling doesn't leak info

## Monitoring Requirements

1. Failed login attempts
2. Privilege escalation attempts
3. File upload activities
4. API error rates
5. Token validation failures
6. Database query performance
7. Resource usage

## Compliance Considerations

1. GDPR - Add data retention policies
2. Password policies for compliance
3. Audit logging for compliance
4. Data encryption at rest
5. Right to deletion implementation

## Dependencies to Add

```txt
# backend/requirements.txt additions
python-jose[cryptography]  # Better JWT handling
email-validator  # Email validation
python-multipart  # File upload handling
slowapi  # Rate limiting
python-dotenv  # Environment management
pytest  # Testing
pytest-cov  # Coverage
bandit  # Security linting
```

```json
// frontend/package.json additions
"dependencies": {
  "dompurify": "^3.0.0",  // XSS protection
  "helmet": "^7.0.0",  // Security headers
  "express-rate-limit": "^6.0.0"  // Rate limiting
}
```

## Environment Variables to Add

```bash
# Security Configuration
JWT_SECRET_KEY=<generate-with-openssl-rand-base64-32>
JWT_REFRESH_SECRET_KEY=<generate-with-openssl-rand-base64-32>
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
RATE_LIMIT_PER_MINUTE=60
MAX_LOGIN_ATTEMPTS=5
FILE_SIZE_LIMIT_MB=10
PASSWORD_MIN_LENGTH=12
SESSION_TIMEOUT_MINUTES=30
CSRF_SECRET_KEY=<generate-with-openssl-rand-base64-32>

# Monitoring
SENTRY_DSN=
LOG_LEVEL=INFO
AUDIT_LOG_ENABLED=true
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
