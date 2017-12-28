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
    this._syncChangeMap = {};
    this._busying = false;
  }

  start() {
    
  }

  hook() {
    const self = this;
    this.socket.on('delete-resource', (lcoalPath) => {
      console.log('[QuantumSync] received delete resource request for: ' + lcoalPath);
      self.onDelete(lcoalPath);
    });
    this.socket.on('add-folder', (lcoalPath) => {
      console.log('[QuantumSync] received add folder request for: ' + lcoalPath);
      self.onAddDir(lcoalPath);
    });
  }

  async dispatch(changes) {
    tripSyncChange(changes, this._syncChangeMap, this.folder);
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
        const fullPath = descriptor.fullPath || path.resolve(this.folder, descriptor.name);
        if (descriptor.op === 'delete') {
          console.log('[QuantumSync] send remove file request for: ' + descriptor.name);
          socket.emit('delete-resource', descriptor.name);
          resolve();
        } else {
          if (!fs.existsSync(fullPath)) {
            console.log('[QuantumSync] the sync file ' + fullPath + ' is not exit');
            resolve();
          } else {
            const fileStat = fs.lstatSync(fullPath);
            if (fileStat.isFile()) {
              console.log('[QuantumSync] send sync file request for: ' + descriptor.name);
              stub.send({ name: descriptor.name, path: fullPath });
              stub.on('send.success', () => {
                resolve();
              })
            } else if (fileStat.isDirectory()) {
              console.log('[QuantumSync] send sync folder request for: ' + descriptor.name);
              socket.emit('add-folder', descriptor.name);
              resolve();
            } else {
              console.log('[QuantumSync] the sync file type of ' + fullPath + ' is not supported');
              resolve();
            }
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
        this.writeFile(writePath, file.buffer);
      }
    } else {
      this.writeFile(writePath, file.buffer);
    }
  }

  onDelete(localPath) {
    const deletePath = path.resolve(this.folder, localPath);
    if (fs.existsSync(deletePath)) {
      const fileStat = fs.lstatSync(deletePath);
      if (fileStat.isFile()) {
        this.deleteFile(deletePath);
      } else if (fileStat.isDirectory()) {
        this.deleteFolder(deletePath)
      }
      
    }
  }

  onAddDir(localPath) {
    const dirPath = path.resolve(this.folder, localPath);
    if (!fs.existsSync(dirPath)) {
      this.addFolder(dirPath);
    }
  }

  writeFile(path, buffer) {
    console.log('[QuantumSync] write file to ' + path);
    
    try {
      fs.writeFileSync(path, buffer);
    } catch (e) {
      console.log('[QuantumSync] write file to ' + path + ' fail, ' + e);
    }
    this._syncChangeMap[path] = {};
  }

  deleteFile(path) {
    this._syncChangeMap[path] = {};
    fs.unlinkSync(path);
  }

  addFolder(path) {
    this._syncChangeMap[path] = {};
    const addDirs = utils.mkdirP(path);
  }

  deleteFolder(path) {
    this._syncChangeMap[path] = {
      op: 'delete'
    };
    fs.rmdirSync(path);
  }

  terminate() {
  }
}

function tripSyncChange(incChanges, syncChanges, folder) {
  for (let localPath in incChanges) {
    const desc = incChanges[localPath];
    const fullPath = desc.fullPath || path.resolve(folder, localPath);
    desc.fullPath = fullPath;
    if (syncChanges[fullPath]) {
      delete incChanges[localPath];
      delete syncChanges[fullPath];
    }
  }
}
