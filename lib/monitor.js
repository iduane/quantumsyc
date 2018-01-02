'use strict';

let watchProject = (() => {
  var _ref = _asyncToGenerator(function* (userConfig) {
    const config = configuration.getUserConfig(userConfig);
    try {
      yield check();

      var _ref2 = yield watchSource(config.path);

      const watch = _ref2.watch,
            relative_path = _ref2.relative_path;


      let watchmanConf = config.subscribe || {};
      if (relative_path) {
        watchmanConf.relative_root = relative_path;
      }
      yield subscribe(watch, watchmanConf);
      return {
        terminate: function terminate() {
          return client.end();
        },
        // stop: unsubscribe.bind(this, watch),
        listen: function listen(callback) {
          return register(callback);
        }
      };
    } catch (error) {
      console.error(`[quantum] runs into error: ${error}`);
    }
  });

  return function watchProject(_x) {
    return _ref.apply(this, arguments);
  };
})();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var _require = require('fb-watchman');

const Client = _require.Client;

const deepMerge = require('deepmerge');
const configuration = require('./system-config');

const client = new Client();
const channelId = 'quantum-channel';

function generateCallback(resolve, reject) {
  return (error, resp) => {
    if (error) {
      reject(error);
    } else {
      if ('warning' in resp) {
        console.warn(`warning ${resp.warning}`);
      }
      resolve(resp);
    }
  };
}

function check() {
  return new Promise((resolve, reject) => {
    client.capabilityCheck({ optional: [], required: ['relative_root'] }, generateCallback(resolve, reject));
  });
}

function watchSource(dir) {
  return new Promise((resolve, reject) => {
    client.command(['watch-project', dir], generateCallback(resolve, reject));
  });
}

function subscribe(watch, config = {}) {
  return new Promise((resolve, reject) => {
    client.command(['subscribe', watch, channelId, config], generateCallback(resolve, reject));
  });
}

function unsubscribe(watch) {
  return new Promise((resolve, reject) => {
    client.command(['unsubscribe', watch, channelId], generateCallback(resolve, reject));
  });
}

function shutdown() {
  return new Promise((resolve, reject) => {
    client.command(['shutdown'], generateCallback(resolve, reject));
  });
}

function register(callback) {
  client.on('subscription', resp => {
    if (resp.subscription !== channelId) return;
    if (resp.is_fresh_instance) return;

    callback(resp);
  });
}

module.exports = {
  watch: watchProject
};