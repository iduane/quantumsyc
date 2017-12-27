const io = require('socket.io');
const dl = require('delivery');
const utils = require('./utils');

async function sendChanges(stub, changes) {

}

module.exports = class Client {
  constructor({ port }) {
    this.port = port;
    this._waitingQueue = {};
    this._busying = false;
  }

  start() {
    const self = this;
    return new Promise((resolve, reject) => {
      const listener = io.listen(this.port);
      listener.sockets.on('connection', (socket) => {
        const delivery = dl.listen(socket);

        delivery.on('delivery.connect', (delivery) => {
          self.stub = delivery;
          resolve();
        });
      })
    });
  }

  async dispatch(changes) {
    if (this._busying) {
      this._waitingQueue = utils.mergeChanges(this._busying);
    } else {
      this._busying = true;
      const changes = this._waitingQueue;
      this._waitingQueue = {};
      await sendChanges(this.stub, changes);
      this._busying = false;
    }
  }
  
  onData() {

  }

  terminate() {
  }
}
