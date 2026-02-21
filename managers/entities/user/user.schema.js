module.exports = {
    createUser: [
        { model: 'username', required: true },
        { model: 'email',    required: true },
        { model: 'password', required: true },
        { model: 'role',     required: true },
    ],
    login: [
        { model: 'email',    required: true },
        { model: 'password', required: true },
    ],
}