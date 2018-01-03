const { clearTimeout, setTimeout } = require('timers');
const crypto = require('crypto');
const io = require('socket.io');
const dl = require('delivery');
const { Buffer } = require('buffer');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const upath = require('upath');
const jsDiff = require('diff');
const isBinaryFile = require('isbinaryfile');
const LRU = require("lru-cache")
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
    this._diffResolver = {};
    this._lockResolver = null;
    this._unlockResolver = null;
    this._locked = false;
    this._cache = new LRU({  max: 100, maxAge: 1000 * 60 * 60 });
    setInterval(() => {
      this.checkReceiptWaintingMap();
      this.checkDiffResolverMap();
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
    this.socket.on('text-file-diff', (data) => {
      self.onReceiveTextFileDiff(data);
    });
    this.socket.on('text-file-diff-reject', (relPath) => {
      self.onRejectTextFileDiff(relPath);
    });
    this.socket.on('text-file-diff-accept', (relPath) => {
      self.onAcceptTextFileDiff(relPath);
    });
  }

  async dispatch(changes) {
    this.confictResolver.reduceChanges(changes);

    if (!this.isBusy() || !this.isLocked()) {
      this.clearDelayDispatch();
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
      this.delayDispatch({});
    }
  }

  delayDispatch(changes) {
    const self = this;
    this.clearDelayDispatch();
    this._delayerID = setTimeout(() => {
      self._delayerID = null;
      self.dispatch({});
    }, Math.round(2000 * (1 + Math.random() / 2)));
  }

  clearDelayDispatch() {
    if (this._delayerID) {
      clearTimeout(this._delayerID);
    }
  }

  setLocalLock() {
    if (this.isBusy()) {
      this.socket.emit('lock-result', false);
    } else {
      this.setLock(true);
      this.socket.emit('lock-result', true);
    }
  }

  removeLocalLock() {
    this.setLock(true);
    this.socket.emit('unlock-result');
  }

  isLocked() {
    return this._locked;
  }

  setLock(flag) {
    this._locked = flag;
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
              self.sendFile(resolve, relPath, fullPath);
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

  async sendFile(resolve, relPath, fullPath) {
    const fileData = await utils.readFile(fullPath);
    const fileState = await utils.lstatResource(fullPath);
    const useDiff = fileState.size > 10240 && !isBinaryFile.sync(fileData, fileState.size);

    let isTextDiffAccepted = false;
    if (useDiff) {
      isTextDiffAccepted = await this.sendTextFileDiff(relPath, fullPath, fileData);
    }
    if (!isTextDiffAccepted) {
      console.log('[QuantumSync] ' + this.name +  ' send sync file request for: ' + relPath);
      const self = this;
      this.stub.send({ name: relPath, path: fullPath });
      this.stub.on('send.success', () => {
        self.waitReceipt(relPath, resolve);
      });
    } else {
      resolve();
    }
  }

  async sendTextFileDiff(relPath, fullPath, fileData) {
    console.log('[QuantumSync] ' + this.name +  ' send file changes for: ' + relPath);

    const cache = this._cache.get(relPath);
    // const fileData = await utils.readFile(fullPath);
    const text = fileData.toString();
    const md5 = crypto.createHash('md5');
    md5.update(fileData);
    const digest = md5.digest('hex');
    this._cache.set(relPath, { text, digest });

    if (cache) {
      const diff = jsDiff.createPatch(relPath, cache.text + "\n", text + "\n");
      this.socket.emit('text-file-diff', { relPath, diff, digest });
      const isAccepted = await new Promise((resolve) => {
        if (this._diffResolver[relPath]) {
          this._diffResolver[relPath].resolve();
        }
        this._diffResolver[relPath] = { resolve, time: (+new Date()) };
      });

      return isAccepted;
    } else {
      return false;
    }
  }

  async onReceiveTextFileDiff({ relPath, diff, digest }) {
    const fullPath = path.resolve(this.folder, relPath);
    const fileData = await utils.readFile(fullPath);
    const text = fileData.toString();
    const md5 = crypto.createHash('md5');
    this._cache.set(relPath, { text, digest });

    const patched = jsDiff.applyPatch(text, diff);
    let accept = false;

    if (typeof patched === 'string') {
      const patchedData = Buffer.from(patched);
      md5.update(patchedData);
      const localDigest = md5.digest('hex');
      if (localDigest === digest) {
        this.socket.emit('text-file-diff-accept', relPath);
        console.log('[QuantumSync] ' + this.name +  ' accept file changes for: ' + relPath);
        await this.writeFile(fullPath, patchedData); 
        accept = true;     
      }
    }

    if (!accept) {
      console.log('[QuantumSync] ' + this.name +  ' reject file changes for: ' + relPath);
      this.socket.emit('text-file-diff-reject', relPath);
    }
  }

  onRejectTextFileDiff(relPath) {
    if (this._diffResolver[relPath]) {
      this._diffResolver[relPath].resolve(false);

      this._diffResolver[relPath] = null;
    }
  }

  onAcceptTextFileDiff(relPath) {
    if (this._diffResolver[relPath]) {
      this._diffResolver[relPath].resolve(true);

      this._diffResolver[relPath] = null;
    }
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
    if (this._receiptWaitingMap[relPath]) {
      this._receiptWaitingMap[relPath].resolve();
    }
    this._receiptWaitingMap[relPath] = { resolve, time: +(new Date()) };
  }

  checkReceiptWaintingMap() {
    this.checkResolverMap(this._receiptWaitingMap);
  }

  checkDiffResolverMap() {
    this.checkResolverMap(this._diffResolver);
  }

  checkResolverMap(map) {
    const currTime = +(new Date());
    for (let relPath in map) {
      if (map[relPath] && (currTime - map[relPath]) > 1000 * 10) {
        map[relPath].resolve();
        delete map[relPath];
      }
    }
  }
  
  async onData(file) {
    const { name } = file;
    const writePath = path.resolve(this.folder, name);

    if (await utils.exitsResource(writePath)) {
      const existData = await utils.readFile(writePath);
      if (!existData.equals(file.buffer)) {
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
