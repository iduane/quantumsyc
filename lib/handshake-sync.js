'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var _require = require('timers'),
    setTimeout = _require.setTimeout;

var systemConfig = require('./system-config');
var path = require('path');

function travese(digest, callback) {
  for (var fullPath in digest) {
    if (digest.hasOwnProperty(fullPath)) {
      callback(fullPath, digest[fullPath]);
    }
  }
}

function getLastestDigestTime(digest) {
  var latestTime = 0;
  travese(digest, function (key, value) {
    var currTime = value.mtime;
    if (currTime && currTime > latestTime) {
      latestTime = currTime;
    }
  });

  return latestTime;
}

function compareDigest(localDigest, remoteDigest, watchFolder) {
  var diff = {},
      push = [],
      pull = [],
      rmLocal = [],
      rmRemote = [];

  var syncRules = systemConfig.getSystemConfig().syncRules;

  var digestTime1 = getLastestDigestTime(localDigest);
  var digestTime2 = getLastestDigestTime(remoteDigest);

  travese(localDigest, function (localPath1, value1) {
    if (remoteDigest[localPath1]) {
      if (!value1.digest || remoteDigest[localPath1].digest !== value1.digest) {
        if (syncRules.sameFileConfict === 'checkModifyTime') {
          if (value1.mtime > remoteDigest[localPath1].mtime) {
            push.push({
              name: localPath1,
              op: 'change'
            });
          } else {
            pull.push({
              name: localPath1,
              op: 'change'
            });
          }
        } else if (syncRules.sameFileConfict === 'useServer') {
          pull.push({
            name: localPath1,
            op: 'change'
          });
        } else if (syncRules.sameFileConfict === 'useClient') {
          push.push({
            name: localPath1,
            op: 'change'
          });
        }
      }
    } else {
      if (syncRules.fileMissingOnSever === 'uploadToServer') {
        push.push({
          name: localPath1,
          op: 'change'
        });
      } else if (syncRules.fileMissingOnSever === 'deleteLocal') {
        rmLocal.push({
          name: localPath1,
          op: 'delete'
        });
      }
      // // check project last modify time
      // if (digestTime1 > digestTime2) {
      //   rmRemote.push({
      //     name: localPath1,
      //     op: 'delete'
      //   });
      // } else {
      //   rmLocal.push({
      //     name: localPath1,
      //     op: 'delete'
      //   });
      // }
    }
  });

  travese(remoteDigest, function (localPath2, value2) {
    if (!localDigest[localPath2]) {
      if (syncRules.fileMissingOnClient === 'downloadToLocal') {
        pull.push({
          name: localPath2,
          op: 'change'
        });
      } else if (syncRules.fileMissingOnClient === 'deleteServer') {
        rmRemote.push({
          name: localPath2,
          op: 'delete'
        });
      }
      // // check project last modify time
      // if (digestTime1 > digestTime2) {
      //   rmRemote.push({
      //     name: localPath2,
      //     op: 'delete'
      //   });
      // } else {
      //   rmLocal.push({
      //     name: localPath2,
      //     op: 'delete'
      //   });
      // }
    }
  });

  return {
    push: push, pull: pull, rmLocal: rmLocal, rmRemote: rmRemote
  };
}

module.exports = function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(vehicle, localDigest, remoteDigest) {
    var _compareDigest, push, pull, rmLocal, rmRemote;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _compareDigest = compareDigest(localDigest, remoteDigest, vehicle.folder), push = _compareDigest.push, pull = _compareDigest.pull, rmLocal = _compareDigest.rmLocal, rmRemote = _compareDigest.rmRemote;
            _context.prev = 1;
            _context.next = 4;
            return vehicle.sendChanges(vehicle.socket, vehicle.stub, push.concat(rmRemote), vehicle.folder);

          case 4:
            _context.next = 9;
            break;

          case 6:
            _context.prev = 6;
            _context.t0 = _context['catch'](1);

            console.error("[QuantumSync] got exception when sync handshake push changes, " + _context.t0);

          case 9:

            rmLocal.forEach(function (localPath) {
              vehicle.onDelete(localPath);
            });
            _context.next = 12;
            return new Promise(function (resolve, reject) {
              vehicle.socket.on('pull-changes-done', resolve);
              vehicle.socket.emit('pull-changes', pull);
              setTimeout(reject, systemConfig.getSystemConfig().timeout);
            });

          case 12:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[1, 6]]);
  }));

  return function (_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
}();