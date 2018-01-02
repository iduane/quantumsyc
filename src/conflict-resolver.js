const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const upath = require('upath');

let changeMap = {};
let cache = {};
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
    delete changeMap[relPath];
  }

  reduceChanges(changes = {}) {
    for (let relPath in changes) {
      if (changeMap[relPath]) {
        if (changeMap[relPath].clock < changes[relPath].clock) {
          changeMap[relPath] = changes[relPath];
        }
      } else {
        changeMap[relPath] = changes[relPath];
      }
    }
  }

  commitChanges() {
    const map = changeMap;
    
    function ignoreLoopback(relPath) {
      delete map[relPath];
      delete cache[relPath];
      // console.log('[QuantumSync] ' + logName + ' ignore loopback for ' + relPath);
    }

    for (let relPath in map) {
      const cacheItem = cache[relPath];
      if (cacheItem) {
        if (cacheItem.type === 'file') {
          if (cacheItem.status === 'changed' && cacheItem.data) {
            const localData = fs.readFileSync(path.resolve(watchedPath, relPath));
            if (cacheItem.data.equals(localData)) {
              // console.log('[QuantumSync] ' + logName + ' ignore loopback for ' + relPath);
              ignoreLoopback(relPath);
            }
          } else if (cacheItem.status === 'deleted' && map[relPath].op === 'delete') {
            ignoreLoopback(relPath);
          }
        } else if (cacheItem.type === 'folder') {
          if ((cacheItem.status === 'deleted' && map[relPath].op === 'delete') ||
            ((cacheItem.status === 'changed' && map[relPath].op === 'new'))) {
              ignoreLoopback(relPath);
          }
        }
      }
    }
    this.emptyChanges();
    return utils.toList(map);
  }

  emptyChanges() {
    changeMap = {};
  }

  updateCache(filePath, desciptor) {
    const relPath = upath.normalize(path.relative(watchedPath, filePath));
    cache[relPath] = desciptor;

    this.removeChange(relPath);
  }

  removeCache(path) {
    const relPath = path.relative(watchedPath, filePath);
    delete cache[relPath];
  }

  emptyCache() {
    cache = {};
  }
}

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
