'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

var _require = require('timers'),
    setTimeout = _require.setTimeout;

module.exports = {
  mergeChanges: function mergeChanges(map, increment) {
    var merged = {},
        key = void 0;
    [map, increment].forEach(function (obj) {
      for (key in obj) {
        if (obj.hasOwnProperty(key)) {
          merged[key] = obj[key];
        }
      }
    });

    return merged;
  },
  toList: function toList(changeMap) {
    var list = [];

    for (var key in changeMap) {
      var obj = { name: key };
      for (var mapKey in changeMap[key]) {
        obj[mapKey] = changeMap[key][mapKey];
      }
      list.push(obj);
    }

    return list;
  },
  mkdirP: function mkdirP(dir) {
    var dirs = [];
    var currDir = dir;
    while (!fs.existsSync(currDir)) {
      dirs.push(currDir);
      currDir = path.dirname(currDir);
    }
    dirs = dirs.reverse();
    dirs.forEach(function (dir) {
      fs.mkdirSync(dir);
    });
    return dirs;
  },
  sleep: function sleep(durationInMs) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve();
      }, durationInMs);
    });
  },
  mergeMap: function mergeMap(map1, map2) {
    map1 = map1 || {};
    map2 = map2 || {};

    var result = {};
    var key = void 0;
    [map1, map2].forEach(function (m) {
      for (key in m) {
        if (m.hasOwnProperty(key)) {
          result[key] = m[key];
        }
      }
    });

    return result;
  },
  getDefautFolderIfNotExist: function getDefautFolderIfNotExist(folder) {
    if (folder) {
      folder = path.resolve(folder);
      if (fs.existsSync(folder)) {
        return folder;
      } else {
        return path.resolve(process.cwd());
      }
    } else {
      return path.resolve(process.cwd());
    }
  },
  getFullPathIfRelativePath: function getFullPathIfRelativePath(filePath, watchFolder) {
    if (filePath) {
      if (!fs.existsSync(filePath)) {
        filePath = path.resolve(watchFolder, filePath);
      }
    }
    return filePath;
  },
  writeFile: function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(fullPath, buffer) {
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return this.addFolderP(path.dirname(fullPath));

            case 2:
              _context.next = 4;
              return new Promise(function (resolve, reject) {
                fs.writeFile(fullPath, buffer, function (err) {
                  if (err) {
                    reject(err);
                  } else {
                    resolve();
                  }
                });
              });

            case 4:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    function writeFile(_x, _x2) {
      return _ref.apply(this, arguments);
    }

    return writeFile;
  }(),
  deleteFile: function deleteFile(fullPath) {
    return new Promise(function (resolve, reject) {
      fs.unlink(fullPath, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },
  readFile: function readFile(fullPath) {
    return new Promise(function (resolve, reject) {
      fs.readFile(fullPath, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  },
  exitsResource: function exitsResource(fullPath) {
    return new Promise(function (resolve) {
      fs.exists(fullPath, function (exists) {
        resolve(exists);
      });
    });
  },
  addFolder: function addFolder(fullPath) {
    return new Promise(function (resolve, reject) {
      fs.mkdir(fullPath, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },
  addFolderP: function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(fullPath) {
      var dirs, currDir, i;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              dirs = [];
              currDir = fullPath;

            case 2:
              _context2.next = 4;
              return this.exitsResource(currDir);

            case 4:
              if (_context2.sent) {
                _context2.next = 9;
                break;
              }

              dirs.push(currDir);
              currDir = path.dirname(currDir);
              _context2.next = 2;
              break;

            case 9:
              dirs = dirs.reverse();

              i = 0;

            case 11:
              if (!(i < dirs.length)) {
                _context2.next = 22;
                break;
              }

              _context2.prev = 12;
              _context2.next = 15;
              return this.addFolder(dirs[i]);

            case 15:
              _context2.next = 19;
              break;

            case 17:
              _context2.prev = 17;
              _context2.t0 = _context2['catch'](12);

            case 19:
              i++;
              _context2.next = 11;
              break;

            case 22:
              return _context2.abrupt('return', dirs);

            case 23:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, this, [[12, 17]]);
    }));

    function addFolderP(_x3) {
      return _ref2.apply(this, arguments);
    }

    return addFolderP;
  }(),
  deleteFolder: function deleteFolder(fullPath) {
    return new Promise(function (resolve, reject) {
      fs.rmdir(fullPath, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },
  deleteFolderP: function deleteFolderP(fullPath) {
    return new Promise(function (resolve, reject) {
      rimraf(fullPath, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },
  lstatResource: function lstatResource(fullPath) {
    return new Promise(function (resolve, reject) {
      fs.lstat(fullPath, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
};