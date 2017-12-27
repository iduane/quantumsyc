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
      socket.on('connect', () => {
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
