#!/usr/bin/env node
"use strict";

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

require("babel-core/register");
require("babel-polyfill");

var commander = require('commander');
var pkg = require('../package.json');
var onExit = require('signal-exit');
var path = require('path');
var fs = require('fs');
var Monitor = require('./monitor');
var Client = require('./client');
var Server = require('./server');
var Bundle = require('./bundle');
var utils = require('./utils');

var systemConfig = require('./system-config');

var monitor = void 0,
    client = void 0,
    server = void 0;

commander.version(pkg.version).command('sync').description('Synchronize local folder to remote folder, and verse vice.').option('-f, --folder [localFolder]', 'folder to sync').option('-h, --host [host]', '远程 Quantum server 地址, e.g. 10.111.3.190').option('-p, --port [port]', 'remote port').option('-c, --password [password]', 'password if server required one').action(function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(options) {
    var folder, config, host, port;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            folder = utils.getDefautFolderIfNotExist(options.folder);

            systemConfig.initSystemConfig(folder);
            config = systemConfig.getSystemConfig();
            host = options.host || config.host;
            port = options.port || config.port;
            _context.next = 7;
            return Monitor.watch({ path: folder });

          case 7:
            monitor = _context.sent;

            client = new Client({ host: host, port: port, folder: folder, password: options.password });
            _context.next = 11;
            return client.start();

          case 11:

            connect(monitor, client);

          case 12:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, undefined);
  }));

  return function (_x) {
    return _ref.apply(this, arguments);
  };
}());

commander.command('serve').description('Provide remote service for Quantum synchronization').option('-f, --folder [localFolder]', 'folder to be synced').option('-p, --port [port]', 'exposed port')
// FIXME: remove password option from production build
// only for testing
.option('-c, --password [password]', 'password if server required one').action(function () {
  var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(options) {
    var folder, config, port;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            folder = utils.getDefautFolderIfNotExist(options.folder);

            systemConfig.initSystemConfig(folder);
            config = systemConfig.getSystemConfig();
            port = options.port || config.port;
            _context2.next = 6;
            return Monitor.watch({ path: folder });

          case 6:
            monitor = _context2.sent;

            server = new Server({ port: port, folder: folder, password: options.password });
            _context2.next = 10;
            return server.start();

          case 10:

            connect(monitor, server);

          case 11:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, undefined);
  }));

  return function (_x2) {
    return _ref2.apply(this, arguments);
  };
}());

commander.parse(process.argv);

onExit(function () {
  [monitor, client, server].forEach(function (resource, index) {
    if (resource) {
      resource.terminate();
    }
  });
});

function connect(monitor, vehicle) {
  monitor.listen(function (resp) {
    vehicle.dispatch(Bundle.createStream(resp));
  });
}