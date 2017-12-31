'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require('timers'),
    clearTimeout = _require.clearTimeout,
    setTimeout = _require.setTimeout;

var io = require('socket.io');
var dl = require('delivery');
var utils = require('./utils');
var fs = require('fs');
var path = require('path');
var ConflictResolver = require('./conflict-resolver');

module.exports = function () {
  function Vehicle(_ref) {
    var _this = this;

    var name = _ref.name,
        port = _ref.port,
        folder = _ref.folder,
        host = _ref.host,
        password = _ref.password;

    _classCallCheck(this, Vehicle);

    this.port = port;
    this.folder = folder;
    this.host = host;
    this.password = password;
    this.name = name;
    this.confictResolver = new ConflictResolver(folder, this.name);
    this._busying = false;
    this._receiptWaitingMap = {};
    this._lockResolver = null;
    this._unlockResolver = null;
    this._locked = false;

    setInterval(function () {
      _this.checkReceiptWaintingMap();
    }, 10000);
  }

  _createClass(Vehicle, [{
    key: 'start',
    value: function start() {}
  }, {
    key: 'setBusy',
    value: function setBusy(isBusy) {
      this._busying = isBusy;
    }
  }, {
    key: 'isBusy',
    value: function isBusy() {
      return this._busying;
    }
  }, {
    key: 'hook',
    value: function hook() {
      var self = this;
      this.socket.on('delete-resource', function (lcoalPath) {
        console.log('[QuantumSync] received delete resource request for: ' + lcoalPath);
        self.onDelete(lcoalPath);
      });
      this.socket.on('add-folder', function (lcoalPath) {
        console.log('[QuantumSync] received add folder request for: ' + lcoalPath);
        self.onAddDir(lcoalPath);
      });
      this.socket.on('receipt', function (receipt) {
        self.onReceipt(receipt);
      });
      this.socket.on('set-lock', function () {
        self.setLocalLock();
      });
      this.socket.on('remove-lock', function () {
        self.removeLocalLock();
      });
      this.socket.on('lock-result', function (lockable) {
        self.onLockResult(lockable);
      });
      this.socket.on('unlock-result', function (lockable) {
        self.onUnlockResult();
      });
    }
  }, {
    key: 'dispatch',
    value: function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(changes) {
        var _changes, locked;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                this.confictResolver.reduceChanges(changes);

                if (this.isBusy()) {
                  _context.next = 33;
                  break;
                }

                this.setBusy(true);
                _changes = this.confictResolver.commitChanges();

                this.confictResolver.emptyChanges();

                if (!(_changes.length > 0)) {
                  _context.next = 30;
                  break;
                }

                _context.next = 8;
                return this.setTargetLock();

              case 8:
                locked = _context.sent;

                if (!locked) {
                  _context.next = 25;
                  break;
                }

                _context.prev = 10;
                _context.next = 13;
                return this.sendChanges(this.socket, this.stub, _changes, this.folder);

              case 13:
                _context.next = 18;
                break;

              case 15:
                _context.prev = 15;
                _context.t0 = _context['catch'](10);

                console.error("[QuantumSync] got exception when sync changes, " + _context.t0);

              case 18:
                _context.prev = 18;

                this.setBusy(false);
                return _context.finish(18);

              case 21:
                _context.next = 23;
                return this.removeTargetLock();

              case 23:
                _context.next = 28;
                break;

              case 25:
                console.log('[QuantumSync] ' + this.name + ': target is busy, retry sync later');
                this.delayDispatch(_changes);
                this.setBusy(false);

              case 28:
                _context.next = 31;
                break;

              case 30:
                this.setBusy(false);

              case 31:
                _context.next = 34;
                break;

              case 33:
                this.delayDispatch(changes);

              case 34:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[10, 15, 18, 21]]);
      }));

      function dispatch(_x) {
        return _ref2.apply(this, arguments);
      }

      return dispatch;
    }()
  }, {
    key: 'delayDispatch',
    value: function delayDispatch(changes) {
      var self = this;
      if (this._delayerID) {
        clearTimeout(this._delayerID);
      }
      this._delayerID = setTimeout(function () {
        self._delayerID = null;
        self.dispatch({});
      }, Math.round(1000 * (1 + Math.random() / 2)));
    }
  }, {
    key: 'setLocalLock',
    value: function setLocalLock() {
      if (this.isBusy()) {
        this.socket.emit('lock-result', false);
      } else {
        this._locked = true;
        this.socket.emit('lock-result', true);
      }
    }
  }, {
    key: 'removeLocalLock',
    value: function removeLocalLock() {
      this._locked = false;
      this.socket.emit('unlock-result');
    }
  }, {
    key: 'setTargetLock',
    value: function () {
      var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var self, state;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                this._waitingLock = true;
                this.socket.emit('set-lock');
                self = this;
                _context2.next = 5;
                return new Promise(function (resolve) {
                  self._lockResolver = resolve;
                });

              case 5:
                state = _context2.sent;
                return _context2.abrupt('return', state);

              case 7:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function setTargetLock() {
        return _ref3.apply(this, arguments);
      }

      return setTargetLock;
    }()
  }, {
    key: 'removeTargetLock',
    value: function () {
      var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var self;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                this.socket.emit('remove-lock');
                self = this;
                _context3.next = 4;
                return new Promise(function (resolve) {
                  self._unlockResolver = resolve;
                });

              case 4:
                return _context3.abrupt('return', true);

              case 5:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function removeTargetLock() {
        return _ref4.apply(this, arguments);
      }

      return removeTargetLock;
    }()
  }, {
    key: 'onLockResult',
    value: function onLockResult(lockable) {
      this._waitingLock = false;
      if (this._lockResolver) {
        this._lockResolver(lockable);
        this._lockResolver = null;
      }
    }
  }, {
    key: 'onUnlockResult',
    value: function onUnlockResult() {
      if (this._unlockResolver) {
        this._unlockResolver();
        this._unlockResolver = null;
      }
    }
  }, {
    key: 'sendChanges',
    value: function () {
      var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(socket, stub, changes) {
        var _this2 = this;

        var logName, self;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (stub) {
                  _context4.next = 3;
                  break;
                }

                console.log('[QuantumSync] received changes, but no clients connected yet');
                return _context4.abrupt('return', Promise.reject());

              case 3:
                logName = this.name;
                self = this;
                _context4.next = 7;
                return Promise.all(changes.map(function (descriptor) {
                  return new Promise(function (resolve, reject) {
                    var fullPath = descriptor.fullPath || path.resolve(_this2.folder, descriptor.name);
                    if (descriptor.op === 'delete') {
                      console.log('[QuantumSync] send remove file request for: ' + descriptor.name);
                      socket.emit('delete-resource', descriptor.name);
                      resolve();
                    } else {
                      if (!fs.existsSync(fullPath)) {
                        console.log('[QuantumSync] the sync file ' + fullPath + ' is not exit');
                        resolve();
                      } else {
                        var fileStat = fs.lstatSync(fullPath);
                        if (fileStat.isFile()) {
                          console.log('[QuantumSync] ' + logName + ' send sync file request for: ' + descriptor.name);
                          stub.send({ name: descriptor.name, path: fullPath });
                          stub.on('send.success', function () {
                            self.waitReceipt(descriptor.name, resolve);
                          });
                        } else if (fileStat.isDirectory()) {
                          console.log('[QuantumSync] send sync folder request for: ' + descriptor.name);
                          socket.emit('add-folder', descriptor.name);
                          resolve();
                        } else {
                          console.log('[QuantumSync] the sync file type of ' + fullPath + ' is not supported');
                          resolve();
                        }
                      }
                    }
                  });
                }));

              case 7:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function sendChanges(_x2, _x3, _x4) {
        return _ref5.apply(this, arguments);
      }

      return sendChanges;
    }()
  }, {
    key: 'sendReceipt',
    value: function () {
      var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(file) {
        var name;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                name = file.name;

                this.socket.emit('receipt', { name: name });

              case 2:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function sendReceipt(_x5) {
        return _ref6.apply(this, arguments);
      }

      return sendReceipt;
    }()
  }, {
    key: 'onReceipt',
    value: function () {
      var _ref8 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(_ref7) {
        var name = _ref7.name;
        var relPath;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                relPath = name;

                if (this._receiptWaitingMap[relPath]) {
                  this._receiptWaitingMap[relPath].resolve();
                  delete this._receiptWaitingMap[relPath];
                }

              case 2:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function onReceipt(_x6) {
        return _ref8.apply(this, arguments);
      }

      return onReceipt;
    }()
  }, {
    key: 'waitReceipt',
    value: function waitReceipt(relPath, resolve) {
      this._receiptWaitingMap[relPath] = { resolve: resolve, time: +new Date() };
    }
  }, {
    key: 'checkReceiptWaintingMap',
    value: function checkReceiptWaintingMap() {
      var currTime = +new Date();
      for (var relPath in this._receiptWaitingMap) {
        if (currTime - this._receiptWaitingMap[relPath] > 1000 * 10) {
          this._receiptWaitingMap[relPath].resolve();
          delete this._receiptWaitingMap[relPath];
        }
      }
    }
  }, {
    key: 'onData',
    value: function () {
      var _ref9 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(file) {
        var name, writePath, exitData;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                name = file.name;
                writePath = path.resolve(this.folder, name);
                _context7.next = 4;
                return utils.exitsResource(writePath);

              case 4:
                if (!_context7.sent) {
                  _context7.next = 13;
                  break;
                }

                _context7.next = 7;
                return utils.readFile(writePath);

              case 7:
                exitData = _context7.sent;

                if (exitData.equals(file.buffer)) {
                  _context7.next = 11;
                  break;
                }

                _context7.next = 11;
                return this.writeFile(writePath, file.buffer);

              case 11:
                _context7.next = 15;
                break;

              case 13:
                _context7.next = 15;
                return this.writeFile(writePath, file.buffer);

              case 15:
              case 'end':
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function onData(_x7) {
        return _ref9.apply(this, arguments);
      }

      return onData;
    }()
  }, {
    key: 'onDelete',
    value: function () {
      var _ref10 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8(localPath) {
        var deletePath, fileStat;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                deletePath = path.resolve(this.folder, localPath);
                _context8.next = 3;
                return utils.exitsResource(deletePath);

              case 3:
                if (!_context8.sent) {
                  _context8.next = 15;
                  break;
                }

                _context8.next = 6;
                return utils.lstatResource(deletePath);

              case 6:
                fileStat = _context8.sent;

                if (!fileStat.isFile()) {
                  _context8.next = 12;
                  break;
                }

                _context8.next = 10;
                return this.deleteFile(deletePath);

              case 10:
                _context8.next = 15;
                break;

              case 12:
                if (!fileStat.isDirectory()) {
                  _context8.next = 15;
                  break;
                }

                _context8.next = 15;
                return this.deleteFolder(deletePath);

              case 15:
              case 'end':
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function onDelete(_x8) {
        return _ref10.apply(this, arguments);
      }

      return onDelete;
    }()
  }, {
    key: 'onAddDir',
    value: function () {
      var _ref11 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9(localPath) {
        var dirPath;
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                dirPath = path.resolve(this.folder, localPath);
                _context9.next = 3;
                return utils.exitsResource(dirPath);

              case 3:
                if (_context9.sent) {
                  _context9.next = 6;
                  break;
                }

                _context9.next = 6;
                return this.addFolder(dirPath);

              case 6:
              case 'end':
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function onAddDir(_x9) {
        return _ref11.apply(this, arguments);
      }

      return onAddDir;
    }()
  }, {
    key: 'writeFile',
    value: function () {
      var _ref12 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10(path, buffer) {
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                console.log('[QuantumSync] ' + this.name + ' write file to ' + path);

                _context10.prev = 1;
                _context10.next = 4;
                return utils.writeFile(path, buffer);

              case 4:
                _context10.next = 9;
                break;

              case 6:
                _context10.prev = 6;
                _context10.t0 = _context10['catch'](1);

                console.log('[QuantumSync] write file to ' + path + ' fail, ' + _context10.t0);

              case 9:
                this.confictResolver.updateCache(path, {
                  status: 'changed',
                  data: buffer,
                  type: 'file'
                });

              case 10:
              case 'end':
                return _context10.stop();
            }
          }
        }, _callee10, this, [[1, 6]]);
      }));

      function writeFile(_x10, _x11) {
        return _ref12.apply(this, arguments);
      }

      return writeFile;
    }()
  }, {
    key: 'deleteFile',
    value: function () {
      var _ref13 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee11(path) {
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                console.log('[QuantumSync] ' + this.name + ' delete file ' + path);

                _context11.next = 3;
                return utils.deleteFile(path);

              case 3:
                this.confictResolver.updateCache(path, {
                  status: 'deleted',
                  type: 'file'
                });

              case 4:
              case 'end':
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function deleteFile(_x12) {
        return _ref13.apply(this, arguments);
      }

      return deleteFile;
    }()
  }, {
    key: 'addFolder',
    value: function () {
      var _ref14 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee12(path) {
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                _context12.next = 2;
                return utils.addFolderP(path);

              case 2:
                this.confictResolver.updateCache(path, {
                  status: 'changed',
                  type: 'folder'
                });

              case 3:
              case 'end':
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function addFolder(_x13) {
        return _ref14.apply(this, arguments);
      }

      return addFolder;
    }()
  }, {
    key: 'deleteFolder',
    value: function () {
      var _ref15 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee13(path) {
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                _context13.next = 2;
                return utils.deleteFolderP(path);

              case 2:
                this.confictResolver.updateCache(path, {
                  status: 'deleted',
                  type: 'folder'
                });

              case 3:
              case 'end':
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function deleteFolder(_x14) {
        return _ref15.apply(this, arguments);
      }

      return deleteFolder;
    }()
  }, {
    key: 'terminate',
    value: function terminate() {}
  }]);

  return Vehicle;
}();