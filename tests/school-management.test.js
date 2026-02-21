const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');

/**
 * School Management System — Test Suite
 * 
 * Run with: npm test
 * Setup: npm install --save-dev jest
 * Add to package.json scripts: "test": "jest --runInBand --forceExit"
 * 
 * These tests use direct manager instantiation (unit style) 
 * and mock dependencies — no live DB or Redis required.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSchool = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Greenfield Academy',
    address: '123 Main St, Lagos',
    email: 'info@greenfield.edu',
    phone: '+2348012345678',
    isActive: true,
    createdAt: new Date(),
};

const mockClassroom = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Room 101',
    schoolId: mockSchool._id,
    capacity: 30,
    resources: ['projector'],
    isActive: true,
};

const mockStudent = {
    _id: new mongoose.Types.ObjectId(),
    name: 'John Doe',
    email: 'john@student.com',
    schoolId: mockSchool._id,
    classroomId: null,
    isActive: true,
};

const mockSuperadmin = {
    _id: new mongoose.Types.ObjectId(),
    username: 'superadmin',
    email: 'super@admin.com',
    role: 'superadmin',
    schoolId: null,
};

const mockSchoolAdmin = {
    _id: new mongoose.Types.ObjectId(),
    username: 'schooladmin',
    email: 'admin@greenfield.edu',
    role: 'school_admin',
    schoolId: mockSchool._id,
};

const superadminToken = { userId: mockSuperadmin._id, role: 'superadmin', schoolId: null };
const schoolAdminToken = { userId: mockSchoolAdmin._id, role: 'school_admin', schoolId: mockSchool._id };

// ─── Mock mongomodels factory ─────────────────────────────────────────────────

const makeMockModels = (overrides = {}) => ({
    school: {
        findOne: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockResolvedValue(mockSchool),
        find: jest.fn().mockResolvedValue([mockSchool]),
        create: jest.fn().mockResolvedValue(mockSchool),
        findByIdAndUpdate: jest.fn().mockResolvedValue(mockSchool),
        ...overrides.school,
    },
    classroom: {
        findOne: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockResolvedValue(mockClassroom),
        find: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue([mockClassroom]),
        })),
        create: jest.fn().mockResolvedValue(mockClassroom),
        findByIdAndUpdate: jest.fn().mockResolvedValue(mockClassroom),
        ...overrides.classroom,
    },
    student: {
        findOne: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockReturnThis(),
        })),
        find: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockReturnThis(),
        })),
        create: jest.fn().mockResolvedValue(mockStudent),
        findByIdAndUpdate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(mockStudent),
        })),
        ...overrides.student,
    },
    user: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ ...mockSuperadmin, password: 'hashed', isActive: true }),
        ...overrides.user,
    },
});

// ─── Mock validators factory ──────────────────────────────────────────────────

const makeMockValidators = () => ({
    school: {
        createSchool: jest.fn().mockResolvedValue(null),
        updateSchool: jest.fn().mockResolvedValue(null),
    },
    classroom: {
        createClassroom: jest.fn().mockResolvedValue(null),
        updateClassroom: jest.fn().mockResolvedValue(null),
    },
    student: {
        createStudent: jest.fn().mockResolvedValue(null),
        updateStudent: jest.fn().mockResolvedValue(null),
    },
    user: {
        createUser: jest.fn().mockResolvedValue(null),
        login: jest.fn().mockResolvedValue(null),
    },
});

// ─── Manager imports ──────────────────────────────────────────────────────────

const School    = require('../managers/entities/school/School.manager');
const Classroom = require('../managers/entities/classroom/Classroom.manager');
const Student   = require('../managers/entities/student/Student.manager');
const User      = require('../managers/entities/user/User.manager');

// ─── SCHOOL TESTS ─────────────────────────────────────────────────────────────

describe('School Manager', () => {

    let manager;

    beforeEach(() => {
        manager = new School({
            validators:  makeMockValidators(),
            mongomodels: makeMockModels(),
        });
    });

    describe('v1_createSchool', () => {
        it('should create a school when called by superadmin', async () => {
            manager.mongomodels.school.findOne.mockResolvedValue(null);
            const result = await manager.v1_createSchool({
                name: 'Greenfield Academy',
                address: '123 Main St',
                email: 'info@greenfield.edu',
                __shortToken: superadminToken,
            });
            expect(result.school).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should reject school creation by school_admin', async () => {
            const result = await manager.v1_createSchool({
                name: 'New School',
                address: '456 Other St',
                email: 'info@new.edu',
                __shortToken: schoolAdminToken,
            });
            expect(result.error).toMatch(/forbidden/i);
        });

        it('should reject duplicate school email', async () => {
            manager.mongomodels.school.findOne.mockResolvedValue(mockSchool);
            const result = await manager.v1_createSchool({
                name: 'Another School',
                address: '789 St',
                email: 'info@greenfield.edu',
                __shortToken: superadminToken,
            });
            expect(result.error).toMatch(/already exists/i);
        });

        it('should return validation errors for missing required fields', async () => {
            manager.validators.school.createSchool.mockResolvedValue([{ field: 'name', message: 'required' }]);
            const result = await manager.v1_createSchool({
                __shortToken: superadminToken,
            });
            expect(result.errors).toBeDefined();
        });
    });

    describe('v1_getSchool', () => {
        it('should return a school for superadmin', async () => {
            const result = await manager.v1_getSchool({
                __shortToken: superadminToken,
                __params: { id: mockSchool._id.toString() },
            });
            expect(result.school).toBeDefined();
        });

        it('should block school_admin from accessing another school', async () => {
            const otherSchoolId = new mongoose.Types.ObjectId().toString();
            const result = await manager.v1_getSchool({
                __shortToken: schoolAdminToken,
                __params: { id: otherSchoolId },
            });
            expect(result.error).toMatch(/forbidden/i);
        });

        it('should return 404 if school not found', async () => {
            manager.mongomodels.school.findById.mockResolvedValue(null);
            const result = await manager.v1_getSchool({
                __shortToken: superadminToken,
                __params: { id: new mongoose.Types.ObjectId().toString() },
            });
            expect(result.error).toMatch(/not found/i);
            expect(result.code).toBe(404);
        });
    });

    describe('v1_deleteSchool', () => {
        it('should soft delete a school as superadmin', async () => {
            const result = await manager.v1_deleteSchool({
                __shortToken: superadminToken,
                __params: { id: mockSchool._id.toString() },
            });
            expect(result.message).toMatch(/deleted/i);
        });

        it('should reject delete by school_admin', async () => {
            const result = await manager.v1_deleteSchool({
                __shortToken: schoolAdminToken,
                __params: { id: mockSchool._id.toString() },
            });
            expect(result.error).toMatch(/forbidden/i);
        });
    });

    describe('v1_listSchools', () => {
        it('should allow school_admin to view their own school', async () => {
            const result = await manager.v1_getSchool({
                __shortToken: schoolAdminToken,
                __params: { id: mockSchool._id.toString() },
            });
            expect(result.school).toBeDefined();
        });
    });
});

// ─── CLASSROOM TESTS ──────────────────────────────────────────────────────────

describe('Classroom Manager', () => {

    let manager;

    beforeEach(() => {
        manager = new Classroom({
            validators:  makeMockValidators(),
            mongomodels: makeMockModels(),
        });
    });

    describe('v1_createClassroom', () => {
        it('should create a classroom as superadmin for any school', async () => {
            const result = await manager.v1_createClassroom({
                name: 'Room 101',
                capacity: 30,
                schoolId: mockSchool._id.toString(),
                __shortToken: superadminToken,
            });
            expect(result.classroom).toBeDefined();
        });

        it('should create a classroom as school_admin for their own school', async () => {
            const result = await manager.v1_createClassroom({
                name: 'Room 102',
                capacity: 25,
                __shortToken: schoolAdminToken,
            });
            expect(result.classroom).toBeDefined();
        });

        it('should block school_admin from creating classroom in another school', async () => {
            const otherSchoolId = new mongoose.Types.ObjectId().toString();
            const result = await manager.v1_createClassroom({
                name: 'Room 103',
                capacity: 25,
                schoolId: otherSchoolId,
                __shortToken: schoolAdminToken,
            });
            expect(result.error).toMatch(/forbidden/i);
        });

        it('should return 404 if school does not exist', async () => {
            manager.mongomodels.school.findById.mockResolvedValue(null);
            const result = await manager.v1_createClassroom({
                name: 'Room 104',
                capacity: 20,
                schoolId: mockSchool._id.toString(),
                __shortToken: superadminToken,
            });
            expect(result.error).toMatch(/not found/i);
        });
    });

    describe('v1_listClassrooms', () => {
        it('should return all classrooms for superadmin', async () => {
            const result = await manager.v1_listClassrooms({
                __shortToken: superadminToken,
                __query: {},
            });
            expect(result.classrooms).toBeDefined();
        });

        it('should scope classrooms to school for school_admin', async () => {
            await manager.v1_listClassrooms({
                __shortToken: schoolAdminToken,
                __query: {},
            });
            expect(manager.mongomodels.classroom.find).toHaveBeenCalledWith(
                expect.objectContaining({ schoolId: mockSchool._id })
            );
        });
    });

    describe('v1_updateClassroom', () => {
        it('should update classroom successfully', async () => {
            manager.mongomodels.classroom.findById = jest.fn().mockResolvedValue(mockClassroom);
            const result = await manager.v1_updateClassroom({
                name: 'Updated Room',
                capacity: 40,
                __shortToken: superadminToken,
                __params: { id: mockClassroom._id.toString() },
            });
            expect(result.classroom).toBeDefined();
        });
    });
});

// ─── STUDENT TESTS ────────────────────────────────────────────────────────────

describe('Student Manager', () => {

    let manager;

    beforeEach(() => {
        manager = new Student({
            validators:  makeMockValidators(),
            mongomodels: makeMockModels(),
        });
    });

    describe('v1_createStudent', () => {
        it('should create a student as school_admin in their school', async () => {
            const result = await manager.v1_createStudent({
                name: 'John Doe',
                email: 'john@student.com',
                __shortToken: schoolAdminToken,
            });
            expect(result.student).toBeDefined();
        });

        it('should reject duplicate student email', async () => {
            manager.mongomodels.student.findOne.mockResolvedValue(mockStudent);
            const result = await manager.v1_createStudent({
                name: 'John Doe',
                email: 'john@student.com',
                __shortToken: schoolAdminToken,
            });
            expect(result.error).toMatch(/already exists/i);
        });

        it('should reject student creation in another school by school_admin', async () => {
            const otherSchoolId = new mongoose.Types.ObjectId().toString();
            const result = await manager.v1_createStudent({
                name: 'Jane Doe',
                email: 'jane@student.com',
                schoolId: otherSchoolId,
                __shortToken: schoolAdminToken,
            });
            expect(result.error).toMatch(/forbidden/i);
        });
    });

    describe('v1_transferStudent', () => {
        it('should transfer student to a new classroom', async () => {
            const newClassroomId = new mongoose.Types.ObjectId().toString();
            manager.mongomodels.student.findById = jest.fn().mockResolvedValue(mockStudent);
            manager.mongomodels.classroom.findOne = jest.fn().mockResolvedValue(mockClassroom);
            manager.mongomodels.student.findByIdAndUpdate = jest.fn().mockImplementation(() => ({
                populate: jest.fn().mockResolvedValue({ ...mockStudent, classroomId: newClassroomId }),
            }));

            const result = await manager.v1_transferStudent({
                classroomId: newClassroomId,
                __shortToken: schoolAdminToken,
                __params: { id: mockStudent._id.toString() },
            });
            expect(result.message).toMatch(/transferred/i);
        });

        it('should reject transfer to classroom in different school', async () => {
            manager.mongomodels.student.findById = jest.fn().mockResolvedValue(mockStudent);
            manager.mongomodels.classroom.findOne = jest.fn().mockResolvedValue(null);
            const result = await manager.v1_transferStudent({
                classroomId: new mongoose.Types.ObjectId().toString(),
                __shortToken: schoolAdminToken,
                __params: { id: mockStudent._id.toString() },
            });
            expect(result.error).toMatch(/not found/i);
        });
    });

    describe('v1_updateStudent', () => {
        it('should update student successfully', async () => {
            manager.mongomodels.student.findById = jest.fn().mockResolvedValue(mockStudent);
            manager.mongomodels.student.findByIdAndUpdate = jest.fn().mockResolvedValue({ ...mockStudent, name: 'Updated Name' });
            const result = await manager.v1_updateStudent({
                name: 'Updated Name',
                __shortToken: schoolAdminToken,
                __params: { id: mockStudent._id.toString() },
            });
            expect(result.student).toBeDefined();
        });
    });

    describe('v1_listStudents', () => {
        it('should list students with filters', async () => {
            const result = await manager.v1_listStudents({
                __shortToken: schoolAdminToken,
                __query: { classroomId: mockClassroom._id.toString() },
            });
            expect(result.students).toBeDefined();
        });
    });
});

// ─── USER / AUTH TESTS ────────────────────────────────────────────────────────

describe('User Manager', () => {

    let manager;
    const mockTokenManager = {
        genLongToken: jest.fn().mockReturnValue('mock.long.token'),
    };

    beforeEach(() => {
        manager = new User({
            validators:   makeMockValidators(),
            mongomodels:  makeMockModels(),
            managers:     { token: mockTokenManager },
        });
    });

    describe('v1_createUser', () => {
        it('should create a user as superadmin', async () => {
            const result = await manager.v1_createUser({
                username: 'newadmin',
                email: 'newadmin@school.com',
                password: 'password123',
                role: 'school_admin',
                schoolId: mockSchool._id.toString(),
                __shortToken: superadminToken,
            });
            expect(result.user).toBeDefined();
            expect(result.longToken).toBeDefined();
        });

        it('should reject user creation by school_admin', async () => {
            const result = await manager.v1_createUser({
                username: 'hacker',
                email: 'hacker@school.com',
                password: 'password123',
                role: 'school_admin',
                __shortToken: schoolAdminToken,
            });
            expect(result.error).toMatch(/forbidden/i);
        });

        it('should reject duplicate email', async () => {
            manager.mongomodels.user.findOne.mockResolvedValue(mockSuperadmin);
            const result = await manager.v1_createUser({
                username: 'newadmin2',
                email: 'super@admin.com',
                password: 'password123',
                role: 'school_admin',
                schoolId: mockSchool._id.toString(),
                __shortToken: superadminToken,
            });
            expect(result.error).toMatch(/already in use/i);
        });
    });

    describe('v1_login', () => {
        it('should return longToken on valid credentials', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            manager.mongomodels.user.findOne.mockResolvedValue({
                ...mockSuperadmin,
                password: hashedPassword,
                isActive: true,
            });

            const result = await manager.v1_login({
                email: 'super@admin.com',
                password: 'password123',
            });
            expect(result.longToken).toBeDefined();
            expect(result.user).toBeDefined();
        });

        it('should reject invalid password', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            manager.mongomodels.user.findOne.mockResolvedValue({
                ...mockSuperadmin,
                password: hashedPassword,
                isActive: true,
            });

            const result = await manager.v1_login({
                email: 'super@admin.com',
                password: 'wrongpassword',
            });
            expect(result.error).toMatch(/invalid credentials/i);
        });

        it('should reject non-existent user', async () => {
            manager.mongomodels.user.findOne.mockResolvedValue(null);
            const result = await manager.v1_login({
                email: 'nobody@nowhere.com',
                password: 'password123',
            });
            expect(result.error).toMatch(/invalid credentials/i);
        });

        it('should reject inactive user login', async () => {
            manager.mongomodels.user.findOne.mockResolvedValue({
                ...mockSuperadmin,
                password: await bcrypt.hash('password123', 10),
                isActive: false,
            });
            const result = await manager.v1_login({
                email: 'super@admin.com',
                password: 'password123',
            });
            expect(result.error).toMatch(/inactive/i);
        });
    });
});