module.exports = class School {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config      = config;
        this.cortex      = cortex;
        this.validators  = validators;
        this.mongomodels = mongomodels;
        this.httpExposed = [
            'v1_createSchool',
            'get=v1_getSchool',
            'get=v1_listSchools',
            'put=v1_updateSchool',
            'delete=v1_deleteSchool',
        ];
    }

    async v1_createSchool({ name, address, email, phone, __shortToken }) {
        // RBAC — only superadmin can create schools
        if (__shortToken.role !== 'superadmin') {
            return { error: 'forbidden: only superadmin can create schools', code: 403 };
        }

        // Validate
        let errors = await this.validators.school.createSchool({ name, address, email, phone });
        if (errors) return { errors };

        // Check duplicate
        const existing = await this.mongomodels.school.findOne({ email });
        if (existing) return { error: 'school with this email already exists' };

        // Create
        const school = await this.mongomodels.school.create({ name, address, email, phone });

        return { school };
    }

    async v1_getSchool({ __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'school id is required' };

        // school_admin can only view their own school
        if (__shortToken.role === 'school_admin') {
            if (__shortToken.schoolId?.toString() !== id) {
                return { error: 'forbidden: access denied', code: 403 };
            }
        }

        const school = await this.mongomodels.school.findById(id);
        if (!school || !school.isActive) return { error: 'school not found', code: 404 };

        return { school };
    }

    async v1_listSchools({ __shortToken }) {
        // only superadmin sees all schools
        if (__shortToken.role === 'superadmin') {
            const schools = await this.mongomodels.school.find({ isActive: true });
            return { schools };
        }

        // everyone else is scoped to their own school only
        if (!__shortToken.schoolId) return { error: 'no school assigned to this user', code: 403 };
        const school = await this.mongomodels.school.findOne({ _id: __shortToken.schoolId, isActive: true });
        if (!school) return { error: 'school not found', code: 404 };
        return { schools: [school] };
    }

    async v1_updateSchool({ name, address, email, phone, __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'school id is required' };

        // RBAC — only superadmin can update schools
        if (__shortToken.role !== 'superadmin') {
            return { error: 'forbidden: only superadmin can update schools', code: 403 };
        }

        // Validate
        let errors = await this.validators.school.updateSchool({ name, address, email, phone });
        if (errors) return { errors };

        // Check for duplicate email if email is being changed
        if (email) {
            const existing = await this.mongomodels.school.findOne({ email, _id: { $ne: id } });
            if (existing) return { error: 'school with this email already exists' };
        }

        const school = await this.mongomodels.school.findByIdAndUpdate(
            id,
            { $set: { name, address, email, phone } },
            { new: true, runValidators: true }
        );
        if (!school || !school.isActive) return { error: 'school not found', code: 404 };

        return { school };
    }

    async v1_deleteSchool({ __shortToken, __params }) {
        const { id } = __params;
        if (!id) return { error: 'school id is required' };

        // RBAC — only superadmin can delete schools
        if (__shortToken.role !== 'superadmin') {
            return { error: 'forbidden: only superadmin can delete schools', code: 403 };
        }

        const school = await this.mongomodels.school.findById(id);
        if (!school || !school.isActive) return { error: 'school not found', code: 404 };

        await this.mongomodels.school.findByIdAndUpdate(id, { $set: { isActive: false } });

        return { message: 'school deleted successfully' };
    }
}