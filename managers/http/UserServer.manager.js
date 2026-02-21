const http              = require('http');
const express           = require('express');
const cors              = require('cors');
const rateLimit   = require('express-rate-limit');
const app               = express();

module.exports = class UserServer {
    constructor({config, managers}){
        this.config        = config;
        this.userApi       = managers.userApi;
    }
    
    /** for injecting middlewares */
    use(args){
        app.use(args);
    }

    /** server configs */
    run(){
        app.use(cors({origin: '*'}));
        app.use(express.json());
        app.use(express.urlencoded({ extended: true}));
        app.use('/static', express.static('public'));

        /** Rate limiting */
        app.use(rateLimit({
            windowMs: 60 * 1000,
            max: 100,
            message: { ok: false, data: {}, errors: ['too many requests'], message: 'slow down' }
        }));

        /** Global error handler */
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).send({
                ok: false,
                data: {},
                errors: ['internal server error'],
                message: 'Something went wrong',
            });
        });
        
        /** a single middleware to handle all */
        app.all('/api/:moduleName/:fnName/:id?', this.userApi.mw);

        let server = http.createServer(app);
        server.listen(this.config.dotEnv.USER_PORT, () => {
            console.log(`${(this.config.dotEnv.SERVICE_NAME).toUpperCase()} is running on port: ${this.config.dotEnv.USER_PORT}`);
        });
    }
}