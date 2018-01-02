const { clearTimeout, setTimeout } = require('timers');
const io = require('socket.io');
const dl = require('delivery');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const upath = require('upath');
const ConflictResolver = require('./conflict-resolver');

module.exports = class Vehicle {
  constructor({ name, port, folder, host, password }) {
    this.port = port;
    this.folder = folder;
    this.host = host;
    this.password = password;
    this.name = name;
    this.confictResolver = new ConflictResolver(folder, this.name);
    this._busying = false;
    this._receiptWaitingMap = {};
    this._lockResolver = null;
    this._unlockResolver = null;
    this._locked = false;

    setInterval(() => {
      this.checkReceiptWaintingMap();
    }, 10000);
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
    this.socket.on('receipt', (receipt) => {
      self.onReceipt(receipt);
    });
    this.socket.on('set-lock', () => {
      self.setLocalLock();
    });
    this.socket.on('remove-lock', () => {
      self.removeLocalLock();
    });
    this.socket.on('lock-result', (lockable) => {
      self.onLockResult(lockable);
    });
    this.socket.on('unlock-result', (lockable) => {
      self.onUnlockResult();
    });
  }

  async dispatch(changes) {
    this.confictResolver.reduceChanges(changes);

    if (!this.isBusy()) {
      this.setBusy(true);
      const changes = this.confictResolver.commitChanges();
      this.confictResolver.emptyChanges();
      if (changes.length > 0) {
        const locked = await this.setTargetLock();
        if (locked) {
          try {
            await this.sendChanges(this.socket, this.stub, changes, this.folder);
          } catch (e) {
            console.error("[QuantumSync] got exception when sync changes, "+ e);
          } finally {
            this.setBusy(false);
          }
          await this.removeTargetLock();
        } else {
          console.log('[QuantumSync] ' + this.name + ': target is busy, retry sync later');
          this.delayDispatch(changes);
          this.setBusy(false);
        }
      } else {
        this.setBusy(false);
      }
    } else {
      this.delayDispatch(changes);
    }
  }

  delayDispatch(changes) {
    const self = this;
    if (this._delayerID) {
      clearTimeout(this._delayerID);
    }
    this._delayerID = setTimeout(() => {
      self._delayerID = null;
      self.dispatch({});
    }, Math.round(1000 * (1 + Math.random() / 2)));
  }

  setLocalLock() {
    if (this.isBusy()) {
      this.socket.emit('lock-result', false);
    } else {
      this._locked = true;
      this.socket.emit('lock-result', true);
    }
  }

  removeLocalLock() {
    this._locked = false;
    this.socket.emit('unlock-result');
  }

  async setTargetLock() {
    this._waitingLock = true;
    this.socket.emit('set-lock');
    const self = this;
    const state = await new Promise((resolve) => {
      self._lockResolver = resolve;
    });

    return state;
  }

  async removeTargetLock() {
    this.socket.emit('remove-lock');
    const self = this;
    await new Promise((resolve) => {
      self._unlockResolver = resolve;
    });
    return true;
  }

  onLockResult(lockable) {
    this._waitingLock = false;
    if (this._lockResolver) {
      this._lockResolver(lockable);
      this._lockResolver = null;
    }
  }

  onUnlockResult() {
    if (this._unlockResolver) {
      this._unlockResolver();
      this._unlockResolver = null;
    }
  }

  async sendChanges(socket, stub, changes) {
    if (!stub) {
      console.log('[QuantumSync] received changes, but no clients connected yet');
      return Promise.reject();
    }
    const logName = this.name;
    const self = this;
    await Promise.all(changes.map((descriptor) => {
      return new Promise((resolve, reject) => {
        const fullPath = descriptor.fullPath || path.resolve(this.folder, descriptor.name);
        const relPath = upath.normalize(descriptor.name);
        if (descriptor.op === 'delete') {
          console.log('[QuantumSync] send remove file request for: ' + descriptor.name);
          socket.emit('delete-resource', relPath);
          resolve();
        } else {
          if (!fs.existsSync(fullPath)) {
            console.log('[QuantumSync] the sync file ' + fullPath + ' is not exit');
            resolve();
          } else {
            const fileStat = fs.lstatSync(fullPath);
            if (fileStat.isFile()) {
              console.log('[QuantumSync] ' + logName +  ' send sync file request for: ' + descriptor.name);
              
              stub.send({ name: relPath, path: fullPath });
              stub.on('send.success', () => {
                self.waitReceipt(relPath, resolve);
              })
            } else if (fileStat.isDirectory()) {
              console.log('[QuantumSync] send sync folder request for: ' + descriptor.name);
              socket.emit('add-folder', relPath);
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

  async sendReceipt(file) {
    const { name } = file;
    this.socket.emit('receipt', { name: upath.normalize(name) });
  }

  async onReceipt({ name }) {
    const relPath = name;
    if (this._receiptWaitingMap[relPath]) {
      this._receiptWaitingMap[relPath].resolve();
      delete this._receiptWaitingMap[relPath];
    }
  }

  waitReceipt(relPath, resolve) {
    this._receiptWaitingMap[relPath] = { resolve, time: +(new Date()) };
  }

  checkReceiptWaintingMap() {
    const currTime = +(new Date());
    for (let relPath in this._receiptWaitingMap) {
      if ((currTime - this._receiptWaitingMap[relPath]) > 1000 * 10) {
        this._receiptWaitingMap[relPath].resolve();
        delete this._receiptWaitingMap[relPath];
      }
    }
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
    console.log('[QuantumSync] ' + this.name + ' write file to ' + path);
    
    try {
      await utils.writeFile(path, buffer);
    } catch (e) {
      console.log('[QuantumSync] write file to ' + path + ' fail, ' + e);
    }
    this.confictResolver.updateCache(path, {
      status: 'changed',
      data: buffer,
      type: 'file'
    });
  }

  async deleteFile(path) {
    console.log('[QuantumSync] ' + this.name + ' delete file ' + path);

    await utils.deleteFile(path);
    this.confictResolver.updateCache(path, {
      status: 'deleted',
      type: 'file',
    });
  }

  async addFolder(path) {
    await utils.addFolderP(path);
    this.confictResolver.updateCache(path, {
      status: 'changed',
      type: 'folder',
    });
  }

  async deleteFolder(path) {
    await utils.deleteFolderP(path);
    this.confictResolver.updateCache(path, {
      status: 'deleted',
      type: 'folder',
    });
  }

  terminate() {
  }
}
