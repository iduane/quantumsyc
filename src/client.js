const io = require('socket.io-client');
const dl = require('delivery');
const utils = require('./utils');
const path = require('path');
const fs = require('fs');
const Vehicle = require('./vehicle');
const handshakeSync = require('./handshake-sync');
const checksum = require('./checksum');

module.exports = class Client extends Vehicle {
  constructor({ host, port, folder }) {
    super({ host, port, folder });
    this._handshakeSyncDone = false;
  }

  async start() {
    const { host, port } = this;
    const self = this;
    return new Promise((resolve, reject) => {
      const socket = io.connect('http://' + host + ':' + port);
      
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
        self.stub = null;
        self._handshakeSyncDone = false;
        console.log('[QuantumSync] client disconnected');
      });
      socket.on('duplicated-clients', () => {
        console.log('[QuantumSync] there is already a client connected, so close this session');
        socket.close(true);
        process.exit(1);
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
        const delivery = dl.listen(socket);
        delivery.connect();

        delivery.on('delivery.connect', (delivery) => {
          self.stub = delivery;
          self.syncShake();
          delivery.on('receive.success',function(file){
            self.onData(file);
          });
          resolve();
        });
      })
    });
  }

  async syncShake() {
    if (!this._handshakeSyncDone && this._remoteDigest) {
      const localDigest = checksum(this.folder);
      console.log('[QuantumSync] handshake sync end');
      await handshakeSync(this, localDigest, this._remoteDigest);
      this.socket.emit('handshake-done');
      this.setBusy(false);
      this._handshakeSyncDone = true;
      this._remoteDigest = null;
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
  }
}
