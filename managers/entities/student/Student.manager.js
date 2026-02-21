module.exports = class Student {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config      = config;
        this.cortex      = cortex;
        this.validators  = validators;
        this.mongomodels = mongomodels;
        this.httpExposed = [
            'v1_createStudent',
            'get=v1_getStudent',
            'get=v1_listStudents',
            'put=v1_updateStudent',
            'delete=v1_deleteStudent',
            'put=v1_transferStudent',
        ];
    }

    _isAuthorized({ role, schoolId, targetSchoolId }) {
        if (role === 'superadmin') return true;
        if (role === 'school_admin' && schoolId?.toString() === targetSchoolId?.toString()) return true;
        return false;
    }

    async v1_createStudent({ name, email, schoolId, classroomId, __shortToken }) {
        // RBAC — superadmin can create in any school, school_admin only in their own
        let targetSchoolId;
        
        if (__shortToken.role === 'school_admin') {
            // school_admin cannot specify schoolId, always use their assigned school
            if (schoolId && schoolId !== __shortToken.schoolId?.toString()) {
                return { error: 'forbidden: school_admin cannot create students in other schools', code: 403 };
            }
            targetSchoolId = __shortToken.schoolId;
        } else {
            // superadmin must provide schoolId
            if (!schoolId) return { error: 'schoolId is required' };
            targetSchoolId = schoolId;
        }

        // Validate
        let errors = await this.validators.student.createStudent({ name, email });
        if (errors) return { errors };

        // Confirm school exists
        const school = await this.mongomodels.school.findById(targetSchoolId);
        if (!school) return { error: 'school not found', code: 404 };

        // Confirm classroom belongs to school if provided
        if (classroomId) {
            const classroom = await this.mongomodels.classroom.findOne({ _id: classroomId, schoolId: targetSchoolId });
            if (!classroom) return { error: 'classroom not found in this school', code: 404 };
        }

        // Check for duplicate email
        const existing = await this.mongomodels.student.findOne({ email });
        if (existing) return { error: 'student with this email already exists' };

        const student = await this.mongomodels.student.create({
            name,
            email,
            schoolId: targetSchoolId,
            classroomId: classroomId || null,
        });

        return { student };
    }

    async v1_getStudent({ __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'student id is required' };

        const student = await this.mongomodels.student.findById(id)
            .populate('schoolId', 'name')
            .populate('classroomId', 'name');
        if (!student || !student.isActive) return { error: 'student not found', code: 404 };

        if (!this._isAuthorized({ role: __shortToken.role, schoolId: __shortToken.schoolId, targetSchoolId: student.schoolId._id })) {
            return { error: 'forbidden: access denied', code: 403 };
        }

        return { student };
    }

    async v1_listStudents({ __shortToken, __query }) {
        const filter = { isActive: true };

        if (__shortToken.role === 'school_admin') {
            filter.schoolId = __shortToken.schoolId;
        } else if (__query?.schoolId) {
            filter.schoolId = __query.schoolId;
        }

        if (__query?.classroomId) {
            filter.classroomId = __query.classroomId;
        }

        const students = await this.mongomodels.student.find(filter)
            .populate('schoolId', 'name')
            .populate('classroomId', 'name');

        return { students };
    }

    async v1_updateStudent({ name, email, __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'student id is required' };

        const student = await this.mongomodels.student.findById(id);
        if (!student || !student.isActive) return { error: 'student not found', code: 404 };

        if (!this._isAuthorized({ role: __shortToken.role, schoolId: __shortToken.schoolId, targetSchoolId: student.schoolId })) {
            return { error: 'forbidden: access denied', code: 403 };
        }

        // Validate
        let errors = await this.validators.student.updateStudent({ name, email });
        if (errors) return { errors };

        // Check for duplicate email if email is being changed
        if (email && email !== student.email) {
            const existing = await this.mongomodels.student.findOne({ email, _id: { $ne: id } });
            if (existing) return { error: 'student with this email already exists' };
        }

        const updated = await this.mongomodels.student.findByIdAndUpdate(
            id,
            { $set: { name, email } },
            { new: true }
        );

        return { student: updated };
    }

    async v1_deleteStudent({ __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'student id is required' };

        const student = await this.mongomodels.student.findById(id);
        if (!student || !student.isActive) return { error: 'student not found', code: 404 };

        if (!this._isAuthorized({ role: __shortToken.role, schoolId: __shortToken.schoolId, targetSchoolId: student.schoolId })) {
            return { error: 'forbidden: access denied', code: 403 };
        }

        await this.mongomodels.student.findByIdAndUpdate(id, { $set: { isActive: false } });

        return { message: 'student deleted successfully' };
    }

    async v1_transferStudent({ classroomId, __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'student id is required' };
        if (!classroomId) return { error: 'classroomId is required' };

        const student = await this.mongomodels.student.findById(id);
        if (!student || !student.isActive) return { error: 'student not found', code: 404 };

        if (!this._isAuthorized({ role: __shortToken.role, schoolId: __shortToken.schoolId, targetSchoolId: student.schoolId })) {
            return { error: 'forbidden: access denied', code: 403 };
        }

        // Confirm classroom belongs to student's school and is active
        const classroom = await this.mongomodels.classroom.findOne({
            _id: classroomId,
            schoolId: student.schoolId,
            isActive: true,
        });
        if (!classroom) return { error: 'classroom not found in student\'s school', code: 404 };

        const updated = await this.mongomodels.student.findByIdAndUpdate(
            id,
            { $set: { classroomId } },
            { new: true }
        ).populate('classroomId', 'name');

        return { student: updated, message: 'student transferred successfully' };
    }
}