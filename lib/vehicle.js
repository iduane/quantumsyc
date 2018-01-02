'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var _require = require('timers');

const clearTimeout = _require.clearTimeout,
      setTimeout = _require.setTimeout;

const io = require('socket.io');
const dl = require('delivery');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const upath = require('upath');
const ConflictResolver = require('./conflict-resolver');

module.exports = class Vehicle {
  constructor({ name, port, folder, host, password }) {
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

    setInterval(() => {
      this.checkReceiptWaintingMap();
    }, 10000);
  }

  start() {}

  setBusy(isBusy) {
    this._busying = isBusy;
  }

  isBusy() {
    return this._busying;
  }

  hook() {
    const self = this;
    this.socket.on('delete-resource', lcoalPath => {
      console.log('[QuantumSync] received delete resource request for: ' + lcoalPath);
      self.onDelete(lcoalPath);
    });
    this.socket.on('add-folder', lcoalPath => {
      console.log('[QuantumSync] received add folder request for: ' + lcoalPath);
      self.onAddDir(lcoalPath);
    });
    this.socket.on('receipt', receipt => {
      self.onReceipt(receipt);
    });
    this.socket.on('set-lock', () => {
      self.setLocalLock();
    });
    this.socket.on('remove-lock', () => {
      self.removeLocalLock();
    });
    this.socket.on('lock-result', lockable => {
      self.onLockResult(lockable);
    });
    this.socket.on('unlock-result', lockable => {
      self.onUnlockResult();
    });
  }

  dispatch(changes) {
    var _this = this;

    return _asyncToGenerator(function* () {
      _this.confictResolver.reduceChanges(changes);

      if (!_this.isBusy()) {
        _this.setBusy(true);
        const changes = _this.confictResolver.commitChanges();
        _this.confictResolver.emptyChanges();
        if (changes.length > 0) {
          const locked = yield _this.setTargetLock();
          if (locked) {
            try {
              yield _this.sendChanges(_this.socket, _this.stub, changes, _this.folder);
            } catch (e) {
              console.error("[QuantumSync] got exception when sync changes, " + e);
            } finally {
              _this.setBusy(false);
            }
            yield _this.removeTargetLock();
          } else {
            console.log('[QuantumSync] ' + _this.name + ': target is busy, retry sync later');
            _this.delayDispatch(changes);
            _this.setBusy(false);
          }
        } else {
          _this.setBusy(false);
        }
      } else {
        _this.delayDispatch(changes);
      }
    })();
  }

  delayDispatch(changes) {
    const self = this;
    if (this._delayerID) {
      clearTimeout(this._delayerID);
    }
    this._delayerID = setTimeout(() => {
      self._delayerID = null;
      self.dispatch({});
    }, Math.round(1000 * (1 + Math.random() / 2)));
  }

  setLocalLock() {
    if (this.isBusy()) {
      this.socket.emit('lock-result', false);
    } else {
      this._locked = true;
      this.socket.emit('lock-result', true);
    }
  }

  removeLocalLock() {
    this._locked = false;
    this.socket.emit('unlock-result');
  }

  setTargetLock() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      _this2._waitingLock = true;
      _this2.socket.emit('set-lock');
      const self = _this2;
      const state = yield new Promise(function (resolve) {
        self._lockResolver = resolve;
      });

      return state;
    })();
  }

  removeTargetLock() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      _this3.socket.emit('remove-lock');
      const self = _this3;
      yield new Promise(function (resolve) {
        self._unlockResolver = resolve;
      });
      return true;
    })();
  }

  onLockResult(lockable) {
    this._waitingLock = false;
    if (this._lockResolver) {
      this._lockResolver(lockable);
      this._lockResolver = null;
    }
  }

  onUnlockResult() {
    if (this._unlockResolver) {
      this._unlockResolver();
      this._unlockResolver = null;
    }
  }

  sendChanges(socket, stub, changes) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      if (!stub) {
        console.log('[QuantumSync] received changes, but no clients connected yet');
        return Promise.reject();
      }
      const logName = _this4.name;
      const self = _this4;
      yield Promise.all(changes.map(function (descriptor) {
        return new Promise(function (resolve, reject) {
          const fullPath = descriptor.fullPath || path.resolve(_this4.folder, descriptor.name);
          const relPath = upath.normalize(descriptor.name);
          if (descriptor.op === 'delete') {
            console.log('[QuantumSync] send remove file request for: ' + descriptor.name);
            socket.emit('delete-resource', relPath);
            resolve();
          } else {
            if (!fs.existsSync(fullPath)) {
              console.log('[QuantumSync] the sync file ' + fullPath + ' is not exit');
              resolve();
            } else {
              const fileStat = fs.lstatSync(fullPath);
              if (fileStat.isFile()) {
                console.log('[QuantumSync] ' + logName + ' send sync file request for: ' + descriptor.name);

                stub.send({ name: relPath, path: fullPath });
                stub.on('send.success', function () {
                  self.waitReceipt(relPath, resolve);
                });
              } else if (fileStat.isDirectory()) {
                console.log('[QuantumSync] send sync folder request for: ' + descriptor.name);
                socket.emit('add-folder', relPath);
                resolve();
              } else {
                console.log('[QuantumSync] the sync file type of ' + fullPath + ' is not supported');
                resolve();
              }
            }
          }
        });
      }));
    })();
  }

  sendReceipt(file) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      const name = file.name;

      _this5.socket.emit('receipt', { name: upath.normalize(name) });
    })();
  }

  onReceipt({ name }) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      const relPath = name;
      if (_this6._receiptWaitingMap[relPath]) {
        _this6._receiptWaitingMap[relPath].resolve();
        delete _this6._receiptWaitingMap[relPath];
      }
    })();
  }

  waitReceipt(relPath, resolve) {
    this._receiptWaitingMap[relPath] = { resolve, time: +new Date() };
  }

  checkReceiptWaintingMap() {
    const currTime = +new Date();
    for (let relPath in this._receiptWaitingMap) {
      if (currTime - this._receiptWaitingMap[relPath] > 1000 * 10) {
        this._receiptWaitingMap[relPath].resolve();
        delete this._receiptWaitingMap[relPath];
      }
    }
  }

  onData(file) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      const name = file.name;

      const writePath = path.resolve(_this7.folder, name);

      if (yield utils.exitsResource(writePath)) {
        const exitData = yield utils.readFile(writePath);
        if (!exitData.equals(file.buffer)) {
          yield _this7.writeFile(writePath, file.buffer);
        }
      } else {
        yield _this7.writeFile(writePath, file.buffer);
      }
    })();
  }

  onDelete(localPath) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      const deletePath = path.resolve(_this8.folder, localPath);
      if (yield utils.exitsResource(deletePath)) {
        const fileStat = yield utils.lstatResource(deletePath);
        if (fileStat.isFile()) {
          yield _this8.deleteFile(deletePath);
        } else if (fileStat.isDirectory()) {
          yield _this8.deleteFolder(deletePath);
        }
      }
    })();
  }

  onAddDir(localPath) {
    var _this9 = this;

    return _asyncToGenerator(function* () {
      const dirPath = path.resolve(_this9.folder, localPath);
      if (!(yield utils.exitsResource(dirPath))) {
        yield _this9.addFolder(dirPath);
      }
    })();
  }

  writeFile(path, buffer) {
    var _this10 = this;

    return _asyncToGenerator(function* () {
      console.log('[QuantumSync] ' + _this10.name + ' write file to ' + path);

      try {
        yield utils.writeFile(path, buffer);
      } catch (e) {
        console.log('[QuantumSync] write file to ' + path + ' fail, ' + e);
      }
      _this10.confictResolver.updateCache(path, {
        status: 'changed',
        data: buffer,
        type: 'file'
      });
    })();
  }

  deleteFile(path) {
    var _this11 = this;

    return _asyncToGenerator(function* () {
      console.log('[QuantumSync] ' + _this11.name + ' delete file ' + path);

      yield utils.deleteFile(path);
      _this11.confictResolver.updateCache(path, {
        status: 'deleted',
        type: 'file'
      });
    })();
  }

  addFolder(path) {
    var _this12 = this;

    return _asyncToGenerator(function* () {
      yield utils.addFolderP(path);
      _this12.confictResolver.updateCache(path, {
        status: 'changed',
        type: 'folder'
      });
    })();
  }

  deleteFolder(path) {
    var _this13 = this;

    return _asyncToGenerator(function* () {
      yield utils.deleteFolderP(path);
      _this13.confictResolver.updateCache(path, {
        status: 'deleted',
        type: 'folder'
      });
    })();
  }

  terminate() {}
};