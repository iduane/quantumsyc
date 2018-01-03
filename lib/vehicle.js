'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var _require = require('timers');

const clearTimeout = _require.clearTimeout,
      setTimeout = _require.setTimeout;

const crypto = require('crypto');
const io = require('socket.io');
const dl = require('delivery');

var _require2 = require('buffer');

const Buffer = _require2.Buffer;

const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const upath = require('upath');
const jsDiff = require('diff');
const isBinaryFile = require('isbinaryfile');
const LRU = require("lru-cache");
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
    this._cache = new LRU({ max: 100, maxAge: 1000 * 60 * 60 });
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
    this.socket.on('text-file-diff', data => {
      self.onReceiveTextFileDiff(data);
    });
    this.socket.on('text-file-diff-reject', () => {
      self.onRejectTextFileDiff();
    });
    this.socket.on('text-file-diff-accept', () => {
      self.onAcceptTextFileDiff();
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
                self.sendFile(resolve, relPath, fullPath);
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

  sendFile(resolve, relPath, fullPath) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      const fileData = yield utils.readFile(fullPath);
      const fileState = yield utils.lstatResource(fullPath);
      const useDiff = fileState.size > 10240 && !isBinaryFile.sync(fileData, fileState.size);

      let isTextDiffAccepted = false;
      if (useDiff) {
        isTextDiffAccepted = yield _this5.sendTextFileDiff(relPath, fullPath, fileData);
      }
      if (!isTextDiffAccepted) {
        console.log('[QuantumSync] ' + _this5.name + ' send sync file request for: ' + relPath);
        const self = _this5;
        _this5.stub.send({ name: relPath, path: fullPath });
        _this5.stub.on('send.success', function () {
          self.waitReceipt(relPath, resolve);
        });
      } else {
        resolve();
      }
    })();
  }

  sendTextFileDiff(relPath, fullPath, fileData) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      console.log('[QuantumSync] ' + _this6.name + ' send file changes for: ' + relPath);

      const cache = _this6._cache.get(relPath);
      // const fileData = await utils.readFile(fullPath);
      const text = fileData.toString();
      const md5 = crypto.createHash('md5');
      md5.update(fileData);
      const digest = md5.digest('hex');
      _this6._cache.set(relPath, { text, digest });

      if (cache) {
        const diff = jsDiff.createPatch(relPath, cache.text + "\n", text + "\n");
        _this6.socket.emit('text-file-diff', { relPath, diff, digest });
        const isAccepted = yield new Promise(function (resolve) {
          return _this6._diffResolver = resolve;
        });

        return isAccepted;
      } else {
        return false;
      }
    })();
  }

  onReceiveTextFileDiff({ relPath, diff, digest }) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      const fullPath = path.resolve(_this7.folder, relPath);
      const fileData = yield utils.readFile(fullPath);
      const text = fileData.toString();
      const md5 = crypto.createHash('md5');
      _this7._cache.set(relPath, { text, digest });

      const patched = jsDiff.applyPatch(text, diff);
      const patchedData = Buffer.from(patched);

      md5.update(patchedData);
      const localDigest = md5.digest('hex');
      if (localDigest === digest) {
        _this7.socket.emit('text-file-diff-accept');
        console.log('[QuantumSync] ' + _this7.name + ' accept file changes for: ' + relPath);
        yield _this7.writeFile(fullPath, patchedData);
      } else {
        console.log('[QuantumSync] ' + _this7.name + ' reject file changes for: ' + relPath);
        _this7.socket.emit('text-file-diff-reject');
      }
    })();
  }

  onRejectTextFileDiff() {
    if (this._diffResolver) {
      this._diffResolver(false);
    }
  }

  onAcceptTextFileDiff() {
    if (this._diffResolver) {
      this._diffResolver(true);
    }
  }

  sendReceipt(file) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      const name = file.name;

      _this8.socket.emit('receipt', { name: upath.normalize(name) });
    })();
  }

  onReceipt({ name }) {
    var _this9 = this;

    return _asyncToGenerator(function* () {
      const relPath = name;
      if (_this9._receiptWaitingMap[relPath]) {
        _this9._receiptWaitingMap[relPath].resolve();
        delete _this9._receiptWaitingMap[relPath];
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
    var _this10 = this;

    return _asyncToGenerator(function* () {
      const name = file.name;

      const writePath = path.resolve(_this10.folder, name);

      if (yield utils.exitsResource(writePath)) {
        const existData = yield utils.readFile(writePath);
        if (!existData.equals(file.buffer)) {
          yield _this10.writeFile(writePath, file.buffer);
        }
      } else {
        yield _this10.writeFile(writePath, file.buffer);
      }
    })();
  }

  onDelete(localPath) {
    var _this11 = this;

    return _asyncToGenerator(function* () {
      const deletePath = path.resolve(_this11.folder, localPath);
      if (yield utils.exitsResource(deletePath)) {
        const fileStat = yield utils.lstatResource(deletePath);
        if (fileStat.isFile()) {
          yield _this11.deleteFile(deletePath);
        } else if (fileStat.isDirectory()) {
          yield _this11.deleteFolder(deletePath);
        }
      }
    })();
  }

  onAddDir(localPath) {
    var _this12 = this;

    return _asyncToGenerator(function* () {
      const dirPath = path.resolve(_this12.folder, localPath);
      if (!(yield utils.exitsResource(dirPath))) {
        yield _this12.addFolder(dirPath);
      }
    })();
  }

  writeFile(path, buffer) {
    var _this13 = this;

    return _asyncToGenerator(function* () {
      console.log('[QuantumSync] ' + _this13.name + ' write file to ' + path);

      try {
        yield utils.writeFile(path, buffer);
      } catch (e) {
        console.log('[QuantumSync] write file to ' + path + ' fail, ' + e);
      }
      _this13.confictResolver.updateCache(path, {
        status: 'changed',
        data: buffer,
        type: 'file'
      });
    })();
  }

  deleteFile(path) {
    var _this14 = this;

    return _asyncToGenerator(function* () {
      console.log('[QuantumSync] ' + _this14.name + ' delete file ' + path);

      yield utils.deleteFile(path);
      _this14.confictResolver.updateCache(path, {
        status: 'deleted',
        type: 'file'
      });
    })();
  }

  addFolder(path) {
    var _this15 = this;

    return _asyncToGenerator(function* () {
      yield utils.addFolderP(path);
      _this15.confictResolver.updateCache(path, {
        status: 'changed',
        type: 'folder'
      });
    })();
  }

  deleteFolder(path) {
    var _this16 = this;

    return _asyncToGenerator(function* () {
      yield utils.deleteFolderP(path);
      _this16.confictResolver.updateCache(path, {
        status: 'deleted',
        type: 'folder'
      });
    })();
  }

  terminate() {}
};