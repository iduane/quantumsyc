'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const io = require('socket.io');
const https = require('https');
const dl = require('delivery');
const crypto = require('crypto');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const generator = require('generate-password');
const Vehicle = require('./vehicle');
const checksum = require('./checksum');
const systemConfig = require('./system-config');

module.exports = class Client extends Vehicle {
  constructor({ host, port, folder, password }) {
    super({ name: 'server', host, port, folder, password });
  }

  start() {
    var _this = this;

    return new Promise((resolve, reject) => {
      const usePassword = systemConfig.getSystemConfig().usePassword;
      const password = usePassword ? this.password ? this.password : generator.generate({
        length: 10,
        numbers: true
      }) : '';
      const useSSL = systemConfig.getSystemConfig().useSSL;
      let listener;
      if (useSSL) {
        const app = https.createServer(systemConfig.getSystemConfig().sslOptions);
        listener = io(app);
        app.listen(this.port);
      } else {
        listener = io.listen(this.port);
      }

      console.log('[QuantumSync] server started, listen port: ' + this.port + (useSSL ? ', with SSL' : '') + (usePassword ? ', use password: ' + password : ''));
      listener.sockets.on('connection', socket => {
        if (this.stub) {
          // only allow one alive client
          socket.emit('duplicated-clients');
          // socket.disconnect(true);
          console.log('[QuantumSync] close connect since there is a exiting client connected.');
          return;
        }
        this.socket = socket;
        this.confictResolver.reset();
        const delivery = dl.listen(socket);
        socket.on('disconnect', reason => {
          if (this.stub) {
            this.stub.pubSub.channels = [];
            this.stub = null;
          }
          if (this.socket) {
            this.socket.disconnect(true);
            this.socket = null;
          }
          this.setBusy(false);
          this.setLock(false);
          console.log('[QuantumSync] client disconnect, reason: ' + reason);
        });
        socket.on('error', e => {
          console.error('[QuantumSync] client meet eror' + e);
        });
        this.setBusy(true);
        this.checkCredential(password);
        this.hook();
        delivery.on('delivery.connect', delivery => {
          this.stub = delivery;
          delivery.on('receive.success', (() => {
            var _ref = _asyncToGenerator(function* (file, extraParams) {
              yield _this.onData(file);
              yield _this.sendReceipt(file, extraParams);
            });

            return function (_x, _x2) {
              return _ref.apply(this, arguments);
            };
          })());
        });
      });
      resolve();
    });
  }

  checkCredential(password) {
    if (systemConfig.getSystemConfig().usePassword) {
      this.socket.on('auth', credential => {
        const shasum = crypto.createHash('sha1');
        shasum.update(this.socket.id + (systemConfig.getSystemConfig().secret || '') + password);
        if (credential === shasum.digest('hex')) {
          if (this.socket) this.socket.emit('auth-accept');
          console.log('[QuantumSync] accept client auth request');
          this.handeShakeSync();
        } else {
          if (this.socket) this.socket.emit('auth-reject');
          this.socket.disconnect(true);
          this.socket = null;
          this.stub = null;
          this._receiptWaitingMap = {};
          console.error('[QuantumSync] reject client auth request');
        }
      });
    } else {
      this.handeShakeSync();
    }
  }

  handeShakeSync() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      _this2.socket.on('client-handshake-done', function () {
        _this2.setBusy(false);
        if (_this2.socket) _this2.socket.emit('server-handshake-done');
        _this2.dispatch({});
        console.log('[QuantumSync] ' + _this2.name + ' handshake sync end');
      });
      _this2.socket.on('pull-changes', (() => {
        var _ref2 = _asyncToGenerator(function* (changes) {
          try {
            yield _this2.sendChanges(_this2.socket, _this2.stub, changes, _this2.folder);
            if (_this2.socket) _this2.socket.emit('pull-changes-done');
          } catch (e) {
            console.error("[QuantumSync] got exception when sync pull changes, " + e);
          }
        });

        return function (_x3) {
          return _ref2.apply(this, arguments);
        };
      })());
      try {
        console.log('[QuantumSync] handshake sync start');
        console.log('[QuantumSync] ' + _this2.name + ' preparing server file list digest');
        const serverDigest = yield checksum(_this2.folder);
        console.log('[QuantumSync] ' + _this2.name + ' send server file list digest');
        if (_this2.socket) _this2.socket.emit('handshake-digest', serverDigest);
      } catch (e) {
        console.error('[QuantumSync] handshake sync meet eror' + e);
        _this2.setBusy(false);
      }
    })();
  }
};