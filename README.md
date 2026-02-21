# School Management System API

A RESTful API for managing schools, classrooms, and students — built on the [axion](https://github.com/qantra-io/axion) Node.js boilerplate.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Authentication Flow](#authentication-flow)
- [API Endpoints](#api-endpoints)
- [RBAC Permissions](#rbac-permissions)
- [Database Schema](#database-schema)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [Deployment](#deployment)
- [Assumptions](#assumptions)

---

## Architecture Overview

- **Managers** — business logic layer, one class per entity
- **Loaders** — bootstrap layer that wires all managers together via dependency injection
- **Middlewares** — auto-discovered `*.mw.js` files for request processing
- **Static Arch** — RBAC layer definitions and wildcard access config
- **Validators** — auto-discovered `*.schema.js` files, validated via `qantra-pineapple`

All API endpoints are served through a single Express route pattern:
```
/api/:moduleName/:fnName
```

---

## Prerequisites

- Node.js v16+
- MongoDB (local or Atlas)
- Redis (local or hosted)
- npm

---

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/Gee-png/school-management-system.git
cd school-management-system

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your values

# 4. Start the server
node app.js || npm run dev
```

The server runs on `http://localhost:3000` by default.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `SERVICE_NAME` | Name of the service | `school-management-system` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/school-management-system` |
| `REDIS_URI` | Redis connection string | `redis://127.0.0.1:6379` |
| `CACHE_REDIS` | Redis for cache layer | falls back to `REDIS_URI` |
| `CORTEX_REDIS` | Redis for cortex pub/sub | falls back to `REDIS_URI` |
| `USER_PORT` | HTTP server port | `3000` |
| `LONG_TOKEN_SECRET` | JWT secret for long tokens | **required** |
| `SHORT_TOKEN_SECRET` | JWT secret for short tokens | **required** |
| `NACL_SECRET` | NaCl encryption key (base64) | **required** |
| `ENV` | Environment (`development`/`production`) | `development` |

### Generating secrets for env

```bash
# Long and short token secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# NaCl secret (must be base64-encoded 32-byte key)
node -e "const nacl=require('tweetnacl');const {encodeBase64}=require('tweetnacl-util');console.log(encodeBase64(nacl.randomBytes(32)))"
```
### Run the script to create Super Admin
npm run seed
---

## Authentication Flow

```
1. POST /api/user/v1_createUser     ← superadmin creates a user (returns longToken)
2. POST /api/user/v1_login          ← user logs in (returns longToken)
3. POST /api/token/v1_createShortToken  ← exchange longToken for shortToken
                                        (send longToken in 'token' header)
4. All subsequent requests use shortToken in 'token' header
```

**Token Types:**
- **Long Token** — identifies the user, long-lived (3 years), used only to generate short tokens
- **Short Token** — used for all API calls, contains `userId`, `role`, `schoolId`, `sessionId`, `deviceId`

---

## API Endpoints
Check API_TESTING_GUIDE.md file for the detailed testing guide.

### Auth

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/api/user/v1_login` | None | Login with email + password |
| POST | `/api/token/v1_createShortToken` | Long Token | Exchange for short token |

### Users

| Method | Endpoint | Auth Required | Role |
|---|---|---|---|
| POST | `/api/user/v1_createUser` | Short Token | superadmin |

### Schools

| Method | Endpoint | Auth Required | Role |
|---|---|---|---|
| POST | `/api/school/v1_createSchool` | Short Token | superadmin |
| GET | `/api/school/v1_listSchools` | Short Token | any |
| GET | `/api/school/v1_getSchool` | Short Token | any |
| PUT | `/api/school/v1_updateSchool` | Short Token | superadmin |
| DELETE | `/api/school/v1_deleteSchool` | Short Token | superadmin |

### Classrooms

| Method | Endpoint | Auth Required | Role |
|---|---|---|---|
| POST | `/api/classroom/v1_createClassroom` | Short Token | superadmin / school_admin |
| GET | `/api/classroom/v1_listClassrooms` | Short Token | any |
| GET | `/api/classroom/v1_getClassroom` | Short Token | any |
| PUT | `/api/classroom/v1_updateClassroom` | Short Token | superadmin / school_admin |
| DELETE | `/api/classroom/v1_deleteClassroom` | Short Token | superadmin / school_admin |

### Students

| Method | Endpoint | Auth Required | Role |
|---|---|---|---|
| POST | `/api/student/v1_createStudent` | Short Token | superadmin / school_admin |
| GET | `/api/student/v1_listStudents` | Short Token | any |
| GET | `/api/student/v1_getStudent` | Short Token | any |
| PUT | `/api/student/v1_updateStudent` | Short Token | superadmin / school_admin |
| DELETE | `/api/student/v1_deleteStudent` | Short Token | superadmin / school_admin |
| PUT | `/api/student/v1_transferStudent` | Short Token | superadmin / school_admin |

---

## Request / Response Formats

### Login
```json
// POST /api/user/v1_login
// Request
{
  "email": "admin@school.com",
  "password": "yourpassword"
}

// Response
{
  "ok": true,
  "data": {
    "user": { "_id": "...", "username": "...", "email": "...", "role": "superadmin" },
    "longToken": "eyJ..."
  },
  "errors": [],
  "message": ""
}
```

### Create Short Token
```json
// POST /api/token/v1_createShortToken
// Headers: { "token": "<longToken>" }
// Body: {} (empty - sessionId and deviceId are auto-generated)

// Response
{
  "ok": true,
  "data": { "shortToken": "eyJ..." },
  "errors": [],
  "message": ""
}
```

### Create School
```json
// POST /api/school/v1_createSchool
// Headers: { "token": "<shortToken>" }
// Request
{
  "name": "Greenfield Academy",
  "address": "123 Main Street, Lagos",
  "email": "info@greenfield.edu",
  "phone": "+2348012345678"
}

// Response
{
  "ok": true,
  "data": {
    "school": {
      "_id": "...",
      "name": "Greenfield Academy",
      "address": "123 Main Street, Lagos",
      "email": "info@greenfield.edu",
      "phone": "+2348012345678",
      "isActive": true,
      "createdAt": "..."
    }
  },
  "errors": [],
  "message": ""
}
```

### Create Classroom
```json
// POST /api/classroom/v1_createClassroom
// Headers: { "token": "<shortToken>" }
// Request
{
  "name": "Room 101",
  "capacity": 30,
  "resources": ["projector", "whiteboard"],
  "schoolId": "<schoolId>"   // required if superadmin, ignored for school_admin
}
```

### Create Student
```json
// POST /api/student/v1_createStudent
// Headers: { "token": "<shortToken>" }
// Request
{
  "name": "John Doe",
  "email": "john@student.com",
  "schoolId": "<schoolId>",       // required if superadmin
  "classroomId": "<classroomId>"  // optional
}
```

### Transfer Student
```json
// PUT /api/student/v1_transferStudent/:studentId
// Headers: { "token": "<shortToken>" }
// Request body
{
  "classroomId": "<newClassroomId>"
}
```

---

## RBAC Permissions

| Action | superadmin | school_admin |
|---|---|---|
| Create / Update / Delete School | ✅ | ❌ |
| View any School | ✅ | Own school only |
| Create User | ✅ | ❌ |
| Create / Update / Delete Classroom | ✅ | Own school only |
| View Classrooms | ✅ | Own school only |
| Create / Update / Delete Student | ✅ | Own school only |
| Transfer Student | ✅ | Own school only |

---

## Database Schema

# Database Schema Design

## Entity Relationship Diagram

```
┌─────────────────────────┐
│          User           │
├─────────────────────────┤
│ _id        ObjectId  PK │
│ username   String       │
│ email      String       │
│ password   String       │
│ role       String       │◄─── 'superadmin' | 'school_admin'
│ schoolId   ObjectId  FK │───────────────────────┐
│ isActive   Boolean      │                       │
│ createdAt  Date         │                       │
│ updatedAt  Date         │                       │
└─────────────────────────┘                       │
                                                  │
┌─────────────────────────┐                       │
│         School          │◄──────────────────────┘
├─────────────────────────┤
│ _id        ObjectId  PK │◄──────────────────────┐
│ name       String       │                       │
│ address    String       │                       │
│ email      String       │                       │
│ phone      String       │                       │
│ adminId    ObjectId  FK │──► User               │
│ isActive   Boolean      │                       │
│ createdAt  Date         │                       │
│ updatedAt  Date         │                       │
└─────────────────────────┘                       │
                                                  │
┌─────────────────────────┐                       │
│        Classroom        │                       │
├─────────────────────────┤                       │
│ _id        ObjectId  PK │◄──────────────────────┼───┐
│ name       String       │                       │   │
│ schoolId   ObjectId  FK │───────────────────────┘   │
│ capacity   Number       │                           │
│ resources  [String]     │                           │
│ isActive   Boolean      │                           │
│ createdAt  Date         │                           │
│ updatedAt  Date         │                           │
└─────────────────────────┘                           │
                                                      │
┌─────────────────────────┐                           │
│         Student         │                           │
├─────────────────────────┤                           │
│ _id         ObjectId PK │                           │
│ name        String      │                           │
│ email       String      │                           │
│ schoolId    ObjectId FK │──► School                 │
│ classroomId ObjectId FK │───────────────────────────┘
│ isActive    Boolean     │
│ createdAt   Date        │
│ updatedAt   Date        │
└─────────────────────────┘
```

## Relationships

- A **User** with role `school_admin` belongs to one **School** via `schoolId`
- A **Superadmin** has `schoolId = null` (no school assignment)
- A **School** optionally references its admin via `adminId`
- A **Classroom** belongs to exactly one **School**
- A **Student** belongs to exactly one **School** and optionally one **Classroom**
- A **Student** can only be transferred to a **Classroom** within the same **School**

## Indexes

```js
// User
{ email: 1 }    // unique
{ username: 1 } // unique

// School
{ email: 1 }    // unique

// Classroom
{ schoolId: 1 } // for school-scoped queries

// Student
{ email: 1 }    // unique
{ schoolId: 1 } // for school-scoped queries
{ classroomId: 1 } // for classroom listing
```

## Soft Delete Strategy

All entities use `isActive: Boolean` instead of hard deletes. All list queries filter by `{ isActive: true }` by default. This preserves relational integrity and allows data recovery.

### User
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Auto |
| `username` | String | Unique, required |
| `email` | String | Unique, required |
| `password` | String | Bcrypt hashed |
| `role` | String | `superadmin` or `school_admin` |
| `schoolId` | ObjectId | Ref: School. Null for superadmin |
| `isActive` | Boolean | Default: true |
| `createdAt` | Date | Auto |

### School
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Auto |
| `name` | String | Required |
| `address` | String | Required |
| `email` | String | Unique, required |
| `phone` | String | Optional |
| `adminId` | ObjectId | Ref: User |
| `isActive` | Boolean | Default: true |
| `createdAt` | Date | Auto |

### Classroom
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Auto |
| `name` | String | Required |
| `schoolId` | ObjectId | Ref: School, required |
| `capacity` | Number | Required, min: 1 |
| `resources` | [String] | Default: [] |
| `isActive` | Boolean | Default: true |
| `createdAt` | Date | Auto |

### Student
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Auto |
| `name` | String | Required |
| `email` | String | Unique, required |
| `schoolId` | ObjectId | Ref: School, required |
| `classroomId` | ObjectId | Ref: Classroom, nullable |
| `isActive` | Boolean | Default: true |
| `createdAt` | Date | Auto |

---

## Error Codes

| HTTP Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 403 | Forbidden — insufficient permissions |
| 404 | Resource not found |
| 429 | Too many requests (rate limited) |
| 500 | Internal server error |

All error responses follow this shape:
```json
{
  "ok": false,
  "data": {},
  "errors": ["error detail"],
  "message": "Human readable message"
}
```

---

## Rate Limiting

| Endpoint Type | Limit |
|---|---|
| Auth endpoints (`v1_login`, `v1_createShortToken`) | 20 requests / 15 minutes |
| All other endpoints | 100 requests / minute |

---

## Deployment

### Deploy to Render (Recommended — Free & Easy)

#### Prerequisites
1. **MongoDB Atlas (Free):**
   - Sign up at https://www.mongodb.com/cloud/atlas
   - Create a free cluster
   - Get your connection string (format: `mongodb+srv://username:password@cluster.mongodb.net/dbname`)

2. **Redis (Free):**
   - Sign up at https://redis.com/try-free/ or https://upstash.com
   - Create a free database
   - Get your connection string (format: `redis://default:password@host:port`)

#### Deployment Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Create Render Account**
   - Go to https://render.com
   - Sign up (free, no credit card required)

3. **Create New Web Service**
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub account
   - Select your repository

4. **Configure Service**
   - **Name:** `school-management-api` (or your preferred name)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node app.js`
   - **Instance Type:** `Free`

5. **Add Environment Variables**
   Click **"Environment"** tab and add these variables:
   ```
   SERVICE_NAME=school-management
   MONGO_URI=<your-mongodb-atlas-connection-string>
   REDIS_URI=<your-redis-connection-string>
   CACHE_REDIS=<your-redis-connection-string>
   CORTEX_REDIS=<your-redis-connection-string>
   USER_PORT=3000
   LONG_TOKEN_SECRET=<generate-with-command-below>
   SHORT_TOKEN_SECRET=<generate-with-command-below>
   NACL_SECRET=<generate-with-command-below>
   ENV=production
   SUPER_EMAIL=super@admin.com
   SUPER_PASSWORD=Admin@1234
   SUPER_USERNAME=superadmin
   ```

   **Generate secrets locally:**
   ```bash
   # Long and short token secrets
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   
   # NaCl secret (base64)
   node -e "const nacl=require('tweetnacl');const {encodeBase64}=require('tweetnacl-util');console.log(encodeBase64(nacl.randomBytes(32)))"
   ```

6. **Deploy**
   - Click **"Create Web Service"**
   - Render will automatically build and deploy your app (~3-5 minutes)
   - You'll get a public URL like: `https://school-management-api.onrender.com`

7. **Seed Superadmin**
   After deployment, run the seed script once:
   - Go to Render dashboard → Your service → **"Shell"** tab
   - Run: `npm run seed`

#### Post-Deployment
- Your API is now live at: `https://your-app-name.onrender.com`
- Test with: `https://your-app-name.onrender.com/api/user/v1_login`
- Update your Postman `base_url` to your Render URL

#### Notes
- Free tier sleeps after 15 minutes of inactivity (first request takes ~30s to wake)
- Automatic deploys on every git push to main branch
- View logs in Render dashboard for debugging

---

## Assumptions

1. **Soft deletes** — Schools, classrooms, and students are never hard deleted. `isActive: false` marks them as deleted. This preserves data integrity and history.

2. **Superadmin seeding** — The first superadmin must be created by directly inserting into MongoDB (or via a seed script), since only a superadmin can call `v1_createUser`. This is intentional — there should never be a public endpoint to create a superadmin.

3. **School admin assignment** — A school admin is assigned to a school via their `schoolId` field at user creation time. Changing a school admin's assigned school requires a superadmin to update the user directly in the database (no endpoint for this was specified in the requirements).

4. **Student transfer** — Transfer means moving a student to a different classroom within the same school. Cross-school transfers are not supported.

5. **Token passing** — All protected endpoints expect the short token in the `token` request header (not `Authorization: Bearer`), consistent with the boilerplate convention.