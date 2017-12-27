const io = require('socket.io');
const dl = require('delivery');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');

module.exports = class Vehicle {
  constructor({ port, folder, host }) {
    this.port = port;
    this.folder = folder;
    this.host = host;
    this._waitingQueue = {};
    this._busying = false;
  }

  start() {
    
  }

  async dispatch(changes) {
    this._waitingQueue = utils.mergeChanges(this._waitingQueue, changes);

    if (!this._busying) {
      this._busying = true;
      const changes = this._waitingQueue;
      this._waitingQueue = {};
      await this.sendChanges(this.stub, utils.toList(changes), this.folder);
      this._busying = false;
    }
  }

  async sendChanges(stub, changes) {
    return Promise.all(changes.map((descriptor) => {
      return new Promise((resolve, reject) => {
        const fullPath = path.resolve(this.folder, descriptor.name);
        if (!fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isFile()) {
          resolve();
        } else {
          stub.send({ name: descriptor.name, path: fullPath });
          stub.on('send.success', () => {
            resolve();
          })
        }
      })
    }));
  }
  
  onData(file) {
    const { name } = file;
    console.log('receive file ' + name);
    const dirname = path.dirname(name);
    if (!fs.existsSync(dirname)) {
      utils.mkdirP(dirname);
    }
    if (fs.existsSync(path.resolve(this.folder, name))) {
      const exitData = fs.readFileSync(name);
      if (!exitData.equals(file.buffer)) {
        fs.writeFileSync(name, file.buffer);
      }
    } else {
      fs.writeFileSync(name, file.buffer);
    }
  }

  terminate() {
  }
}

