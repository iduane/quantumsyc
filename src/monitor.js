const { Client } = require('fb-watchman');
const deepMerge = require('deepmerge');
const configuration = require('./system-config');

const client = new Client();
const channelId = 'quantum-channel';

async function watchProject(userConfig) {
  const config = configuration.getUserConfig(userConfig);
  try {
    await check();
    const { watch, relative_path } = await watchSource(config.path);
    
    let watchmanConf = config.subscribe || {};
    if (relative_path) {
      watchmanConf.relative_root = relative_path;
    }
    await subscribe(watch, watchmanConf);
    return {
      terminate: () => client.end(),
      // stop: unsubscribe.bind(this, watch),
      listen: (callback) => register(callback)
    };
  } catch (error) {
    console.error(`[quantum] runs into error: ${error}`);
  }
}

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
    client.capabilityCheck({ optional: [], required: ['relative_root'] },
      generateCallback(resolve, reject));
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
  client.on('subscription', (resp) => {
    if (resp.subscription !== channelId) return;
    if (resp.is_fresh_instance) return;

    callback(resp);
  });
}

module.exports = {
  watch: watchProject
};
