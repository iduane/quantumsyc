const { Client } = require('fb-watchman');
const path = require('path');
const fs = require('graceful-fs');
const crypto = require('crypto');
const ignore = require('ignore');
const utils = require('./utils');
const systemConfig = require('./system-config');
const upath = require('upath');
const { Buffer } = require('buffer');

const client = new Client();
let cache, ig;
const cacheRelPath = '.quantumsync/.checksum-data.json';

function initCache(folderPath) {
  const cachePath = path.resolve(folderPath, cacheRelPath);
  if (fs.existsSync(cachePath)) {
    cache = require(cachePath);
  } else {
    cache = {};
  }
}

async function persistCache(folderPath) {
  const cachePath = path.resolve(folderPath, cacheRelPath);
  await utils.mkdirP(path.dirname(cachePath));
  await utils.writeFile(cachePath, Buffer.from(JSON.stringify(cache || {})))
}

const walk = async function(folderPath) {
  let getQueryResult, onQueryError, watchedFolder;
  const query = new Promise((resolve, reject) => {
    getQueryResult = resolve;
    onQueryError = reject;
  });

  client.command(['watch-project', folderPath], (error, resp) => {
    if (error) {
      onQueryError(error);
      client.end();
      return;
    }
    watchedFolder = resp.watch || folderPath;
    const queryOptions = {
      fields: ['name', 'type', 'mtime_ms']
    };
    if (resp.relative_path) {
      queryOptions.path = [resp.relative_path];
    }
    client.command(['query', watchedFolder, queryOptions], (error, resp) => {
      if (error) {
        onQueryError(error);
        client.end();
        return;
      }
      getQueryResult(resp);
    });
  });
 

  const queryReuslt = await query;
  client.end();
  const resouceMap = {};
  
  await Promise.all(queryReuslt.files.map(async ({name, type, mtime_ms}) => {
    const fullPath = path.resolve(watchedFolder, name);
    if (watchedFolder !== folderPath) {
      name = path.relative(folderPath, fullPath);
    }
    const relativePath = upath.normalize(name);
    const ignored = ig.ignores(relativePath);

    if (!ignored && relativePath !== '' && relativePath !== '.') {
      if (type === 'f') {
        if (cache[relativePath] && cache[relativePath].mtime === mtime_ms) {
          resouceMap[relativePath] = cache[relativePath];
        } else {
          const md5 = crypto.createHash('md5');
          const fileData = await utils.readFile(fullPath);
          md5.update(fileData);
          cache[relativePath] = resouceMap[relativePath] = {
            isFile: true,
            digest: md5.digest('hex'),
            mtime: mtime_ms,
          };
        }
      } else if (type === 'd') {
        resouceMap[relativePath] = {
          isFolder: true,
          mtime: mtime_ms,
        };
      }
    }
  }));

  return resouceMap;
}

module.exports = async (folderPath) => {
  initCache(folderPath);
  ig = ignore().add(systemConfig.getSystemConfig().ignores);
  const digest = await walk(folderPath);
  await persistCache(folderPath);

  return digest;
};
