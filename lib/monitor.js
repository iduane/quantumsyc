'use strict';

var watchProject = function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(userConfig) {
    var config, _ref2, watch, relative_path, watchmanConf;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            config = configuration.getUserConfig(userConfig);
            _context.prev = 1;
            _context.next = 4;
            return check();

          case 4:
            _context.next = 6;
            return watchSource(config.path);

          case 6:
            _ref2 = _context.sent;
            watch = _ref2.watch;
            relative_path = _ref2.relative_path;
            watchmanConf = config.subscribe || {};

            if (relative_path) {
              watchmanConf.relative_root = relative_path;
            }
            _context.next = 13;
            return subscribe(watch, watchmanConf);

          case 13:
            return _context.abrupt('return', {
              terminate: function terminate() {
                return client.end();
              },
              // stop: unsubscribe.bind(this, watch),
              listen: function listen(callback) {
                return register(callback);
              }
            });

          case 16:
            _context.prev = 16;
            _context.t0 = _context['catch'](1);

            console.error('[quantum] runs into error: ' + _context.t0);

          case 19:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[1, 16]]);
  }));

  return function watchProject(_x) {
    return _ref.apply(this, arguments);
  };
}();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var _require = require('fb-watchman'),
    Client = _require.Client;

var deepMerge = require('deepmerge');
var configuration = require('./system-config');

var client = new Client();
var channelId = 'quantum-channel';

function generateCallback(resolve, reject) {
  return function (error, resp) {
    if (error) {
      reject(error);
    } else {
      if ('warning' in resp) {
        console.warn('warning ' + resp.warning);
      }
      resolve(resp);
    }
  };
}

function check() {
  return new Promise(function (resolve, reject) {
    client.capabilityCheck({ optional: [], required: ['relative_root'] }, generateCallback(resolve, reject));
  });
}

function watchSource(dir) {
  return new Promise(function (resolve, reject) {
    client.command(['watch-project', dir], generateCallback(resolve, reject));
  });
}

function subscribe(watch) {
  var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  return new Promise(function (resolve, reject) {
    client.command(['subscribe', watch, channelId, config], generateCallback(resolve, reject));
  });
}

function unsubscribe(watch) {
  return new Promise(function (resolve, reject) {
    client.command(['unsubscribe', watch, channelId], generateCallback(resolve, reject));
  });
}

function shutdown() {
  return new Promise(function (resolve, reject) {
    client.command(['shutdown'], generateCallback(resolve, reject));
  });
}

function register(callback) {
  client.on('subscription', function (resp) {
    if (resp.subscription !== channelId) return;
    if (resp.is_fresh_instance) return;

    callback(resp);
  });
}

module.exports = {
  watch: watchProject
};