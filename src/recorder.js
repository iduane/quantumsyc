const { setTimeout, clearTimeout, setInterval } = require('timers');
const Vehicle = require('./vehicle');

const debounce = (func, interval, timerId) => {
  clearTimeout(timerId);

  return setTimeout(func, interval);
}

const loopCheck = (func, interval, timerId) => {
  return debounce(function() {
    func();
    loopCheck(func, interval, timerId);
  }, Math.round(interval * (1 + Math.random()))), timerId;
}

const mergeDiff = (queue, incommingResp) => {
  const files = incommingResp.files || [];

  return files.reduce((queue, descriptor) => {
    const path = descriptor.name;
    let op = 'change';
    if (descriptor.exists) {
      if (descriptor.new) {
        op = 'new';
      }
    } else {
      op = 'delete';
    }
    queue[path] = queue[path] || {};
    queue[path].op = op;
    return queue;
  }, queue);
}

const packageChanges = (remoteQueue, localQueue) => {
  return [];
}

module.exports = class Recorder {
  constructor(config) {
    this.config = config;
    this.timerId = null;
    this.waitingQueue = {};
    this.handlingQueue = {};
    this.vehicle = new Vehicle(config);
    this.listener = this.listener.bind(this);
    this.dispatch = this.dispatch.bind(this);

    this.timerId = loopCheck(this.dispatch, this.config.sync.interval, this.timerId);
  }

  dispatch() {
    if (this.vehicle.isBusy) {
      this.timerId = debounce(this.dispatch, this.config.sync.interval, this.timerId);
    } else {
      this.handlingQueue = this.waitingQueue;
      this.waitingQueue = {};
      (async () => {
        this.vehicle.setBusy(true);
        const remoteQeueue = await fetchRemoteRecorder();
        await this.vehicle.sync(packageChanges(remoteQeueue, this.handlingQueue));
        this.handlingQueue = {};
        this.vehicle.setBusy(false);
      })();
    }
  }

  listener(resp) {
    this.timerId = debounce(this.dispatch, this.config.sync.interval, this.timerId);
    this.waitingQueue = mergeDiff(this.waitingQueue, resp);
  }

  async fetchRemoteRecorder() {
    return [];
  }
}
