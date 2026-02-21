module.exports = {
    createStudent: [
        { model: 'name',  required: true },
        { model: 'email', required: true },
    ],
    updateStudent: [
        { model: 'name',  required: false },
        { model: 'email', required: false },
    ],
    transferStudent: [
        { model: 'classroomId', required: true },
    ],
}