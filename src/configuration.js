const ConfigStore = require('configstore');
const pkg = require('../package.json');
const defaultConfig = require('./default.config');
const deepMerge = require('deepMerge');

const systemConfig = new ConfigStore(pkg.name, {}, { globalConfigPath: true });

module.exports = {
  getSystemConfig() {
    return deepMerge(defaultConfig, systemConfig);
  },

  getUserConfig(userOptions) {
    const systemConfig = this.getSystemConfig();

    return deepMerge(systemConfig, userOptions);
  }
}
