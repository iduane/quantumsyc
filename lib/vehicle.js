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
    this._diffResolver = {};
    this._lockResolver = null;
    this._unlockResolver = null;
    this._locked = false;
    this._cache = new LRU({ max: 100, maxAge: 1000 * 60 * 60 });
    setInterval(() => {
      this.checkReceiptWaintingMap();
      this.checkDiffResolverMap();
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
    this.socket.on('delete-resource', lcoalPath => {
      console.log('[QuantumSync] received delete resource request for: ' + lcoalPath);
      this.onDelete(lcoalPath);
    });
    this.socket.on('add-folder', lcoalPath => {
      console.log('[QuantumSync] received add folder request for: ' + lcoalPath);
      this.onAddDir(lcoalPath);
    });
    this.socket.on('receipt', receipt => {
      this.onReceipt(receipt);
    });
    this.socket.on('set-lock', () => {
      this.setLocalLock();
    });
    this.socket.on('remove-lock', () => {
      this.removeLocalLock();
    });
    this.socket.on('lock-result', lockable => {
      this.onLockResult(lockable);
    });
    this.socket.on('unlock-result', lockable => {
      this.onUnlockResult();
    });
    this.socket.on('text-file-diff', data => {
      this.onReceiveTextFileDiff(data);
    });
    this.socket.on('text-file-diff-reject', relPath => {
      this.onRejectTextFileDiff(relPath);
    });
    this.socket.on('text-file-diff-accept', relPath => {
      this.onAcceptTextFileDiff(relPath);
    });
  }

  dispatch(changes) {
    var _this = this;

    return _asyncToGenerator(function* () {
      _this.confictResolver.reduceChanges(changes);

      if (!_this.isBusy() || !_this.isLocked()) {
        _this.clearDelayDispatch();
        _this.setBusy(true);
        const changes = yield _this.confictResolver.commitChanges();
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
        _this.delayDispatch({});
      }
    })();
  }

  delayDispatch(changes) {
    this.clearDelayDispatch();
    this._delayerID = setTimeout(() => {
      this._delayerID = null;
      if (this.socket) {
        this.dispatch({});
      }
    }, Math.round(2000 * (1 + Math.random() / 2)));
  }

  clearDelayDispatch() {
    if (this._delayerID) {
      clearTimeout(this._delayerID);
    }
  }

  setLocalLock() {
    if (this.isBusy()) {
      if (this.socket) this.socket.emit('lock-result', false);
    } else {
      this.setLock(true);
      if (this.socket) this.socket.emit('lock-result', true);
    }
  }

  removeLocalLock() {
    this.setLock(true);
    if (this.socket) this.socket.emit('unlock-result');
  }

  isLocked() {
    return this._locked;
  }

  setLock(flag) {
    this._locked = flag;
  }

  setTargetLock() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      _this2._waitingLock = true;
      if (_this2.socket) _this2.socket.emit('set-lock');
      const state = yield new Promise(function (resolve) {
        _this2._lockResolver = resolve;
      });

      return state;
    })();
  }

  removeTargetLock() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      if (_this3.socket) _this3.socket.emit('remove-lock');
      yield new Promise(function (resolve) {
        _this3._unlockResolver = resolve;
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
      yield Promise.all(changes.map(function (descriptor) {
        return new Promise(function (resolve, reject) {
          try {
            const fullPath = descriptor.fullPath || path.resolve(_this4.folder, descriptor.name);
            const relPath = upath.normalize(descriptor.name);
            if (descriptor.op === 'delete') {
              console.log('[QuantumSync] ' + _this4.name + ' send remove file request for: ' + descriptor.name);
              socket.emit('delete-resource', relPath);
              resolve();
            } else {
              if (!fs.existsSync(fullPath)) {
                console.log('[QuantumSync] the sync file ' + fullPath + ' is not exit');
                resolve();
              } else {
                const fileStat = fs.lstatSync(fullPath);
                if (fileStat.isFile()) {
                  _this4.sendFile(resolve, relPath, fullPath);
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
          } catch (e) {
            resolve();
            console.log('[QuantumSync] encounter error when sync file ' + fullPath + ', ' + e);
          }
        });
      }));
    })();
  }

  sendFile(resolve, relPath, fullPath) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      try {
        const fileExist = yield utils.exitsResource(fullPath);
        if (!fileExist) {
          resolve();
          return;
        }
        const fileData = yield utils.readFile(fullPath);
        const fileState = yield utils.lstatResource(fullPath);
        const useDiff = fileState.size > 10240 && !isBinaryFile.sync(fileData, fileState.size);

        let isTextDiffAccepted = false;
        if (useDiff) {
          isTextDiffAccepted = yield _this5.sendTextFileDiff(relPath, fullPath, fileData);
        }
        if (!isTextDiffAccepted) {
          console.log('[QuantumSync] ' + _this5.name + ' send sync file request for: ' + relPath);
          _this5.stub.send({ name: relPath, path: fullPath });
          _this5.stub.on('send.success', function () {
            _this5.waitReceipt(relPath, resolve);
          });
        } else {
          resolve();
        }
      } catch (e) {
        console.log('[QuantumSync] encounter error when sync file ' + fullPath + ', ' + e);
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
        if (_this6.socket) _this6.socket.emit('text-file-diff', { relPath, diff, digest });
        const isAccepted = yield new Promise(function (resolve) {
          if (_this6._diffResolver[relPath]) {
            _this6._diffResolver[relPath].resolve();
          }
          _this6._diffResolver[relPath] = { resolve, time: +new Date() };
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
      let accept = false;

      if (typeof patched === 'string') {
        const patchedData = Buffer.from(patched);
        md5.update(patchedData);
        const localDigest = md5.digest('hex');
        if (localDigest === digest) {
          console.log('[QuantumSync] ' + _this7.name + ' accept file changes for: ' + relPath);
          yield _this7.writeFile(fullPath, patchedData);
          accept = true;
          if (_this7.socket) _this7.socket.emit('text-file-diff-accept', relPath);
        }
      }

      if (!accept) {
        console.log('[QuantumSync] ' + _this7.name + ' reject file changes for: ' + relPath);
        if (_this7.socket) _this7.socket.emit('text-file-diff-reject', relPath);
      }
    })();
  }

  onRejectTextFileDiff(relPath) {
    if (this._diffResolver[relPath]) {
      this._diffResolver[relPath].resolve(false);

      this._diffResolver[relPath] = null;
    }
  }

  onAcceptTextFileDiff(relPath) {
    if (this._diffResolver[relPath]) {
      this._diffResolver[relPath].resolve(true);

      this._diffResolver[relPath] = null;
    }
  }

  sendReceipt(file) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      const name = file.name;

      if (_this8.socket) _this8.socket.emit('receipt', { name: upath.normalize(name) });
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
    if (this._receiptWaitingMap[relPath]) {
      this._receiptWaitingMap[relPath].resolve();
    }
    this._receiptWaitingMap[relPath] = { resolve, time: +new Date() };
  }

  checkReceiptWaintingMap() {
    this.checkResolverMap(this._receiptWaitingMap);
  }

  checkDiffResolverMap() {
    this.checkResolverMap(this._diffResolver);
  }

  checkResolverMap(map) {
    const currTime = +new Date();
    for (let relPath in map) {
      if (map[relPath] && currTime - map[relPath] > 1000 * 10) {
        map[relPath].resolve();
        delete map[relPath];
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
        if (file.buffer && !existData.equals(file.buffer)) {
          yield _this10.writeFile(writePath, file.buffer);
        }
      } else {
        yield _this10.writeFile(writePath, file.buffer);
      }

      _this10.lastestChangeTime = new Date().getTime();
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

      _this11.lastestChangeTime = new Date().getTime();
    })();
  }

  onAddDir(localPath) {
    var _this12 = this;

    return _asyncToGenerator(function* () {
      const dirPath = path.resolve(_this12.folder, localPath);
      if (!(yield utils.exitsResource(dirPath))) {
        yield _this12.addFolder(dirPath);
      }

      _this12.lastestChangeTime = new Date().getTime();
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