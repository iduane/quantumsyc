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
    const self = this;
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
      self.socket = socket;

      self.waitShakeSync();

      let isInitConnected = true;

      socket.on('connect_error', (e) => {
        isInitConnected = false;
        console.error('[QuantumSync] client connection fail, ' + e);
      });
      socket.on('reconnect', () => {
        console.log('[QuantumSync] client reconnected');
      });
      socket.on('disconnect', () => {
        if (self.stub) {
          self.stub.pubSub.channels = [];
          self.stub = null;
        }
        self._handshakeSyncDone = false;
        self._receiptWaitingMap = {};
        console.log('[QuantumSync] client disconnected');
      });
      socket.on('duplicated-clients', () => {
        console.log('[QuantumSync] there is already a client connected, so close this session');
        self.terminate();
      });
      socket.on('reconnect_attempt', (attemptCount) => {
        console.error('[QuantumSync] try ' + attemptCount + ' reconnecting');
      });
      self.hook();
      socket.on('connect', () => {
        if (isInitConnected) {
          isInitConnected = false;
          console.log('[QuantumSync] client connect to server successful');
        }
        self.confictResolver.reset();
        const delivery = dl.listen(socket);
        delivery.connect();

        delivery.on('delivery.connect', (delivery) => {
          self.stub = delivery;
          self.authorize();
          delivery.on('receive.success', async function(file){
            await self.onData(file);
            await self.sendReceipt(file);
          });
          resolve();
        });
      })
    });
  }

  authorize() {
    if (systemConfig.getSystemConfig().usePassword) {
      const self = this;
      this.socket.on('auth-accept', () => {
        console.log('[QuantumSync] receive auth successful event');
        self.syncShake();
      });
      this.socket.on('auth-reject', () => {
        console.error('[QuantumSync] receive authorize fail event');
        self.terminate();
      });
      const shasum = crypto.createHash('sha1');
      shasum.update(this.socket.id + (systemConfig.getSystemConfig().secret || '') + this.password);
      this.socket.emit('auth', shasum.digest('hex'));
    } else {
      this.syncShake();
    }
  }

  async syncShake() {
    if (!this._handshakeSyncDone && this._remoteDigest) {
      const localDigest = checksum(this.folder);
      await handshakeSync(this, localDigest, this._remoteDigest);
      this.socket.emit('client-handshake-done');
    }
  }

  waitShakeSync() {
    this.setBusy(true);

    const self = this;
    this.socket.on('handshake-digest', async (remoteDigest) => {
      self._remoteDigest = remoteDigest;
      if (self.stub) {
        await self.syncShake();
      }
    });

    this.socket.on('server-handshake-done', async (remoteDigest) => {
      self.setBusy(false);
      self._handshakeSyncDone = true;
      self._remoteDigest = null;
      console.log('[QuantumSync] ' + this.name + ' handshake sync end');
      
      self.dispatch({});
    });
  }
  
  setLocalLock() {
    if (this.isBusy() && !this._waitingLock) {
      this.socket.emit('lock-result', false);
    } else {
      this._locked = true;
      this.socket.emit('lock-result', true);
    }
  }

  terminate() {
    if (this.socket) {
      this.socket.close(true);
    }
    process.exit(1);
  }
}
