/**
 * Superadmin Seed Script
 * 
 * Creates the initial superadmin user if one doesn't already exist.
 * 
 * Usage:
 *   node scripts/seed.js
 * 
 * Credentials are read from .env:
 *   SUPER_EMAIL
 *   SUPER_PASSWORD
 *   SUPER_USERNAME
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const SUPER_EMAIL    = process.env.SUPER_EMAIL    || 'super@admin.com';
const SUPER_PASSWORD = process.env.SUPER_PASSWORD || 'Admin@1234';
const SUPER_USERNAME = process.env.SUPER_USERNAME || 'superadmin';

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        require('../managers/entities/user/User.mongoModel');
        const User = mongoose.model('User');


        // Check if superadmin already exists
        const existing = await User.findOne({ role: 'superadmin' });
        if (existing) {
            console.log('⚠️  Superadmin already exists — skipping seed');
            process.exit(0);
        }

        // Create superadmin
        const password = await bcrypt.hash(SUPER_PASSWORD, 10);
        const superadmin = await User.create({
            username: SUPER_USERNAME,
            email:    SUPER_EMAIL,
            password: SUPER_PASSWORD, // Store plaintext for initial login, but hash it for security
            role:     'superadmin',
            schoolId: null,
        });

        console.log('🎉 Superadmin created successfully');
        console.log(`   Username : ${superadmin.username}`);
        console.log(`   Email    : ${superadmin.email}`);
        console.log(`   Role     : ${superadmin.role}`);
        console.log('');
        console.log('⚠️  Please change the default password after first login');

        process.exit(0);
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
        process.exit(1);
    }
};

run();