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
      try {
        await this.sendChanges(this.socket, this.stub, utils.toList(changes), this.folder);
      } catch (e) {
        this._waitingQueue = utils.mergeChanges(changes, this._waitingQueue);
        console.error("[QuantumSync] got exception when sync changes, "+ e);
      } finally {
        this._busying = false;
      }
    }
  }

  async sendChanges(socket, stub, changes) {
    if (!stub) {
      console.log('[QuantumSync] received changes, but no clients connected yet');
      return Promise.reject();
    }
    return Promise.all(changes.map((descriptor) => {
      return new Promise((resolve, reject) => {
        const fullPath = path.resolve(this.folder, descriptor.name);
        if (descriptor.op === 'delete') {
          console.log('[QuantumSync] send remove file request for: ' + descriptor.name);
          socket.send('delete-resource', descriptor.name);
          resolve();
        } else {
          if (!fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isFile()) {
            console.log('[QuantumSync] the sync file ' + fullPath + ' is not exit');
            resolve();
          } else {
            console.log('[QuantumSync] send sync file request for: ' + descriptor.name);
            stub.send({ name: descriptor.name, path: fullPath });
            stub.on('send.success', () => {
              resolve();
            })
          }
        }
      })
    }));
  }
  
  onData(file) {
    const { name } = file;
    const writePath = path.resolve(this.folder, name);
    const dirname = path.dirname(name);

    if (!fs.existsSync(dirname)) {
      utils.mkdirP(dirname);
    }
    if (fs.existsSync(writePath)) {
      const exitData = fs.readFileSync(writePath);
      if (!exitData.equals(file.buffer)) {
        this.writeTarget(writePath, file.buffer);
      }
    } else {
      this.writeTarget(writePath, file.buffer);
    }
  }

  onDelete(localPath) {
    
  }

  writeTarget(path, buffer) {
    console.log('[QuantumSync] write file to ' + path);
    fs.writeFileSync(path, buffer);
  }

  terminate() {
  }
}

