'use strict';

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var ignore = require('ignore');
var utils = require('./utils');
var systemConfig = require('./system-config');

var walk = function walk(fullPath, watchFolder) {
  if (typeof watchFolder === 'undefined') watchFolder = fullPath;
  var ig = ignore().add(systemConfig.getSystemConfig().ignores);
  var state = fs.statSync(fullPath);
  var resouceMap = {};

  var relativePath = path.relative(watchFolder, fullPath);
  if (relativePath === '' || !ig.ignores(relativePath)) {
    if (state.isDirectory()) {
      if (relativePath !== '') {
        resouceMap[relativePath] = {
          isFolder: true,
          mtime: state.mtime
        };
      }

      var resources = fs.readdirSync(fullPath);
      resources.forEach(function (localPath) {
        var childFullPath = path.resolve(fullPath, localPath);

        resouceMap = utils.mergeMap(resouceMap, walk(childFullPath, watchFolder));
      });
    } else if (state.isFile()) {
      var md5 = crypto.createHash('md5');
      md5.update(fs.readFileSync(fullPath));
      resouceMap[relativePath] = {
        isFile: true,
        digest: md5.digest('hex'),
        mtime: state.mtime.getTime()
      };
    }
  }

  return resouceMap;
};

module.exports = walk;