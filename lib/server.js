'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var io = require('socket.io');
var https = require('https');
var dl = require('delivery');
var crypto = require('crypto');
var utils = require('./utils');
var fs = require('fs');
var path = require('path');
var generator = require('generate-password');
var Vehicle = require('./vehicle');
var checksum = require('./checksum');
var systemConfig = require('./system-config');

module.exports = function (_Vehicle) {
  _inherits(Client, _Vehicle);

  function Client(_ref) {
    var host = _ref.host,
        port = _ref.port,
        folder = _ref.folder,
        password = _ref.password;

    _classCallCheck(this, Client);

    return _possibleConstructorReturn(this, (Client.__proto__ || Object.getPrototypeOf(Client)).call(this, { name: 'server', host: host, port: port, folder: folder, password: password }));
  }

  _createClass(Client, [{
    key: 'start',
    value: function start() {
      var _this2 = this;

      var self = this;
      return new Promise(function (resolve, reject) {
        var usePassword = systemConfig.getSystemConfig().usePassword;
        var password = usePassword ? _this2.password ? _this2.password : generator.generate({
          length: 10,
          numbers: true
        }) : '';
        var useSSL = systemConfig.getSystemConfig().useSSL;
        var listener = void 0;
        if (useSSL) {
          var app = https.createServer(systemConfig.getSystemConfig().sslOptions);
          listener = io(app);
          app.listen(_this2.port);
        } else {
          listener = io.listen(_this2.port);
        }

        console.log('[QuantumSync] server started, listen port: ' + _this2.port + (useSSL ? ', with SSL' : '') + (usePassword ? ', use password: ' + password : ''));
        listener.sockets.on('connection', function (socket) {
          if (self.stub) {
            // only allow one alive client
            socket.emit('duplicated-clients');
            socket.disconnect(true);
            console.log('[QuantumSync] close connect since there is a exiting client connected.');
            return;
          }
          self.socket = socket;
          self.confictResolver.reset();
          var delivery = dl.listen(socket);
          socket.on('disconnect', function (reason) {
            self.stub = null;
            self.socket = null;
            console.log('[QuantumSync] client disconnect, reason: ' + reason);
          });
          socket.on('error', function (e) {
            console.error('[QuantumSync] client meet eror' + e);
          });
          _this2.setBusy(true);
          self.checkCredential(password);
          self.hook();
          delivery.on('delivery.connect', function (delivery) {
            self.stub = delivery;
            delivery.on('receive.success', function () {
              var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(file, extraParams) {
                return regeneratorRuntime.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        _context.next = 2;
                        return self.onData(file);

                      case 2:
                        _context.next = 4;
                        return self.sendReceipt(file, extraParams);

                      case 4:
                      case 'end':
                        return _context.stop();
                    }
                  }
                }, _callee, this);
              }));

              return function (_x, _x2) {
                return _ref2.apply(this, arguments);
              };
            }());
          });
        });
        resolve();
      });
    }
  }, {
    key: 'checkCredential',
    value: function checkCredential(password) {
      if (systemConfig.getSystemConfig().usePassword) {
        var self = this;
        this.socket.on('auth', function (credential) {
          var shasum = crypto.createHash('sha1');
          shasum.update(self.socket.id + (systemConfig.getSystemConfig().secret || '') + password);
          if (credential === shasum.digest('hex')) {
            self.socket.emit('auth-accept');
            console.log('[QuantumSync] accept client auth request');
            self.handeShakeSync();
          } else {
            self.socket.emit('auth-reject');
            self.socket.disconnect(true);
            self.socket = null;
            self.stub = null;
            self._receiptWaitingMap = {};
            console.error('[QuantumSync] reject client auth request');
          }
        });
      } else {
        this.handeShakeSync();
      }
    }
  }, {
    key: 'handeShakeSync',
    value: function handeShakeSync() {
      var _this3 = this;

      var self = this;
      this.socket.on('client-handshake-done', function () {
        self.setBusy(false);
        self.socket.emit('server-handshake-done');
        self.dispatch({});
        console.log('[QuantumSync] ' + _this3.name + ' handshake sync end');
      });
      this.socket.on('pull-changes', function () {
        var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(changes) {
          return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  _context2.prev = 0;
                  _context2.next = 3;
                  return self.sendChanges(self.socket, self.stub, changes, self.folder);

                case 3:
                  self.socket.emit('pull-changes-done');
                  _context2.next = 9;
                  break;

                case 6:
                  _context2.prev = 6;
                  _context2.t0 = _context2['catch'](0);

                  console.error("[QuantumSync] got exception when sync pull changes, " + _context2.t0);

                case 9:
                case 'end':
                  return _context2.stop();
              }
            }
          }, _callee2, _this3, [[0, 6]]);
        }));

        return function (_x3) {
          return _ref3.apply(this, arguments);
        };
      }());
      try {
        console.log('[QuantumSync] handshake sync start');
        this.socket.emit('handshake-digest', checksum(this.folder));
      } catch (e) {
        console.error('[QuantumSync] handshake sync meet eror' + e);
        this.setBusy(false);
      }
    }
  }]);

  return Client;
}(Vehicle);