const ConfigStore = require('configstore');
const pkg = require('../package.json');
const defaultConfig = require('./default.config');
const deepMerge = require('deepMerge');

const userConfig = new ConfigStore(pkg.name, {}, { globalConfigPath: true });

module.exports = deepMerge(defaultConfig, userConfig);
