'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const io = require('socket.io-client');
const dl = require('delivery');
const crypto = require('crypto');
const utils = require('./utils');
const path = require('path');
const fs = require('graceful-fs');
const Vehicle = require('./vehicle');
const handshakeSync = require('./handshake-sync');
const checksum = require('./checksum');
const systemConfig = require('./system-config');

module.exports = class Client extends Vehicle {
  constructor({ host, port, folder, password }) {
    super({ name: 'client', host, port, folder, password });
    this._handshakeSyncDone = false;
  }

  start() {
    var _this = this;

    return _asyncToGenerator(function* () {
      const host = _this.host,
            port = _this.port;

      return new Promise(function (resolve, reject) {
        const useSSL = systemConfig.getSystemConfig().useSSL;
        const url = (useSSL ? 'https://' : 'http://') + host + ':' + port;
        const socket = io.connect(url, {
          secure: useSSL,
          reconnect: true,
          rejectUnauthorized: false
          // requestCert: useSSL,
          // agent: false
        });
        console.log('[QuantumSync] connect to ' + url + (useSSL ? ' with SSL' : ''));
        _this.socket = socket;

        _this.waitShakeSync();

        let isInitConnected = true;

        socket.on('connect_error', function (e) {
          isInitConnected = false;
          console.error('[QuantumSync] client connection fail, ' + e);
        });
        socket.on('reconnect', function () {
          console.log('[QuantumSync] client reconnected');
        });
        socket.on('disconnect', function () {
          if (_this.stub) {
            _this.stub.pubSub.channels = [];
            _this.stub = null;
          }
          _this.setBusy(false);
          _this._handshakeSyncDone = false;
          _this._receiptWaitingMap = {};
          console.log('[QuantumSync] client disconnected');
        });
        socket.on('duplicated-clients', function () {
          console.log('[QuantumSync] there is already a client connected, so close this session');
          _this.terminate();
        });
        socket.on('reconnect_attempt', function (attemptCount) {
          console.error('[QuantumSync] try ' + attemptCount + ' reconnecting');
        });
        _this.hook();
        socket.on('connect', function () {
          if (isInitConnected) {
            isInitConnected = false;
            console.log('[QuantumSync] client connect to server successful');
          }
          _this.confictResolver.reset();
          const delivery = dl.listen(socket);
          delivery.connect();

          delivery.on('delivery.connect', function (delivery) {
            _this.stub = delivery;
            _this.authorize();
            delivery.on('receive.success', (() => {
              var _ref = _asyncToGenerator(function* (file) {
                yield _this.onData(file);
                yield _this.sendReceipt(file);
              });

              return function (_x) {
                return _ref.apply(this, arguments);
              };
            })());
            resolve();
          });
        });
      });
    })();
  }

  authorize() {
    if (systemConfig.getSystemConfig().usePassword) {
      this.socket.on('auth-accept', () => {
        console.log('[QuantumSync] receive auth successful event');
        this.syncShake();
      });
      this.socket.on('auth-reject', () => {
        console.error('[QuantumSync] receive authorize fail event');
        this.terminate();
      });
      const shasum = crypto.createHash('sha1');
      shasum.update(this.socket.id + (systemConfig.getSystemConfig().secret || '') + this.password);
      if (this.socket) this.socket.emit('auth', shasum.digest('hex'));
    } else {
      this.syncShake();
    }
  }

  syncShake() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      if (!_this2._handshakeSyncDone && _this2._remoteDigest) {
        console.log('[QuantumSync] ' + _this2.name + ' preparing local file list digest');
        const localDigest = yield checksum(_this2.folder);
        console.log('[QuantumSync] ' + _this2.name + ' compare file list digest, and sync difference');
        yield handshakeSync(_this2, localDigest, _this2._remoteDigest);
        if (_this2.socket) _this2.socket.emit('client-handshake-done');
      }
    })();
  }

  waitShakeSync() {
    var _this3 = this;

    this.setBusy(true);

    this.socket.on('handshake-digest', (() => {
      var _ref2 = _asyncToGenerator(function* (remoteDigest) {
        _this3._remoteDigest = remoteDigest;
        if (_this3.stub) {
          yield _this3.syncShake();
        }
      });

      return function (_x2) {
        return _ref2.apply(this, arguments);
      };
    })());

    this.socket.on('server-handshake-done', (() => {
      var _ref3 = _asyncToGenerator(function* (remoteDigest) {
        _this3.setBusy(false);
        _this3._handshakeSyncDone = true;
        _this3._remoteDigest = null;
        console.log('[QuantumSync] ' + _this3.name + ' handshake sync end');

        _this3.dispatch({});
      });

      return function (_x3) {
        return _ref3.apply(this, arguments);
      };
    })());
  }

  setLocalLock() {
    if (this.isBusy() && !this._waitingLock) {
      if (this.socket) this.socket.emit('lock-result', false);
    } else {
      this._locked = true;
      if (this.socket) this.socket.emit('lock-result', true);
    }
  }

  terminate() {
    if (this.socket) {
      this.socket.close(true);
    }
    process.exit(1);
  }
};