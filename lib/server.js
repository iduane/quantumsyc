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
    const self = this;
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
        if (self.stub) {
          // only allow one alive client
          socket.emit('duplicated-clients');
          socket.disconnect(true);
          console.log('[QuantumSync] close connect since there is a exiting client connected.');
          return;
        }
        self.socket = socket;
        self.confictResolver.reset();
        const delivery = dl.listen(socket);
        socket.on('disconnect', reason => {
          self.stub = null;
          self.socket = null;
          console.log('[QuantumSync] client disconnect, reason: ' + reason);
        });
        socket.on('error', e => {
          console.error('[QuantumSync] client meet eror' + e);
        });
        this.setBusy(true);
        self.checkCredential(password);
        self.hook();
        delivery.on('delivery.connect', delivery => {
          self.stub = delivery;
          delivery.on('receive.success', (() => {
            var _ref = _asyncToGenerator(function* (file, extraParams) {
              yield self.onData(file);
              yield self.sendReceipt(file, extraParams);
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
      const self = this;
      this.socket.on('auth', credential => {
        const shasum = crypto.createHash('sha1');
        shasum.update(self.socket.id + (systemConfig.getSystemConfig().secret || '') + password);
        if (credential === shasum.digest('hex')) {
          self.socket.emit('auth-accept');
          console.log('[QuantumSync] accept client auth request');
          self.handeShakeSync();
        } else {
          self.socket.emit('auth-reject');
          self.socket.disconnect(true);
          self.socket = null;
          self.stub = null;
          self._receiptWaitingMap = {};
          console.error('[QuantumSync] reject client auth request');
        }
      });
    } else {
      this.handeShakeSync();
    }
  }

  handeShakeSync() {
    const self = this;
    this.socket.on('client-handshake-done', () => {
      self.setBusy(false);
      self.socket.emit('server-handshake-done');
      self.dispatch({});
      console.log('[QuantumSync] ' + this.name + ' handshake sync end');
    });
    this.socket.on('pull-changes', (() => {
      var _ref2 = _asyncToGenerator(function* (changes) {
        try {
          yield self.sendChanges(self.socket, self.stub, changes, self.folder);
          self.socket.emit('pull-changes-done');
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
      this.socket.emit('handshake-digest', checksum(this.folder));
    } catch (e) {
      console.error('[QuantumSync] handshake sync meet eror' + e);
      this.setBusy(false);
    }
  }
};