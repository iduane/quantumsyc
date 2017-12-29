const io = require('socket.io');
var https = require('https');
const dl = require('delivery');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const generator = require('generate-password');
const Vehicle = require('./vehicle');
const checksum = require('./checksum');
const systemConfig = require('./system-config');

module.exports = class Client extends Vehicle {
  constructor({ host, port, folder, password }) {
    super({ host, port, folder, password });
  }

  start() {
    const self = this;
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
        if (self.stub) { // only allow one alive client
          socket.emit('duplicated-clients');
          socket.disconnect(true);
          console.log('[QuantumSync] close connect since there is a exiting client connected.')
          return;
        }
        self.socket = socket;
        const delivery = dl.listen(socket);
        socket.on('disconnect', (reason) => {
          self.stub = null;
          self.socket = null;
          console.log('[QuantumSync] client disconnect, reason: '+ reason);
        });
        socket.on('error', (e) => {
          console.error('[QuantumSync] client meet eror' + e);
        });
        this.setBusy(true);
        self.checkCredential(password);
        self.hook();
        delivery.on('delivery.connect', (delivery) => {  
          self.stub = delivery;
          delivery.on('receive.success',function(file){
            self.onData(file);
          });
        });
      })
      resolve();
    });
  }

  checkCredential(password) {
    if (systemConfig.getSystemConfig().usePassword) {
      const self = this;
      this.socket.on('auth', (credential) => {
        if (password === credential) {
          self.socket.emit('auth-accept');
          console.log('[QuantumSync] accept client auth request');
          self.handeShakeSync();
        } else {
          self.socket.emit('auth-reject');
          self.socket.disconnect(true);
          self.socket = null;
          self.stub = null;
          console.error('[QuantumSync] reject client auth request');
        }
      });
    } else {
      this.handeShakeSync();
    }
  }

  handeShakeSync() {
    const self = this;
    this.socket.on('handshake-done', () => {
      self.setBusy(false);
      console.log('[QuantumSync] handshake sync end');
    });
    this.socket.on('pull-changes', async (changes) => {
      try {
        await self.sendChanges(self.socket, self.stub, changes, self.folder);
        self.socket.emit('pull-changes-done');
      } catch (e) {
        console.error("[QuantumSync] got exception when sync pull changes, "+ e);
      }
    });
    try {
      console.log('[QuantumSync] handshake sync start');
      this.socket.emit('handshake-digest', checksum(this.folder));
    } catch (e) {
      console.error('[QuantumSync] handshake sync meet eror' + e);
      this.setBusy(false);
    }
  }
}
