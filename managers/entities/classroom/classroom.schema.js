module.exports = {
    createClassroom: [
        { model: 'name',     required: true },
        { model: 'capacity', required: true },
    ],
    updateClassroom: [
        { model: 'name',     required: false },
        { model: 'capacity', required: false },
    ],
}