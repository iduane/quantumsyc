'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fs = require('fs');
var path = require('path');
var utils = require('./utils');

var changeMap = {};
var cache = {};
var watchedPath = void 0;
var logName = void 0;

module.exports = function () {
  function ConflictResolve(projectPath, vehiclleName) {
    _classCallCheck(this, ConflictResolve);

    watchedPath = projectPath;
    logName = vehiclleName;
    this.reset();
  }

  _createClass(ConflictResolve, [{
    key: 'reset',
    value: function reset() {
      this.emptyChanges();
      this.emptyCache();
    }
  }, {
    key: 'removeChange',
    value: function removeChange(relPath) {
      delete changeMap[relPath];
    }
  }, {
    key: 'reduceChanges',
    value: function reduceChanges() {
      var changes = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      for (var relPath in changes) {
        if (changeMap[relPath]) {
          if (changeMap[relPath].clock < changes[relPath].clock) {
            changeMap[relPath] = changes[relPath];
          }
        } else {
          changeMap[relPath] = changes[relPath];
        }
      }
    }
  }, {
    key: 'commitChanges',
    value: function commitChanges() {
      var map = changeMap;

      function ignoreLoopback(relPath) {
        delete map[relPath];
        delete cache[relPath];
        // console.log('[QuantumSync] ' + logName + ' ignore loopback for ' + relPath);
      }

      for (var relPath in map) {
        var cacheItem = cache[relPath];
        if (cacheItem) {
          if (cacheItem.type === 'file') {
            if (cacheItem.status === 'changed' && cacheItem.data) {
              var localData = fs.readFileSync(path.resolve(watchedPath, relPath));
              if (cacheItem.data.equals(localData)) {
                console.log('[QuantumSync] ' + logName + ' ignore loopback for ' + relPath);
                ignoreLoopback(relPath);
              }
            } else if (cacheItem.status === 'deleted' && map[relPath].op === 'delete') {
              ignoreLoopback(relPath);
            }
          } else if (cacheItem.type === 'folder') {
            if (cacheItem.status === 'deleted' && map[relPath].op === 'delete' || cacheItem.status === 'changed' && map[relPath].op === 'new') {
              ignoreLoopback(relPath);
            }
          }
        }
      }
      this.emptyChanges();
      return utils.toList(map);
    }
  }, {
    key: 'emptyChanges',
    value: function emptyChanges() {
      changeMap = {};
    }
  }, {
    key: 'updateCache',
    value: function updateCache(filePath, desciptor) {
      var relPath = path.relative(watchedPath, filePath);
      cache[relPath] = desciptor;

      this.removeChange(relPath);
    }
  }, {
    key: 'removeCache',
    value: function removeCache(path) {
      var relPath = path.relative(watchedPath, filePath);
      delete cache[relPath];
    }
  }, {
    key: 'emptyCache',
    value: function emptyCache() {
      cache = {};
    }
  }]);

  return ConflictResolve;
}();

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