const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const { setTimeout } = require('timers');

module.exports = {
  mergeChanges(map, increment) {
    let merged = {}, key;
    [map, increment].forEach((obj) => {
      for (key in obj) {
        if (obj.hasOwnProperty(key)) {
          merged[key] = obj[key];
        }
      }
    })
    
    return merged;
  },

  toList(changeMap) {
    let list = [];

    for (let key in changeMap) {
      let obj = { name: key };
      for (let mapKey in changeMap[key]) {
        obj[mapKey] = changeMap[key][mapKey];
      }
      list.push(obj);
    }

    return list;
  },

  mkdirP(dir) {
    let dirs = [];
    let currDir = dir;
    while (!fs.existsSync(currDir)) {
      dirs.push(currDir);
      currDir = path.dirname(currDir);
    }
    dirs = dirs.reverse();
    dirs.forEach((dir) => {
      fs.mkdirSync(dir);
    })
    return dirs;
  },

  sleep(durationInMs) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, durationInMs);
    })
  },

  mergeMap(map1, map2) {
    map1 = map1 || {};
    map2 = map2 || {};

    const result = {};
    let key;
    [map1, map2].forEach((m) => {
      for (key in m) {
        if (m.hasOwnProperty(key)) {
          result[key] = m[key];
        }
      }
    })
    
    return result;
  },

  getDefautFolderIfNotExist(folder) {
    if (folder) {
      folder = path.resolve(folder);
      if (fs.existsSync(folder)) {
        return folder
      } else {
        return path.resolve(process.cwd());
      }
    } else {
      return path.resolve(process.cwd());
    }
  },

  getFullPathIfRelativePath(filePath, watchFolder) {
    if (filePath) {
      if (!fs.existsSync(filePath)) {
        filePath = path.resolve(watchFolder, filePath);
      }
    }
    return filePath;
  },

  async writeFile(fullPath, buffer) {
    await this.addFolderP(path.dirname(fullPath));
    await new Promise((resolve, reject) => {
      fs.writeFile(fullPath, buffer, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }); 
  },

  deleteFile(fullPath) {
    return new Promise((resolve, reject) => {
      fs.unlink(fullPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  readFile(fullPath) {
    return new Promise((resolve, reject) => {
      fs.readFile(fullPath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  },

  exitsResource(fullPath) {
    return new Promise((resolve) => {
      fs.exists(fullPath, (exists) => {
        resolve(exists);
      });
    });
  },

  addFolder(fullPath) {
    return new Promise((resolve, reject) => {
      fs.mkdir(fullPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  async addFolderP(fullPath) {
    let dirs = [];
    let currDir = fullPath;
    while (!await this.exitsResource(currDir)) {
      dirs.push(currDir);
      currDir = path.dirname(currDir);
    }
    dirs = dirs.reverse();

    for (let i = 0; i < dirs.length; i++) {
      try {
        await this.addFolder(dirs[i]);
      } catch (e) {
        // the folder may be created by other request
      }
    }
    
    return dirs;
  },

  deleteFolder(fullPath) {
    return new Promise((resolve, reject) => {
      fs.rmdir(fullPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }); 
  },

  deleteFolderP(fullPath) {
    return new Promise((resolve, reject) => {
      rimraf(fullPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }); 
  },

  lstatResource(fullPath) {
    return new Promise((resolve, reject) => {
      fs.lstat(fullPath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
}
