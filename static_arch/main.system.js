const layers = {
    school: {
        _default: { anyoneCan: 'none', ownerCan: 'audit' },

        classroom: {
            _default: { inherit: true },

            student: {
                _default: { inherit: true },
            }
        }
    }
}

const actions = {
    blocked: -1,
    none: 1,
    read: 2,
    create: 3,
    update: 4,
    delete: 5,
    audit: 6,
}


module.exports = {
    layers,
    actions
}