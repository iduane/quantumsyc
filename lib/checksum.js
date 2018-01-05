'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ignore = require('ignore');
const utils = require('./utils');
const systemConfig = require('./system-config');
const upath = require('upath');

const walk = (() => {
  var _ref = _asyncToGenerator(function* (fullPath, watchFolder) {
    if (typeof watchFolder === 'undefined') watchFolder = fullPath;
    const ig = ignore().add(systemConfig.getSystemConfig().ignores);
    const state = yield utils.lstatResource(fullPath);
    let resouceMap = {};

    const relativePath = upath.normalize(path.relative(watchFolder, fullPath));
    const ignored = ig.ignores(relativePath);

    if (state.isDirectory()) {
      if (!ignored && relativePath !== '' && relativePath !== '.') {
        resouceMap[relativePath] = {
          isFolder: true,
          mtime: state.mtime
        };
      }

      const resources = yield utils.readDir(fullPath);
      for (let i = 0; i < resources.length; i++) {
        const childFullPath = path.resolve(fullPath, resources[i]);
        const childMap = yield walk(childFullPath, watchFolder);
        resouceMap = utils.mergeMap(resouceMap, childMap);
      }
    } else if (!ignored && state.isFile()) {
      const md5 = crypto.createHash('md5');
      const fileData = yield utils.readFile(fullPath);
      md5.update(fileData);
      resouceMap[relativePath] = {
        isFile: true,
        digest: md5.digest('hex'),
        mtime: state.mtime.getTime()
      };
    }

    return resouceMap;
  });

  return function walk(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

module.exports = walk;