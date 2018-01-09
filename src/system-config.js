const ConfigStore = require('configstore');
const pkg = require('../package.json');
const defaultConfig = require('./default.config');
const utils = require('./utils');
const deepMerge = require('deepmerge');
const fs = require('graceful-fs');
const path = require('path');

const globalConfig = new ConfigStore(pkg.name, {}, { globalConfigPath: true });

let systemConfig;

module.exports = {
  initSystemConfig(watchFolder) {
    const localConfigPath = path.resolve(watchFolder || process.cwd(), '.quantumsync/quantumsync.config.json');
    let localConfig = {};
    if (fs.existsSync(localConfigPath)) {
      try {
        localConfig = JSON.parse(fs.readFileSync(localConfigPath).toString());
      } catch(e) {
        console.error('[QuantumSync] invalid configuration file localConfigPath: ' + e);
      }
    }
    systemConfig = deepMerge(deepMerge(defaultConfig, globalConfig), localConfig);
    const sslOptions = systemConfig.sslOptions;
    ['pfx', 'key', 'cert'].forEach((fileKey) => {
      if (sslOptions[fileKey]) {
        const filePath = utils.getFullPathIfRelativePath(sslOptions[fileKey], watchFolder);
        if (fs.existsSync(filePath)) {
          sslOptions[fileKey] = fs.readFileSync(filePath);
        }
      }
    })
    
  },

  getSystemConfig() {
    if (!systemConfig) {
      this.initSystemConfig();
    }
    return systemConfig;
  },

  getUserConfig(userOptions) {
    const systemConfig = this.getSystemConfig();

    return deepMerge(systemConfig, userOptions);
  }
}
