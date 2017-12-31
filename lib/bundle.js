'use strict';

var systemConfig = require('./system-config');
var ignore = require('ignore');

module.exports = {
  createStream: function createStream(resp) {
    var ig = ignore().add(systemConfig.getSystemConfig().ignores);
    var files = resp.files;

    var clock = resp.clock;
    return files.filter(function (descriptor) {
      return !ig.ignores(descriptor.name);
    }).reduce(function (changes, descriptor) {
      var path = descriptor.name;
      var op = 'change';
      if (descriptor.exists) {
        if (descriptor.new) {
          op = 'new';
        }
      } else {
        op = 'delete';
      }

      changes[path] = { op: op, clock: clock };
      return changes;
    }, {});
    // FIXME: order changes by folder sequence, add folder first, and delete folder later that its children
  }
};