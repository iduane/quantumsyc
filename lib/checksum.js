'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ignore = require('ignore');
const utils = require('./utils');
const systemConfig = require('./system-config');

const walk = function walk(fullPath, watchFolder) {
  if (typeof watchFolder === 'undefined') watchFolder = fullPath;
  const ig = ignore().add(systemConfig.getSystemConfig().ignores);
  const state = fs.statSync(fullPath);
  let resouceMap = {};

  const relativePath = path.relative(watchFolder, fullPath);
  if (relativePath === '' || !ig.ignores(relativePath)) {
    if (state.isDirectory()) {
      if (relativePath !== '') {
        resouceMap[relativePath] = {
          isFolder: true,
          mtime: state.mtime
        };
      }

      const resources = fs.readdirSync(fullPath);
      resources.forEach(localPath => {
        const childFullPath = path.resolve(fullPath, localPath);

        resouceMap = utils.mergeMap(resouceMap, walk(childFullPath, watchFolder));
      });
    } else if (state.isFile()) {
      const md5 = crypto.createHash('md5');
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