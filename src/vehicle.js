module.exports = class Vehicle {
  constructor(config) {
    this.config = config;
    this.isBusy = false;
  }

  setBusy(isBusy) {
    this.isBusy = isBusy === true;
  }

  async sync(queue) {

  }
};
