module.exports = {
    local: {
        path: '',
    },
    remote: {
        type: 'ssh',
    },
    watchman: {
        subscribe: {
            ignoreDirs: []
        }
    },
    sync: {
        interval: 1000, // ms
    }
};
