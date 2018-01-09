'use strict';

let persistCache = (() => {
  var _ref = _asyncToGenerator(function* (folderPath) {
    const cachePath = path.resolve(folderPath, cacheRelPath);
    yield utils.mkdirP(path.dirname(cachePath));
    yield utils.writeFile(cachePath, Buffer.from(JSON.stringify(cache || {})));
  });

  return function persistCache(_x) {
    return _ref.apply(this, arguments);
  };
})();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var _require = require('fb-watchman');

const Client = _require.Client;

const path = require('path');
const fs = require('graceful-fs');
const crypto = require('crypto');
const ignore = require('ignore');
const utils = require('./utils');
const systemConfig = require('./system-config');
const upath = require('upath');

var _require2 = require('buffer');

const Buffer = _require2.Buffer;


const client = new Client();
let cache, ig;
const cacheRelPath = '.quantumsync/.checksum-data.json';

function initCache(folderPath) {
  const cachePath = path.resolve(folderPath, cacheRelPath);
  if (fs.existsSync(cachePath)) {
    cache = require(cachePath);
  } else {
    cache = {};
  }
}

const walk = (() => {
  var _ref2 = _asyncToGenerator(function* (folderPath) {
    let getQueryResult, onQueryError, watchedFolder;
    const query = new Promise(function (resolve, reject) {
      getQueryResult = resolve;
      onQueryError = reject;
    });

    client.command(['watch-project', folderPath], function (error, resp) {
      if (error) {
        onQueryError(error);
        client.end();
        return;
      }
      watchedFolder = resp.watch || folderPath;
      const queryOptions = {
        fields: ['name', 'type', 'mtime_ms']
      };
      if (resp.relative_path) {
        queryOptions.path = [resp.relative_path];
      }
      client.command(['query', watchedFolder, queryOptions], function (error, resp) {
        if (error) {
          onQueryError(error);
          client.end();
          return;
        }
        getQueryResult(resp);
      });
    });

    const queryReuslt = yield query;
    client.end();
    const resouceMap = {};

    yield Promise.all(queryReuslt.files.map((() => {
      var _ref3 = _asyncToGenerator(function* ({ name, type, mtime_ms }) {
        const fullPath = path.resolve(watchedFolder, name);
        if (watchedFolder !== folderPath) {
          name = path.relative(folderPath, fullPath);
        }
        const relativePath = upath.normalize(name);
        const ignored = ig.ignores(relativePath);

        if (!ignored && relativePath !== '' && relativePath !== '.') {
          if (type === 'f') {
            if (cache[relativePath] && cache[relativePath].mtime === mtime_ms) {
              resouceMap[relativePath] = cache[relativePath];
            } else {
              const md5 = crypto.createHash('md5');
              const fileData = yield utils.readFile(fullPath);
              md5.update(fileData);
              cache[relativePath] = resouceMap[relativePath] = {
                isFile: true,
                digest: md5.digest('hex'),
                mtime: mtime_ms
              };
            }
          } else if (type === 'd') {
            resouceMap[relativePath] = {
              isFolder: true,
              mtime: mtime_ms
            };
          }
        }
      });

      return function (_x3) {
        return _ref3.apply(this, arguments);
      };
    })()));

    return resouceMap;
  });

  return function walk(_x2) {
    return _ref2.apply(this, arguments);
  };
})();

module.exports = (() => {
  var _ref4 = _asyncToGenerator(function* (folderPath) {
    initCache(folderPath);
    ig = ignore().add(systemConfig.getSystemConfig().ignores);
    const digest = yield walk(folderPath);
    yield persistCache(folderPath);

    return digest;
  });

  return function (_x4) {
    return _ref4.apply(this, arguments);
  };
})();