const io = require('socket.io-client');
const dl = require('delivery');
const crypto = require('crypto')
const utils = require('./utils');
const path = require('path');
const fs = require('fs');
const Vehicle = require('./vehicle');
const handshakeSync = require('./handshake-sync');
const checksum = require('./checksum');
const systemConfig = require('./system-config');

module.exports = class Client extends Vehicle {
  constructor({ host, port, folder, password }) {
    super({ name: 'client', host, port, folder, password });
    this._handshakeSyncDone = false;
  }

  async start() {
    const { host, port } = this;
    return new Promise((resolve, reject) => {
      const useSSL = systemConfig.getSystemConfig().useSSL;
      const url = (useSSL ? 'https://' : 'http://') + host + ':' + port;
      const socket = io.connect(url, {
        secure: useSSL,
        reconnect: true,
        rejectUnauthorized: false,
        // requestCert: useSSL,
        // agent: false
      });
      console.log('[QuantumSync] connect to ' + url + (useSSL ? ' with SSL' : ''));
      this.socket = socket;

      this.waitShakeSync();

      let isInitConnected = true;

      socket.on('connect_error', (e) => {
        isInitConnected = false;
        console.error('[QuantumSync] client connection fail, ' + e);
      });
      socket.on('reconnect', () => {
        console.log('[QuantumSync] client reconnected');
      });
      socket.on('disconnect', () => {
        if (this.stub) {
          this.stub.pubSub.channels = [];
          this.stub = null;
        }
        this.setBusy(false);
        this._handshakeSyncDone = false;
        this._receiptWaitingMap = {};
        console.log('[QuantumSync] client disconnected');
      });
      socket.on('duplicated-clients', () => {
        console.log('[QuantumSync] there is already a client connected, so close this session');
        this.terminate();
      });
      socket.on('reconnect_attempt', (attemptCount) => {
        console.error('[QuantumSync] try ' + attemptCount + ' reconnecting');
      });
      this.hook();
      socket.on('connect', () => {
        if (isInitConnected) {
          isInitConnected = false;
          console.log('[QuantumSync] client connect to server successful');
        }
        this.confictResolver.reset();
        const delivery = dl.listen(socket);
        delivery.connect();

        delivery.on('delivery.connect', (delivery) => {
          this.stub = delivery;
          this.authorize();
          delivery.on('receive.success', async (file) => {
            await this.onData(file);
            await this.sendReceipt(file);
          });
          resolve();
        });
      })
    });
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

  async syncShake() {
    if (!this._handshakeSyncDone && this._remoteDigest) {
      console.log('[QuantumSync] ' + this.name + ' preparing local file list digest');
      const localDigest = await checksum(this.folder);
      console.log('[QuantumSync] ' + this.name + ' compare file list digest, and sync difference');
      await handshakeSync(this, localDigest, this._remoteDigest);
      if (this.socket) this.socket.emit('client-handshake-done');
    }
  }

  waitShakeSync() {
    this.setBusy(true);

    this.socket.on('handshake-digest', async (remoteDigest) => {
      this._remoteDigest = remoteDigest;
      if (this.stub) {
        await this.syncShake();
      }
    });

    this.socket.on('server-handshake-done', async (remoteDigest) => {
      this.setBusy(false);
      this._handshakeSyncDone = true;
      this._remoteDigest = null;
      console.log('[QuantumSync] ' + this.name + ' handshake sync end');
      
      this.dispatch({});
    });
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
}
