const io = require('socket.io');
const https = require('https');
const dl = require('delivery');
const crypto = require('crypto')
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
    return new Promise((resolve, reject) => {
      const usePassword = systemConfig.getSystemConfig().usePassword;
      const password = usePassword ? (this.password ? this.password : generator.generate({
        length: 10,
        numbers: true
      })) : '';
      const useSSL = systemConfig.getSystemConfig().useSSL;
      let listener;
      if (useSSL) {
        const app = https.createServer(systemConfig.getSystemConfig().sslOptions);
        listener = io(app);
        app.listen(this.port);
      } else {
        listener = io.listen(this.port);
      }
      
      console.log('[QuantumSync] server started, listen port: ' + this.port +
        (useSSL ? ', with SSL' : '') +
        (usePassword ? (', use password: ' + password) : ''));
      listener.sockets.on('connection', (socket) => {
        if (this.stub) { // only allow one alive client
          socket.emit('duplicated-clients');
          // socket.disconnect(true);
          console.log('[QuantumSync] close connect since there is a exiting client connected.')
          return;
        }
        this.socket = socket;
        this.confictResolver.reset();
        const delivery = dl.listen(socket);
        socket.on('disconnect', (reason) => {
          if (this.stub) {
            this.stub.pubSub.channels = [];
            this.stub = null;
          }
          this.socket.destroy();
          this.setBusy(false);
          this.setLock(false);
          console.log('[QuantumSync] client disconnect, reason: '+ reason);
        });
        socket.on('error', (e) => {
          console.error('[QuantumSync] client meet eror' + e);
        });
        this.setBusy(true);
        this.checkCredential(password);
        this.hook();
        delivery.on('delivery.connect', (delivery) => {  
          this.stub = delivery;
          delivery.on('receive.success', async (file, extraParams) => {
            await this.onData(file);
            await this.sendReceipt(file, extraParams);
          });
        });
      })
      resolve();
    });
  }

  checkCredential(password) {
    if (systemConfig.getSystemConfig().usePassword) {
      this.socket.on('auth', (credential) => {
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

  async handeShakeSync() {
    this.socket.on('client-handshake-done', () => {
      this.setBusy(false);
      if (this.socket) this.socket.emit('server-handshake-done');
      this.dispatch({});
      console.log('[QuantumSync] ' + this.name + ' handshake sync end');
    });
    this.socket.on('pull-changes', async (changes) => {
      try {
        await this.sendChanges(this.socket, this.stub, changes, this.folder);
        if (this.socket) this.socket.emit('pull-changes-done');
      } catch (e) {
        console.error("[QuantumSync] got exception when sync pull changes, "+ e);
      }
    });
    try {
      console.log('[QuantumSync] handshake sync start');
      const serverDigest = await checksum(this.folder);
      if (this.socket) this.socket.emit('handshake-digest', serverDigest);
    } catch (e) {
      console.error('[QuantumSync] handshake sync meet eror' + e);
      this.setBusy(false);
    }
  }
}
