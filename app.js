const config                = require('./config/index.config.js');
const Cortex                = require('ion-cortex');
const ManagersLoader        = require('./loaders/ManagersLoader.js');
const mongoose              = require('mongoose');
const bcrypt                = require('bcrypt');

const mongoDB = config.dotEnv.MONGO_URI? require('./connect/mongo')({
    uri: config.dotEnv.MONGO_URI
}):null;

const cache = require('./cache/cache.dbh')({
    prefix: config.dotEnv.CACHE_PREFIX ,
    url: config.dotEnv.CACHE_REDIS
});

const cortex = new Cortex({
    prefix: config.dotEnv.CORTEX_PREFIX,
    url: config.dotEnv.CORTEX_REDIS,
    type: config.dotEnv.CORTEX_TYPE,
    state: ()=>{
        return {} 
    },
    activeDelay: "50ms",
    idlDelay: "200ms",
});

// Auto-seed superadmin on startup
const seedSuperadmin = async () => {
    try {
        // Ensure User model is loaded
        require('./managers/entities/user/user.mongoModel');
        const User = mongoose.model('User');
        
        const existing = await User.findOne({ role: 'superadmin' });
        if (!existing) {
            await User.create({
                username: config.dotEnv.SUPER_USERNAME || 'superadmin',
                email: config.dotEnv.SUPER_EMAIL || 'super@admin.com',
                password: config.dotEnv.SUPER_PASSWORD || 'Admin@1234',
                role: 'superadmin',
                schoolId: null,
            });
            console.log('✅ Superadmin created automatically');
            console.log(`   Email: ${config.dotEnv.SUPER_EMAIL || 'super@admin.com'}`);
            console.log(`   Password: ${config.dotEnv.SUPER_PASSWORD || 'Admin@1234'}`);
        } else {
            console.log('ℹ️  Superadmin already exists');
        }
    } catch (err) {
        console.log('⚠️  Superadmin seed error:', err.message);
    }
};

const managersLoader = new ManagersLoader({config, cache, cortex});
const managers = managersLoader.load();

// Seed after models are loaded and MongoDB is connected
if (mongoDB) {
    mongoDB.then(() => {
        setTimeout(() => seedSuperadmin(), 3000);
    }).catch(err => {
        console.error('MongoDB connection failed:', err.message);
    });
}

managers.userServer.run();
