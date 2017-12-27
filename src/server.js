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
      listener.sockets.on('connection', (socket) => {
        const delivery = dl.listen(socket);

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
