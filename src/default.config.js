const path = require('path');

module.exports = {
    path: path.resolve(process.cwd(), '.'),
    interval: 1000, // ms
    subscribe: { // subscribe command options

    },
    usePassword: true,
    useSSL: false,
    sslOptions: {
        key: '/path/to/key.pem',
        cert: '/path/to/cert.pem',
        // passphrase: '',
    },
    port: 12359,
    host: '127.0.0.1',
    ignores: [
        '.git',
        '.svn',
        '.hg',
        'CVS',
        '.DS_Store',
        'node_modules',
        '.history',
        '.swp',
        '.quantumsync'
    ],
    timeout: 1000,
    syncRules: {
        // FIXME: add test cases for all rules
        sameFileConfict: 'checkModifyTime', // 'useServer', 'userClient',
        fileMissingOnClient: 'downloadToLocal', // 'deleteServer'
        fileMissingOnSever: 'uploadToServer', // 'deleteLocal'
    }
};
