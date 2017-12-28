const io = require('socket.io-client');
const dl = require('delivery');
const utils = require('./utils');
const path = require('path');
const fs = require('fs');
const Vehicle = require('./vehicle');

module.exports = class Client extends Vehicle {
  constructor({ host, port, folder }) {
    super({ host, port, folder });
  }

  async start() {
    const { host, port } = this;
    const self = this;
    return new Promise((resolve, reject) => {
      const socket = io.connect('http://' + host + ':' + port);
      
      self.socket = socket;

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
      socket.on('delete-resource', (lcoalPath) => {
        self.onDelete(lcoalPath);
      });
      socket.on('connect', () => {
        if (isInitConnected) {
          isInitConnected = false;
          console.log('[QuantumSync] client connected');
        }
        const delivery = dl.listen(socket);
        delivery.connect();

        delivery.on('delivery.connect', (delivery) => {
          self.stub = delivery;
          delivery.on('receive.success',function(file){
            self.onData(file);
          });
          resolve();
        });
      })
    });
  }
}
