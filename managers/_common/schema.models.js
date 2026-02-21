const emojis = require('../../public/emojis.data.json');

module.exports = {
    id: {
        path: 'id',
        type: 'string',
        length: { min: 1, max: 50 },
    },
    classroomId: {
        path: 'classroomId',
        type: 'string',
        length: { min: 1, max: 50 },
    },
    schoolId: {
        path: 'schoolId',
        type: 'string',
        length: { min: 1, max: 50 },
    },
    username: {
        path: 'username',
        type: 'string',
        length: { min: 3, max: 20 },
        custom: 'username',
        onError: {
            required: 'username is required',
            length:   'username must be between 3 and 20 characters',
            type:     'username must be a string',
            custom:   'username can only contain letters, numbers, underscores, and hyphens',
        },
    },
    password: {
        path: 'password',
        type: 'string',
        length: { min: 8, max: 100 },
        regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#\-])[A-Za-z\d@$!%*?&_#\-]{8,}$/,
        onError: {
            required: 'password is required',
            length:   'password must be between 8 and 100 characters',
            type:     'password must be a string',
            regex:   'password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&_#-)',
        },
    },
    name: {
        path: 'name',
        type: 'string',
        length: { min: 2, max: 100 },
        onError: {
            required: 'name is required',
            length:   'name must be between 2 and 100 characters',
            type:     'name must be a string',
        },
    },
    address: {
        path: 'address',
        type: 'string',
        length: { min: 5, max: 300 },
        onError: {
            required: 'address is required',
            length:   'address must be between 5 and 300 characters',
            type:     'address must be a string',
        },
    },
    phone: {
        path: 'phone',
        type: 'string',
        length: { min: 7, max: 20 },
        onError: {
            length: 'phone number must be between 7 and 20 characters',
            type:   'phone must be a string',
        },
    },
    email: {
        path: 'email',
        type: 'string',
        regex: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        onError: {
            required: 'email is required',
            regex:    'please provide a valid email address',
            type:     'email must be a string',
        },
    },
    role: {
        path: 'role',
        type: 'string',
        oneOf: ['superadmin', 'school_admin'],
        onError: {
            required: 'role is required',
            oneOf:    'role must be either superadmin or school_admin',
            type:     'role must be a string',
        },
    },
    capacity: {
        path: 'capacity',
        type: 'number',
        onError: {
            required: 'capacity is required',
            type:     'capacity must be a number',
        },
    },
    resources: {
        path: 'resources',
        type: 'Array',
        items: {
            type: 'string',
            length: { min: 1, max: 100 },
        },
        onError: {
            type:  'resources must be an array',
            items: 'each resource must be a non-empty string under 100 characters',
        },
    },
    bool: {
        type: 'Boolean',
    },
}