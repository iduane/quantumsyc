'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const fs = require('graceful-fs');
const path = require('path');
const utils = require('./utils');
const upath = require('upath');
const LRU = require("lru-cache");

let changeMap = new LRU({ max: 100000, maxAge: 1000 * 60 * 60 });
let cache = new LRU({ max: 1000, maxAge: 1000 * 60 * 5 });
let watchedPath;
let logName;

module.exports = class ConflictResolve {
  constructor(projectPath, vehiclleName) {
    watchedPath = projectPath;
    logName = vehiclleName;
    this.reset();
  }

  reset() {
    this.emptyChanges();
    this.emptyCache();
  }

  removeChange(relPath) {
    changeMap.del(relPath);
  }

  reduceChanges(changes = {}) {
    for (let relPath in changes) {
      const cachedChange = changeMap.get(relPath);
      if (cachedChange) {
        if (cachedChange.clock < changes[relPath].clock) {
          changeMap.set(relPath, changes[relPath]);
        }
      } else {
        changeMap.set(relPath, changes[relPath]);
      }
    }
  }

  commitChanges() {
    var _this = this;

    return _asyncToGenerator(function* () {
      function ignoreLoopback(relPath) {
        changeMap.del(relPath);
        cache.del(relPath);
        // console.log('[QuantumSync] ' + logName + ' ignore loopback for ' + relPath);
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = changeMap.keys()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          let relPath = _step.value;

          const cacheItem = cache.get(relPath);
          if (cacheItem) {
            if (cacheItem.type === 'file') {
              if (cacheItem.status === 'changed' && cacheItem.data) {
                const fullPath = path.resolve(watchedPath, relPath);
                const fileExist = yield utils.exitsResource(fullPath);
                const localData = yield utils.readFile(fullPath);
                if (!fileExist || cacheItem.data.equals(localData)) {
                  // console.log('[QuantumSync] ' + logName + ' ignore loopback for ' + relPath);
                  ignoreLoopback(relPath);
                }
              } else if (cacheItem.status === 'deleted' && changeMap.get(relPath).op === 'delete') {
                ignoreLoopback(relPath);
              }
            } else if (cacheItem.type === 'folder') {
              if (cacheItem.status === 'deleted' && changeMap.get(relPath).op === 'delete' || cacheItem.status === 'changed' && changeMap.get(relPath).op === 'new') {
                ignoreLoopback(relPath);
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      const map = {};
      changeMap.forEach(function (change, relPath) {
        map[relPath] = change;
      });
      _this.emptyChanges();
      return utils.toList(map);
    })();
  }

  emptyChanges() {
    changeMap.reset();
  }

  updateCache(filePath, desciptor) {
    const relPath = upath.normalize(path.relative(watchedPath, filePath));
    cache.set(relPath, desciptor);

    this.removeChange(relPath);
  }

  removeCache(path) {
    const relPath = path.relative(watchedPath, filePath);
    cache.del(relPath);
  }

  emptyCache() {
    cache.reset();
  }
};

// function tripSyncChange(incChanges, syncChanges, folder) {
//   for (let localPath in incChanges) {
//     const desc = incChanges[localPath];
//     const fullPath = desc.fullPath || path.resolve(folder, localPath);
//     desc.fullPath = fullPath;
//     if (syncChanges[fullPath]) {
//       delete incChanges[localPath];
//       delete syncChanges[fullPath];
//     }
//   }
// }