const bcrypt = require('bcrypt');

module.exports = class User {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config          = config;
        this.cortex          = cortex;
        this.validators      = validators;
        this.mongomodels     = mongomodels;
        this.tokenManager    = managers.token;
        this.httpExposed     = [
            'v1_createUser',
            'v1_login',
        ];
    }

    async v1_createUser({ username, email, password, role, schoolId, __shortToken }) {
        // RBAC — only superadmin can create users
        if (__shortToken.role !== 'superadmin') {
            return { error: 'forbidden: only superadmin can create users', code: 403 };
        }

        const user = { username, email, password, role };

        // Validate
        let errors = await this.validators.user.createUser(user);
        if (errors) return { errors };

        // school_admin must have a schoolId
        if (role === 'school_admin' && !schoolId) {
            return { error: 'schoolId is required when creating a school_admin' };
        }

        // Confirm school exists if schoolId provided
        if (schoolId) {
            const school = await this.mongomodels.school.findById(schoolId);
            if (!school) return { error: 'school not found', code: 404 };
        }

        // Check if email or username already exists
        const existingUser = await this.mongomodels.user.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            if (existingUser.email === email) return { error: 'email already in use' };
            if (existingUser.username === username) return { error: 'username already in use' };
        }

        // Create user
        const createdUser = await this.mongomodels.user.create({ 
            username, email, password, role,
            schoolId: role === 'superadmin' ? null : schoolId,
        });

        // Generate tokens
        const longToken = this.tokenManager.genLongToken({
            userId: createdUser._id,
            userKey: createdUser.username,
            role:     createdUser.role,
            schoolId: createdUser.schoolId,
        });

        return {
            user: {
                _id: createdUser._id,
                username: createdUser.username,
                email: createdUser.email,
                role: createdUser.role,
                schoolId: createdUser.schoolId,
            },
            longToken,
        };
    }

    async v1_login({ email, password }) {
        // Validate
        let errors = await this.validators.user.login({ email, password });
        if (errors) return { errors };

        // Find user
        const user = await this.mongomodels.user.findOne({ email });
        if (!user) return { error: 'invalid credentials' };

        // Check if user is active
        if (!user.isActive) return { error: 'account is inactive', code: 403 };

        // Check password
        const match = await bcrypt.compare(password, user.password);
        if (!match) return { error: 'invalid credentials' };

        // Generate long token with role and schoolId embedded
        const longToken = this.tokenManager.genLongToken({
            userId:   user._id,
            userKey:  user.username,
            role:     user.role,
            schoolId: user.schoolId,
        });

        return {
            user: {
                _id:      user._id,
                username: user.username,
                email:    user.email,
                role:     user.role,
                schoolId: user.schoolId,
            },
            longToken,
        };
    }
}