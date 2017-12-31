'use strict';

var ConfigStore = require('configstore');
var pkg = require('../package.json');
var defaultConfig = require('./default.config');
var utils = require('./utils');
var deepMerge = require('deepmerge');
var fs = require('fs');
var path = require('path');

var globalConfig = new ConfigStore(pkg.name, {}, { globalConfigPath: true });

var systemConfig = void 0;

module.exports = {
  initSystemConfig: function initSystemConfig(watchFolder) {
    var localConfigPath = path.resolve(watchFolder || process.cwd(), '.quantumsync/quantumsync.config.json');
    var localConfig = {};
    if (fs.existsSync(localConfigPath)) {
      try {
        localConfig = JSON.parse(fs.readFileSync(localConfigPath).toString());
      } catch (e) {
        console.error('[QuantumSync] invalid configuration file localConfigPath: ' + e);
      }
    }
    systemConfig = deepMerge(deepMerge(defaultConfig, globalConfig), localConfig);
    var sslOptions = systemConfig.sslOptions;
    ['pfx', 'key', 'cert'].forEach(function (fileKey) {
      if (sslOptions[fileKey]) {
        var filePath = utils.getFullPathIfRelativePath(sslOptions[fileKey], watchFolder);
        if (fs.existsSync(filePath)) {
          sslOptions[fileKey] = fs.readFileSync(filePath);
        }
      }
    });
  },
  getSystemConfig: function getSystemConfig() {
    if (!systemConfig) {
      this.initSystemConfig();
    }
    return systemConfig;
  },
  getUserConfig: function getUserConfig(userOptions) {
    var systemConfig = this.getSystemConfig();

    return deepMerge(systemConfig, userOptions);
  }
};