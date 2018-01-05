const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const upath = require('upath');
const LRU = require("lru-cache");

let changeMap = new LRU({  max: 100000, maxAge: 1000 * 60 * 60 });
let cache = new LRU({  max: 1000, maxAge: 1000 * 60 * 5 });
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

  async commitChanges() {    
    function ignoreLoopback(relPath) {
      changeMap.del(relPath);
      cache.del(relPath);
      // console.log('[QuantumSync] ' + logName + ' ignore loopback for ' + relPath);
    }

    for (let relPath in changeMap.keys()) {
      const cacheItem = cache.get(relPath);
      if (cacheItem) {
        if (cacheItem.type === 'file') {
          if (cacheItem.status === 'changed' && cacheItem.data) {
            const fullPath = path.resolve(watchedPath, relPath);
            const fileExist = await utils.exitsResource(fullPath)
            const localData = await utils.readFile(fullPath);
            if (!fileExist || cacheItem.data.equals(localData)) {
              // console.log('[QuantumSync] ' + logName + ' ignore loopback for ' + relPath);
              ignoreLoopback(relPath);
            }
          } else if (cacheItem.status === 'deleted' && changeMap.get(relPath).op === 'delete') {
            ignoreLoopback(relPath);
          }
        } else if (cacheItem.type === 'folder') {
          if ((cacheItem.status === 'deleted' && changeMap.get(relPath).op === 'delete') ||
            ((cacheItem.status === 'changed' && changeMap.get(relPath).op === 'new'))) {
              ignoreLoopback(relPath);
          }
        }
      }
    }
    
    const map = {};
    changeMap.forEach((change, relPath) => {
      map[relPath] = change;
    });
    this.emptyChanges();
    return utils.toList(map);
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
