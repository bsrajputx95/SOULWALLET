I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The SoulWallet workspace contains an Expo/React Native frontend with authentication UI screens that currently use dummy implementations. No backend infrastructure exists - the login and signup flows simply navigate to the main app without API calls. The frontend already has `expo-secure-store` and `zod` installed, indicating readiness for backend integration. The provided specification outlines a complete Express/Prisma/PostgreSQL backend with JWT authentication to be deployed on Railway.

## Approach

This plan follows a sequential implementation strategy for building a standalone Node.js backend service. The backend will be created as a separate project outside the current Expo workspace, following the exact specification provided. The implementation prioritizes a minimal, production-ready authentication API with proper validation, security, and deployment configuration. The approach emphasizes Railway-specific optimizations including database migration handling, environment variable management, and health monitoring endpoints.

## Implementation Steps

### 1. Project Initialization & Dependencies

Create a new directory `soulwallet-backend` at the same level as the current workspace (not inside it). Initialize the Node.js project and install all required dependencies:

**Core dependencies:**
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT token generation/validation
- `@prisma/client` - Database ORM client
- `zod` - Schema validation
- `dotenv` - Environment variable management
- `express-rate-limit` - API rate limiting

**Development dependencies:**
- `typescript` - Type safety
- `@types/*` - Type definitions for all core packages
- `ts-node` - TypeScript execution
- `prisma` - Database schema management
- `nodemon` - Development auto-reload

Initialize TypeScript and Prisma configurations using `npx tsc --init` and `npx prisma init`.

### 2. Database Schema Design

Create the Prisma schema in `file:prisma/schema.prisma`:

**User Model:**
- `id` (String, CUID primary key)
- `username` (String, unique, indexed)
- `email` (String, unique, indexed)
- `password` (String, hashed)
- `createdAt` (DateTime, auto-generated)

Configure PostgreSQL as the datasource with connection URL from environment variables. The schema uses CUID for user IDs to avoid sequential enumeration attacks. Both username and email have unique constraints to prevent duplicates.

### 3. Environment Configuration

Create two environment files:

**`.env` (gitignored):**
- `DATABASE_URL` - PostgreSQL connection string (format: `postgresql://user:pass@localhost:5432/soulwallet`)
- `JWT_SECRET` - Random 32+ character string for token signing
- `PORT` - Server port (default: 3000)

**`.env.example` (committed):**
Template file with empty values for documentation purposes.

### 4. Database Client Setup

Create `file:src/db.ts` to export a singleton Prisma client instance. This centralizes database access and ensures connection pooling works correctly. The client will be imported by the server for all database operations.

### 5. Server Implementation

Build the complete Express server in `file:src/server.ts`:

**Middleware Stack:**
1. CORS configuration (allow all origins for development)
2. JSON body parser
3. JWT secret validation (fail fast if missing)
4. Rate limiter (100 requests per 15 minutes per IP)
5. Request logging middleware (logs timestamp, method, path)

**Type Definitions:**
- `AuthRequest` interface extending Express Request with optional `userId` property

**Validation Schemas (Zod):**
- `registerSchema`: username (3-30 chars, alphanumeric+underscore), email, password (min 6 chars), confirmPassword with refinement to check password match
- `loginSchema`: emailOrUsername (flexible input), password

**Authentication Middleware:**
- Extract Bearer token from Authorization header
- Verify JWT signature using `JWT_SECRET`
- Decode userId and attach to request object
- Return 401 for missing/invalid tokens

**Endpoints:**

**POST `/register`:**
- Validate request body against `registerSchema`
- Hash password with bcrypt (10 salt rounds)
- Normalize username and email to lowercase
- Create user in database with selected fields only (exclude password)
- Generate JWT token with 30-day expiration
- Handle Prisma P2002 error (unique constraint violation) → 409 Conflict
- Handle Zod validation errors → 400 Bad Request
- Return user object and token on success (201 Created)

**POST `/login`:**
- Validate request body against `loginSchema`
- Query user by email OR username (case-insensitive)
- Compare password hash using bcrypt
- Return 401 for invalid credentials (timing-safe)
- Generate JWT token with 30-day expiration
- Return user object (without password) and token

**GET `/me` (Protected):**
- Require authentication middleware
- Fetch user by ID from token
- Return 404 if user not found
- Return user profile (exclude password)

**GET `/health`:**
- Unauthenticated endpoint for Railway monitoring
- Return JSON with status and timestamp

**404 Handler:**
- Catch-all route for undefined endpoints

**Error Handling:**
- Specific handling for Prisma errors (P2002 unique constraint)
- Zod validation error formatting
- Generic 500 errors with console logging
- Never expose sensitive error details to client

### 6. Build Configuration

**`file:package.json` scripts:**
- `dev`: Run with nodemon for development (watches TypeScript files)
- `build`: Compile TypeScript to JavaScript in `dist/` directory
- `start`: Run compiled JavaScript (production)
- `postinstall`: Generate Prisma client automatically

**`file:tsconfig.json` settings:**
- Target ES2020 for modern Node.js features
- CommonJS module system
- Output to `dist/`, source in `src/`
- Disable strict mode for faster development
- Enable esModuleInterop for library compatibility
- Skip lib checks for faster compilation

### 7. Railway Deployment Configuration

**GitHub Setup:**
- Initialize git repository in backend directory
- Create `.gitignore` (exclude `node_modules`, `.env`, `dist/`)
- Push to GitHub repository

**Railway Project:**
- Create new project from GitHub repository
- Add PostgreSQL database service (auto-provisions `DATABASE_URL`)
- Configure environment variables in Railway dashboard

**Environment Variables:**
- `JWT_SECRET`: Generate cryptographically secure random string (32+ characters)
- `DATABASE_URL`: Auto-injected by Railway PostgreSQL service

**Build Settings:**
- Build command: `npm install && npm run build`
- Start command: `npx prisma migrate deploy && npm start`
- The start command runs pending migrations before starting the server

**Deployment Flow:**
1. Railway detects package.json and runs build command
2. Installs dependencies and compiles TypeScript
3. Start command applies database migrations
4. Starts Express server on Railway-assigned PORT
5. Health endpoint becomes available for monitoring

### 8. API Documentation

Create endpoint reference for frontend integration:

| Endpoint | Method | Auth | Request Body | Response |
|----------|--------|------|--------------|----------|
| `/register` | POST | No | `{username, email, password, confirmPassword}` | `{success, user, token}` |
| `/login` | POST | No | `{emailOrUsername, password}` | `{success, user, token}` |
| `/me` | GET | Yes | - | `{success, user}` |
| `/health` | GET | No | - | `{status, timestamp}` |

**Authentication Header Format:**
```
Authorization: Bearer <jwt_token>
```

**Error Response Format:**
```json
{
  "error": "Error message"
}
```

### 9. Frontend Integration Guide

**API Client Setup:**
Create a service file in the Expo app (e.g., `file:services/api.ts`):

```typescript
const API_URL = 'https://your-app.railway.app';

async function register(data: RegisterData) {
  const response = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

async function login(data: LoginData) {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await response.json();
  if (json.token) {
    await SecureStore.setItemAsync('token', json.token);
  }
  return json;
}

async function getProfile() {
  const token = await SecureStore.getItemAsync('token');
  const response = await fetch(`${API_URL}/me`, {
    headers: { 
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}
```

**Update Authentication Screens:**
- Replace dummy implementations in `file:app/(auth)/login.tsx` (lines 59-63)
- Replace dummy implementations in `file:app/(auth)/signup.tsx` (lines 72-76)
- Call actual API functions and handle responses
- Store JWT token in SecureStore on success
- Display server error messages in UI

**State Management:**
Create auth context/store using Zustand (already installed) to manage:
- Current user state
- Authentication status
- Token persistence
- Logout functionality

### 10. Security Considerations

**Implemented Security Measures:**
- Password hashing with bcrypt (10 rounds)
- JWT tokens with expiration (30 days)
- Rate limiting (100 req/15min per IP)
- Input validation with Zod schemas
- SQL injection prevention via Prisma ORM
- Unique constraints on username/email
- Case-insensitive username/email matching
- Timing-safe password comparison
- Environment variable protection

**Production Recommendations:**
- Use HTTPS only (Railway provides this automatically)
- Implement refresh token rotation for longer sessions
- Add email verification flow
- Implement password reset functionality
- Add CORS whitelist for production domains
- Enable Helmet.js for additional HTTP headers
- Implement request logging with structured logs
- Add monitoring/alerting for failed login attempts

### 11. Testing Strategy

**Manual Testing Checklist:**
- Register new user with valid data
- Register with duplicate username/email (should fail)
- Register with invalid email format (should fail)
- Register with mismatched passwords (should fail)
- Login with username
- Login with email
- Login with wrong password (should fail)
- Access `/me` without token (should fail)
- Access `/me` with valid token
- Access `/me` with expired/invalid token (should fail)
- Verify rate limiting after 100 requests
- Check health endpoint availability

**Tools:**
- Postman/Insomnia for API testing
- Railway logs for debugging
- Prisma Studio for database inspection

### 12. Deployment Verification

**Post-Deployment Checklist:**
- Verify Railway build completed successfully
- Check database migrations applied
- Test health endpoint returns 200 OK
- Verify environment variables set correctly
- Test registration creates user in database
- Test login returns valid JWT token
- Verify CORS allows frontend domain
- Check Railway logs for errors
- Monitor response times and error rates

```mermaid
sequenceDiagram
    participant Client as Expo App
    participant Server as Express Server
    participant DB as PostgreSQL
    participant JWT as JWT Service

    Note over Client,DB: Registration Flow
    Client->>Server: POST /register {username, email, password}
    Server->>Server: Validate with Zod schema
    Server->>Server: Hash password (bcrypt)
    Server->>DB: Create user record
    DB-->>Server: User created
    Server->>JWT: Generate token (30d expiry)
    JWT-->>Server: JWT token
    Server-->>Client: {user, token}
    Client->>Client: Store token in SecureStore

    Note over Client,DB: Login Flow
    Client->>Server: POST /login {emailOrUsername, password}
    Server->>DB: Find user by email OR username
    DB-->>Server: User record
    Server->>Server: Compare password hash
    Server->>JWT: Generate token (30d expiry)
    JWT-->>Server: JWT token
    Server-->>Client: {user, token}
    Client->>Client: Store token in SecureStore

    Note over Client,DB: Protected Request Flow
    Client->>Server: GET /me (Authorization: Bearer token)
    Server->>JWT: Verify token signature
    JWT-->>Server: Decoded userId
    Server->>DB: Fetch user by ID
    DB-->>Server: User record
    Server-->>Client: {user}
```