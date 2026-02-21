# API Testing Guide

## Quick Start

1. **Import the Postman Collection**
   - Open Postman
   - Click **File** → **Import**
   - Select `postman_collection.json` from the project root
   - The collection will load with all endpoints organized by resource

2. **Set Environment Variables**
   - Replace the variables in the collection:
     - `base_url`: Your server URL (default: `http://localhost:3000`)
     - `longToken`: Get this from the **Login** endpoint response
     - `shortToken`: Get this from the **Create Short Token** endpoint response
     - `schoolId`, `classroomId`, `studentId`: IDs from created resources

## Testing Sequence

### 1. Authentication Flow

#### Login
- **Endpoint:** `POST /api/user/v1_login`
- **Body:**
  ```json
  {
    "email": "admin@example.com",
    "password": "password123"
  }
  ```
- **Response:** Returns `user` object and `longToken`
- **Action:** Copy the `longToken` from response and set it as the `longToken` variable in Postman

#### Create Short Token (Required for API calls)
- **Endpoint:** `POST /api/token/v1_createShortToken`
- **Headers:** Include the `longToken` in `token` header
- **Body:** `{}` (empty - sessionId and deviceId are auto-generated)
- **Response:** Returns `shortToken`
- **Action:** Copy the `shortToken` from response and set it as the `shortToken` variable in Postman
- **Use:** All subsequent API calls require this shortToken

---

### 2. Schools Management (Superadmin)

#### Create School
- **Endpoint:** `POST /api/school/v1_createSchool`
- **Authorization:** Use superadmin `shortToken`
- **Body:**
  ```json
  {
    "name": "St. Mary's High School",
    "address": "500 Education Lane, City",
    "email": "stmarys@school.edu",
    "phone": "+1-555-9999"
  }
  ```
- **Action:** Save the returned `_id` as `{{schoolId}}`

#### List Schools
- **Endpoint:** `GET /api/school/v1_listSchools`
- **Authorization:** shortToken (superadmin sees all; school_admin sees only their own)
- **Response:** Array of schools with `_id`, `name`, `address`, etc.

#### Get School by ID
- **Endpoint:** `GET /api/school/v1_getSchool/{{schoolId}}`
- **Authorization:** shortToken
- **Response:** Single school object

#### Update School
- **Endpoint:** `PUT /api/school/v1_updateSchool/{{schoolId}}`
- **Authorization:** Superadmin shortToken only
- **Body:**
  ```json
  {
    "name": "St. Mary's High School - Updated",
    "address": "600 New Education Lane, City",
    "email": "newstmarys@school.edu",
    "phone": "+1-555-8888"
  }
  ```

#### Delete School (Soft Delete)
- **Endpoint:** `DELETE /api/school/v1_deleteSchool/{{schoolId}}`
- **Authorization:** Superadmin shortToken only
- **Response:** Success message (marks `isActive: false`)

---

### 3. Classrooms Management

#### Create Classroom
- **Endpoint:** `POST /api/classroom/v1_createClassroom`
- **Authorization:** shortToken (superadmin or school_admin for their school)
- **Body:**
  ```json
  {
    "name": "Grade 9 Biology",
    "capacity": 30,
    "resources": ["microscope", "projector", "lab equipment"],
    "schoolId": "{{schoolId}}"
  }
  ```
- **Note:** For school_admin, `schoolId` is optional (uses their own)
- **Action:** Save returned `_id` as `{{classroomId}}`

#### List Classrooms
- **Endpoint:** `GET /api/classroom/v1_listClassrooms?schoolId={{schoolId}}`
- **Authorization:** shortToken
- **Query Parameters:**
  - `schoolId` (required for superadmin; ignored for school_admin)

#### Get Classroom by ID
- **Endpoint:** `GET /api/classroom/v1_getClassroom/{{classroomId}}`
- **Authorization:** shortToken
- **Response:** Classroom with populated `schoolId` (school name)

#### Update Classroom
- **Endpoint:** `PUT /api/classroom/v1_updateClassroom/{{classroomId}}`
- **Authorization:** shortToken
- **Body:**
  ```json
  {
    "name": "Grade 9 Biology - Advanced",
    "capacity": 35,
    "resources": ["microscope", "projector", "lab equipment", "tablets"]
  }
  ```

#### Delete Classroom
- **Endpoint:** `DELETE /api/classroom/v1_deleteClassroom/{{classroomId}}`
- **Authorization:** shortToken
- **Response:** Success message (soft delete)

---

### 4. Students Management

#### Create Student
- **Endpoint:** `POST /api/student/v1_createStudent`
- **Authorization:** shortToken
- **Body:**
  ```json
  {
    "name": "Alice Johnson",
    "email": "alice.johnson@school.edu",
    "schoolId": "{{schoolId}}",
    "classroomId": "{{classroomId}}"
  }
  ```
- **Note:** `classroomId` is optional; must belong to the same school
- **Action:** Save returned `_id` as `{{studentId}}`

#### List Students
- **Endpoint:** `GET /api/student/v1_listStudents?schoolId={{schoolId}}&classroomId={{classroomId}}`
- **Authorization:** shortToken
- **Query Parameters:**
  - `schoolId` (optional for superadmin)
  - `classroomId` (optional; filters by classroom)
- **Response:** Array of students with populated school and classroom names

#### Get Student by ID
- **Endpoint:** `GET /api/student/v1_getStudent/{{studentId}}`
- **Authorization:** shortToken
- **Response:** Student object with populated relationships

#### Update Student
- **Endpoint:** `PUT /api/student/v1_updateStudent/{{studentId}}`
- **Authorization:** shortToken
- **Body:**
  ```json
  {
    "name": "Alice Johnson - Updated",
    "email": "alice.updated@school.edu"
  }
  ```

#### Transfer Student to Classroom
- **Endpoint:** `PUT /api/student/v1_transferStudent/{{studentId}}`
- **Authorization:** shortToken
- **Body:**
  ```json
  {
    "classroomId": "{{classroomId}}"
  }
  ```
- **Note:** Classroom must belong to the same school as the student

#### Delete Student
- **Endpoint:** `DELETE /api/student/v1_deleteStudent/{{studentId}}`
- **Authorization:** shortToken
- **Response:** Success message (soft delete)

---

## Authorization Rules (RBAC)

| Feature | Superadmin | School Admin | Notes |
|---------|-----------|-------------|-------|
| Create User | ✓ | ✗ | Only superadmin can create users |
| Create School | ✓ | ✗ | Only superadmin can create schools |
| Update School | ✓ | ✗ | Only superadmin can update schools |
| Delete School | ✓ | ✗ | Only superadmin can delete schools |
| Create Classroom | ✓ (any school) | ✓ (own school) | Superadmin specifies schoolId; admin uses their own |
| Create Student | ✓ (any school) | ✓ (own school) | Same as classrooms |
| Update/Delete Classroom/Student | ✓ (any) | ✓ (own school) | School_admin limited to their school |

---

## Environment Setup for Testing

### For Development:
```bash
# Ensure MongoDB and Redis are running
# Update .env with:
USER_PORT=3000
MONGO_URI=mongodb://localhost:27017/axion
CACHE_REDIS=redis://localhost:6379
CORTEX_REDIS=redis://localhost:6379

# Start the server
node app.js || npm run dev
```

### Postman Variables:
Set these in the collection or environment:
- `base_url`: `http://localhost:3000`
- `longToken`: (populated after login)
- `shortToken`: (populated after creating short token)
- `schoolId`: (ID from created school)
- `classroomId`: (ID from created classroom)
- `studentId`: (ID from created student)

---

## Error Handling

All endpoints follow standard HTTP status codes:

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Student created successfully |
| 400 | Bad Request | Validation errors (errors array returned) |
| 403 | Forbidden | User lacks permission for operation |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Internal server error |

---

## Common Testing Scenarios

### Scenario 1: Full School Setup
1. Login as superadmin (get longToken)
2. Create short token (get shortToken)
3. Create a school
4. Create classrooms in that school
5. Create students and assign to classrooms

### Scenario 2: School Admin Workflow
1. Login as school_admin (user with role `school_admin`, get longToken)
2. Create short token (get shortToken)
3. List/view their assigned school
4. Create classrooms in their school
5. Manage students in their school only
6. Cannot access other schools' data

### Scenario 3: Student Transfer
1. Create a student in classroom A
2. Create classroom B in the same school
3. Transfer student to classroom B using `v1_transferStudent`
4. Verify student now belongs to classroom B

---

## Notes

- All soft deletes mark `isActive: false` (data is not permanently deleted)
- Tokens expire after 3 years (long token) or 1 year (short token)
- Rate limiting: 100 requests per 60 seconds
- Login returns `longToken`, which must be exchanged for `shortToken`
- All protected endpoints require `token` header with `shortToken`
- Validation errors return details in `errors` array
