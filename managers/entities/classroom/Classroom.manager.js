module.exports = class Classroom {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config      = config;
        this.cortex      = cortex;
        this.validators  = validators;
        this.mongomodels = mongomodels;
        this.httpExposed = [
            'v1_createClassroom',
            'get=v1_getClassroom',
            'get=v1_listClassrooms',
            'put=v1_updateClassroom',
            'delete=v1_deleteClassroom',
        ];
    }

    _isAuthorized({ role, schoolId, targetSchoolId }) {
        if (role === 'superadmin') return true;
        if (role === 'school_admin' && schoolId?.toString() === targetSchoolId?.toString()) return true;
        return false;
    }

    async v1_createClassroom({ name, capacity, resources, schoolId, __shortToken }) {
        // RBAC — superadmin can create in any school, school_admin only in their own
        let targetSchoolId;
        
        if (__shortToken.role === 'school_admin') {
            // school_admin cannot specify schoolId, always use their assigned school
            if (schoolId && schoolId !== __shortToken.schoolId?.toString()) {
                return { error: 'forbidden: school_admin cannot create classrooms in other schools', code: 403 };
            }
            targetSchoolId = __shortToken.schoolId;
        } else {
            // superadmin must provide schoolId
            if (!schoolId) return { error: 'schoolId is required' };
            targetSchoolId = schoolId;
        }

        // Validate
        let errors = await this.validators.classroom.createClassroom({ name, capacity });
        if (errors) return { errors };

        // Confirm school exists
        const school = await this.mongomodels.school.findById(targetSchoolId);
        if (!school) return { error: 'school not found', code: 404 };

        // Check for duplicate classroom name in the same school
        const existing = await this.mongomodels.classroom.findOne({ name, schoolId: targetSchoolId, isActive: true });
        if (existing) return { error: 'classroom with this name already exists in this school' };

        const classroom = await this.mongomodels.classroom.create({
            name,
            capacity,
            resources: resources || [],
            schoolId: targetSchoolId,
        });

        return { classroom };
    }

    async v1_getClassroom({ __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'classroom id is required' };

        const classroom = await this.mongomodels.classroom.findById(id).populate('schoolId', 'name');
        if (!classroom || !classroom.isActive) return { error: 'classroom not found', code: 404 };

        // school_admin can only view classrooms in their school
        if (!this._isAuthorized({ role: __shortToken.role, schoolId: __shortToken.schoolId, targetSchoolId: classroom.schoolId._id })) {
            return { error: 'forbidden: access denied', code: 403 };
        }

        return { classroom };
    }

    async v1_listClassrooms({ __shortToken, __query }) {
        const filter = { isActive: true };

        if (__shortToken.role === 'school_admin') {
            filter.schoolId = __shortToken.schoolId;
        } else if (__query?.schoolId) {
            filter.schoolId = __query.schoolId;
        }

        const classrooms = await this.mongomodels.classroom.find(filter).populate('schoolId', 'name');
        return { classrooms };
    }

    async v1_updateClassroom({ name, capacity, resources, __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'classroom id is required' };

        const classroom = await this.mongomodels.classroom.findById(id);
        if (!classroom || !classroom.isActive) return { error: 'classroom not found', code: 404 };

        if (!this._isAuthorized({ role: __shortToken.role, schoolId: __shortToken.schoolId, targetSchoolId: classroom.schoolId })) {
            return { error: 'forbidden: access denied', code: 403 };
        }

        // Validate
        let errors = await this.validators.classroom.updateClassroom({ name, capacity });
        if (errors) return { errors };

        // Check for duplicate name if name is being changed
        if (name && name !== classroom.name) {
            const existing = await this.mongomodels.classroom.findOne({ 
                name, 
                schoolId: classroom.schoolId, 
                isActive: true,
                _id: { $ne: id }
            });
            if (existing) return { error: 'classroom with this name already exists in this school' };
        }

        const updated = await this.mongomodels.classroom.findByIdAndUpdate(
            id,
            { $set: { name, capacity, resources } },
            { new: true }
        );

        return { classroom: updated };
    }

    async v1_deleteClassroom({ __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'classroom id is required' };

        const classroom = await this.mongomodels.classroom.findById(id);
        if (!classroom || !classroom.isActive) return { error: 'classroom not found', code: 404 };

        if (!this._isAuthorized({ role: __shortToken.role, schoolId: __shortToken.schoolId, targetSchoolId: classroom.schoolId })) {
            return { error: 'forbidden: access denied', code: 403 };
        }

        await this.mongomodels.classroom.findByIdAndUpdate(id, { $set: { isActive: false } });

        return { message: 'classroom deleted successfully' };
    }
}