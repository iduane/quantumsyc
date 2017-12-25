import { Client } from 'fb-watchman';
import config from './default.config'

const client = new Client();
const channelId = 'quantum-channel';

async function quantum(config, onMessage) {
  try {
    await check();
    const { watch, relative_path } = await watchSource(config.local.path);
    await subscribe(watch, { relative_root: relative_path });
    register(onMessage);

    return {
      end: function() {
        client.end();
      },
      unsubscribe: unsubscribe.bind(this, watch)
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

function register(callback) {
  client.on('subscription', (resp) => {
    if (resp.subscription !== channelId) return;

    callback(resp);
  });
}

export default quantum;
