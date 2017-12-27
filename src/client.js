const io = require('socket.io-client');
const dl = require('delivery');
const utils = require('./utils');

function sendChanges(stub, changes) {
  return Promise.all(changes.map((descriptor) => {
    return new Promise((resolve, reject) => {
      stub.send({ path: descriptor.name });
      stub.on('send.success', () => {
        resolve();
      })
    })
  }));
}

module.exports = class Client {
  constructor({ host, port }) {
    this.host = host;
    this.port = port;
    this._waitingQueue = {};
    this._busying = false;
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
      await sendChanges(this.stub, utils.toList(changes));
      this._busying = false;
    }
  }

  onData() {

  }

  terminate() {
  }
}
