const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ignore = require('ignore');
const utils = require('./utils');
const systemConfig = require('./system-config');
const upath = require('upath');

const walk = async function(fullPath, watchFolder) {
  if (typeof watchFolder === 'undefined') watchFolder = fullPath;
  const ig = ignore().add(systemConfig.getSystemConfig().ignores);
  const state = await utils.lstatResource(fullPath);
  let resouceMap = {};

  const relativePath = upath.normalize(path.relative(watchFolder, fullPath));
  const ignored = ig.ignores(relativePath);

  if (state.isDirectory()) {
    if (!ignored && relativePath !== '' && relativePath !== '.') {
      resouceMap[relativePath] = {
        isFolder: true,
        mtime: state.mtime,
      };
    }

    const resources = await utils.readDir(fullPath);
    for (let i = 0; i < resources.length; i++) {
      const childFullPath = path.resolve(fullPath, resources[i]);
      const childMap = await walk(childFullPath, watchFolder);
      resouceMap = utils.mergeMap(resouceMap, childMap);
    }
  } else if (!ignored && state.isFile()) {
    const md5 = crypto.createHash('md5');
    const fileData = await utils.readFile(fullPath);
    md5.update(fileData);
    resouceMap[relativePath] = {
      isFile: true,
      digest: md5.digest('hex'),
      mtime: state.mtime.getTime(),
    };
  }


  return resouceMap;
}

module.exports = walk;
