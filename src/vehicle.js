const io = require('socket.io');
const dl = require('delivery');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');

module.exports = class Vehicle {
  constructor({ port, folder, host, password }) {
    this.port = port;
    this.folder = folder;
    this.host = host;
    this.password = password;
    this._waitingQueue = {};
    this._syncChangeMap = {};
    this._busying = false;
  }

  start() {
    
  }

  setBusy(isBusy) {
    this._busying = isBusy;
  }

  isBusy() {
    return this._busying;
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

    if (!this.isBusy()) {
      this.setBusy(true);
      const changes = this._waitingQueue;
      this._waitingQueue = {};
      try {
        await this.sendChanges(this.socket, this.stub, utils.toList(changes), this.folder);
      } catch (e) {
        this._waitingQueue = utils.mergeChanges(changes, this._waitingQueue);
        console.error("[QuantumSync] got exception when sync changes, "+ e);
      } finally {
        this.setBusy(false);
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
  
  async onData(file) {
    const { name } = file;
    const writePath = path.resolve(this.folder, name);

    if (await utils.exitsResource(writePath)) {
      const exitData = await utils.readFile(writePath);
      if (!exitData.equals(file.buffer)) {
        await this.writeFile(writePath, file.buffer);
      }
    } else {
      await this.writeFile(writePath, file.buffer);
    }
  }

  async onDelete(localPath) {
    const deletePath = path.resolve(this.folder, localPath);
    if (await utils.exitsResource(deletePath)) {
      const fileStat = await utils.lstatResource(deletePath);
      if (fileStat.isFile()) {
        await this.deleteFile(deletePath);
      } else if (fileStat.isDirectory()) {
        await this.deleteFolder(deletePath)
      }
      
    }
  }

  async onAddDir(localPath) {
    const dirPath = path.resolve(this.folder, localPath);
    if (!await utils.exitsResource(dirPath)) {
      await this.addFolder(dirPath);
    }
  }

  async writeFile(path, buffer) {
    console.log('[QuantumSync] write file to ' + path);
    
    try {
      await utils.writeFile(path, buffer);
    } catch (e) {
      console.log('[QuantumSync] write file to ' + path + ' fail, ' + e);
    }
    this._syncChangeMap[path] = {};
  }

  async deleteFile(path) {
    this._syncChangeMap[path] = {};
    await utils.deleteFile(path);
  }

  async addFolder(path) {
    this._syncChangeMap[path] = {};
    await utils.addFolderP(path);
  }

  async deleteFolder(path) {
    this._syncChangeMap[path] = {
      op: 'delete'
    };
    await utils.deleteFolderP(path);
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
