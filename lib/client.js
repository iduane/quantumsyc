'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var io = require('socket.io-client');
var dl = require('delivery');
var crypto = require('crypto');
var utils = require('./utils');
var path = require('path');
var fs = require('fs');
var Vehicle = require('./vehicle');
var handshakeSync = require('./handshake-sync');
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

    var _this = _possibleConstructorReturn(this, (Client.__proto__ || Object.getPrototypeOf(Client)).call(this, { name: 'client', host: host, port: port, folder: folder, password: password }));

    _this._handshakeSyncDone = false;
    return _this;
  }

  _createClass(Client, [{
    key: 'start',
    value: function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var host, port, self;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                host = this.host, port = this.port;
                self = this;
                return _context2.abrupt('return', new Promise(function (resolve, reject) {
                  var useSSL = systemConfig.getSystemConfig().useSSL;
                  var url = (useSSL ? 'https://' : 'http://') + host + ':' + port;
                  var socket = io.connect(url, {
                    secure: useSSL,
                    reconnect: true,
                    rejectUnauthorized: false
                    // requestCert: useSSL,
                    // agent: false
                  });
                  console.log('[QuantumSync] connect to ' + url + (useSSL ? ' with SSL' : ''));
                  self.socket = socket;

                  self.waitShakeSync();

                  var isInitConnected = true;

                  socket.on('connect_error', function (e) {
                    isInitConnected = false;
                    console.error('[QuantumSync] client connection fail, ' + e);
                  });
                  socket.on('reconnect', function () {
                    console.log('[QuantumSync] client reconnected');
                  });
                  socket.on('disconnect', function () {
                    self.stub = null;
                    self._handshakeSyncDone = false;
                    self._receiptWaitingMap = {};
                    console.log('[QuantumSync] client disconnected');
                  });
                  socket.on('duplicated-clients', function () {
                    console.log('[QuantumSync] there is already a client connected, so close this session');
                    self.terminate();
                  });
                  socket.on('reconnect_attempt', function (attemptCount) {
                    console.error('[QuantumSync] try ' + attemptCount + ' reconnecting');
                  });
                  self.hook();
                  socket.on('connect', function () {
                    if (isInitConnected) {
                      isInitConnected = false;
                      console.log('[QuantumSync] client connect to server successful');
                    }
                    self.confictResolver.reset();
                    var delivery = dl.listen(socket);
                    delivery.connect();

                    delivery.on('delivery.connect', function (delivery) {
                      self.stub = delivery;
                      self.authorize();
                      delivery.on('receive.success', function () {
                        var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(file) {
                          return regeneratorRuntime.wrap(function _callee$(_context) {
                            while (1) {
                              switch (_context.prev = _context.next) {
                                case 0:
                                  _context.next = 2;
                                  return self.onData(file);

                                case 2:
                                  _context.next = 4;
                                  return self.sendReceipt(file);

                                case 4:
                                case 'end':
                                  return _context.stop();
                              }
                            }
                          }, _callee, this);
                        }));

                        return function (_x) {
                          return _ref3.apply(this, arguments);
                        };
                      }());
                      resolve();
                    });
                  });
                }));

              case 3:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function start() {
        return _ref2.apply(this, arguments);
      }

      return start;
    }()
  }, {
    key: 'authorize',
    value: function authorize() {
      if (systemConfig.getSystemConfig().usePassword) {
        var self = this;
        this.socket.on('auth-accept', function () {
          console.log('[QuantumSync] receive auth successful event');
          self.syncShake();
        });
        this.socket.on('auth-reject', function () {
          console.error('[QuantumSync] receive authorize fail event');
          self.terminate();
        });
        var shasum = crypto.createHash('sha1');
        shasum.update(this.socket.id + (systemConfig.getSystemConfig().secret || '') + this.password);
        this.socket.emit('auth', shasum.digest('hex'));
      } else {
        this.syncShake();
      }
    }
  }, {
    key: 'syncShake',
    value: function () {
      var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var localDigest;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (!(!this._handshakeSyncDone && this._remoteDigest)) {
                  _context3.next = 5;
                  break;
                }

                localDigest = checksum(this.folder);
                _context3.next = 4;
                return handshakeSync(this, localDigest, this._remoteDigest);

              case 4:
                this.socket.emit('client-handshake-done');

              case 5:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function syncShake() {
        return _ref4.apply(this, arguments);
      }

      return syncShake;
    }()
  }, {
    key: 'waitShakeSync',
    value: function waitShakeSync() {
      var _this2 = this;

      this.setBusy(true);

      var self = this;
      this.socket.on('handshake-digest', function () {
        var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(remoteDigest) {
          return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
              switch (_context4.prev = _context4.next) {
                case 0:
                  self._remoteDigest = remoteDigest;

                  if (!self.stub) {
                    _context4.next = 4;
                    break;
                  }

                  _context4.next = 4;
                  return self.syncShake();

                case 4:
                case 'end':
                  return _context4.stop();
              }
            }
          }, _callee4, _this2);
        }));

        return function (_x2) {
          return _ref5.apply(this, arguments);
        };
      }());

      this.socket.on('server-handshake-done', function () {
        var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(remoteDigest) {
          return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
              switch (_context5.prev = _context5.next) {
                case 0:
                  self.setBusy(false);
                  self._handshakeSyncDone = true;
                  self._remoteDigest = null;
                  console.log('[QuantumSync] ' + _this2.name + ' handshake sync end');

                  self.dispatch({});

                case 5:
                case 'end':
                  return _context5.stop();
              }
            }
          }, _callee5, _this2);
        }));

        return function (_x3) {
          return _ref6.apply(this, arguments);
        };
      }());
    }
  }, {
    key: 'setLocalLock',
    value: function setLocalLock() {
      if (this.isBusy() && !this._waitingLock) {
        this.socket.emit('lock-result', false);
      } else {
        this._locked = true;
        this.socket.emit('lock-result', true);
      }
    }
  }, {
    key: 'terminate',
    value: function terminate() {
      if (this.socket) {
        this.socket.close(true);
      }
      process.exit(1);
    }
  }]);

  return Client;
}(Vehicle);