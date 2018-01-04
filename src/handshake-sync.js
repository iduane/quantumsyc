const { setTimeout } = require('timers');
const systemConfig = require('./system-config');
const path = require('path');

function travese(digest, callback) {
  for (let fullPath in digest) {
    if (digest.hasOwnProperty(fullPath)) {
      callback(fullPath, digest[fullPath]);
    }
  }
}

function getLastestDigestTime(digest) {
  let latestTime = 0;
  travese(digest, function(key, value) {
    const currTime = value.mtime;
    if (currTime && currTime > latestTime) {
      latestTime = currTime;
    }
  })

  return latestTime;
}

function compareDigest(localDigest, remoteDigest, watchFolder) {
  let diff = {}, push = [], pull = [], rmLocal = [], rmRemote = [];

  const syncRules = systemConfig.getSystemConfig().syncRules;

  const digestTime1 = getLastestDigestTime(localDigest);
  const digestTime2 = getLastestDigestTime(remoteDigest);

  travese(localDigest, function(localPath1, value1) {
    if (remoteDigest[localPath1]) {
      if (value1.isFile && (!value1.digest || remoteDigest[localPath1].digest !== value1.digest)) {
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
        })
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

  travese(remoteDigest, function(localPath2, value2) {
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
        })
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
    push, pull, rmLocal, rmRemote
  };
}

function checkDeadWaiting(vehicle, timeoutThreshold, resolve, reject) {
  setTimeout(() => {
    if (!vehicle.lastestChangeTime) {
      reject();
    } else {
      if ((vehicle.lastestChangeTime - (new Date().getTime)) > timeoutThreshold) {
        reject();
      } else {
        checkDeadWaiting(vehicle, timeoutThreshold, resolve, reject);
      }
    }
  }, timeoutThreshold);
}

module.exports = async function(vehicle, localDigest, remoteDigest) {
  const { push, pull, rmLocal, rmRemote } = compareDigest(localDigest, remoteDigest, vehicle.folder);
  try {
    await vehicle.sendChanges(vehicle.socket, vehicle.stub, push.concat(rmRemote), vehicle.folder);
  } catch (e) {
    console.error("[QuantumSync] got exception when sync handshake push changes, "+ e);
  }

  rmLocal.forEach((localPath) => {
    vehicle.onDelete(localPath);
  });
  const timeoutThreshold = systemConfig.getSystemConfig().timeout;
  await new Promise((resolve, reject) => {
    if (vehicle.socket) {
      vehicle.socket.on('pull-changes-done', resolve);
      vehicle.socket.emit('pull-changes', pull);
    }

    checkDeadWaiting(vehicle, timeoutThreshold, resolve, reject);
  })
}
