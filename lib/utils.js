'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

var _require = require('timers');

const setTimeout = _require.setTimeout;


module.exports = {
  mergeChanges(map, increment) {
    let merged = {},
        key;
    [map, increment].forEach(obj => {
      for (key in obj) {
        if (obj.hasOwnProperty(key)) {
          merged[key] = obj[key];
        }
      }
    });

    return merged;
  },

  toList(changeMap) {
    let list = [];

    for (let key in changeMap) {
      let obj = { name: key };
      for (let mapKey in changeMap[key]) {
        obj[mapKey] = changeMap[key][mapKey];
      }
      list.push(obj);
    }

    return list;
  },

  mkdirP(dir) {
    let dirs = [];
    let currDir = dir;
    while (!fs.existsSync(currDir)) {
      dirs.push(currDir);
      currDir = path.dirname(currDir);
    }
    dirs = dirs.reverse();
    dirs.forEach(dir => {
      fs.mkdirSync(dir);
    });
    return dirs;
  },

  sleep(durationInMs) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, durationInMs);
    });
  },

  mergeMap(map1, map2) {
    map1 = map1 || {};
    map2 = map2 || {};

    const result = {};
    let key;
    [map1, map2].forEach(m => {
      for (key in m) {
        if (m.hasOwnProperty(key)) {
          result[key] = m[key];
        }
      }
    });

    return result;
  },

  getDefautFolderIfNotExist(folder) {
    if (folder) {
      folder = path.resolve(folder);
      if (fs.existsSync(folder)) {
        return folder;
      } else {
        throw new Error('not exits');
      }
    } else {
      return path.resolve(process.cwd());
    }
  },

  getFullPathIfRelativePath(filePath, watchFolder) {
    if (filePath) {
      if (!fs.existsSync(filePath)) {
        filePath = path.resolve(watchFolder, filePath);
      }
    }
    return filePath;
  },

  writeFile(fullPath, buffer) {
    var _this = this;

    return _asyncToGenerator(function* () {
      yield _this.addFolderP(path.dirname(fullPath));
      yield new Promise(function (resolve, reject) {
        fs.writeFile(fullPath, buffer, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    })();
  },

  deleteFile(fullPath) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      const exist = yield _this2.exitsResource(fullPath);
      if (exist) {
        yield new Promise(function (resolve, reject) {
          fs.unlink(fullPath, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }

      return exist;
    })();
  },

  readFile(fullPath) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const exist = yield _this3.exitsResource(fullPath);
      if (exist) {
        const content = new Promise(function (resolve, reject) {
          fs.readFile(fullPath, function (err, data) {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });
        return content;
      } else {
        return '';
      }
    })();
  },

  exitsResource(fullPath) {
    return new Promise(resolve => {
      fs.exists(fullPath, exists => {
        resolve(exists);
      });
    });
  },

  addFolder(fullPath) {
    return new Promise((resolve, reject) => {
      fs.mkdir(fullPath, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  addFolderP(fullPath) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      let dirs = [];
      let currDir = fullPath;
      while (!(yield _this4.exitsResource(currDir))) {
        dirs.push(currDir);
        currDir = path.dirname(currDir);
      }
      dirs = dirs.reverse();

      for (let i = 0; i < dirs.length; i++) {
        try {
          yield _this4.addFolder(dirs[i]);
        } catch (e) {
          // the folder may be created by other request
        }
      }

      return dirs;
    })();
  },

  deleteFolder(fullPath) {
    return new Promise((resolve, reject) => {
      fs.rmdir(fullPath, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  deleteFolderP(fullPath) {
    return new Promise((resolve, reject) => {
      rimraf(fullPath, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  lstatResource(fullPath) {
    return new Promise((resolve, reject) => {
      fs.lstat(fullPath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
};