const io = require('socket.io');
const dl = require('delivery');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const Vehicle = require('./vehicle');

module.exports = class Client extends Vehicle {
  constructor({ host, port, folder }) {
    super({ host, port, folder });
  }

  start() {
    const self = this;
    return new Promise((resolve, reject) => {
      const listener = io.listen(this.port);
      console.log('[QuantumSync] server started.')
      listener.sockets.on('connection', (socket) => {
        if (self.stub) { // only allow one alive client
          socket.emit('duplicated-clients');
          socket.disconnect(true);
          console.log('[QuantumSync] close connect since there is a exiting client connected.')
          return;
        }
        self.socket = socket;
        const delivery = dl.listen(socket);
        console.log('[QuantumSync] server accept client connection request.')
        socket.on('disconnect', (reason) => {
          self.stub = null;
          self.socket = null;
          console.log('[QuantumSync] client disconnect, reason: '+ reason);
        });
        socket.on('error', (e) => {
          console.error('[QuantumSync] client meet eror' + e);
        });
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
}
