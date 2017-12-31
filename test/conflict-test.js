const { setTimeout } = require('timers');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const utils = require('../src/utils');
const { spawn } = require('child_process');
const commandPath = path.resolve(__dirname, '../src/index.js');

const testFolder = path.join(__dirname, 'conflict-test');
const clientFolder = path.join(__dirname, 'conflict-test', 'local');
const serverFolder = path.join(__dirname, 'conflict-test', 'server');

function onData(data) {
  console.log(data.toString());
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [
      commandPath, 'serve', '--folder', serverFolder, '--password', '0AxMWhxBeM']);
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    setTimeout(() => {
      resolve(server);
    }, 0);
  })
}

function startClient(logger = () => {}) {
  return new Promise((resolve, reject) => {
    const client = spawn('node', [
      commandPath, 'sync', '--folder', clientFolder, '--password', '0AxMWhxBeM']);
    const loggerCB = (data) => {
      onData(data);
      logger(data);
    };
    client.stdout.on('data', loggerCB);
    client.stderr.on('data', loggerCB);
    setTimeout(() => {
      resolve(client);
    }, 2000);
  })
}

function kill(task) {
  try {
    task.kill('SIGKILL');
  } catch (e) {}
}

describe('Conflict', function() {
  this.timeout(10000);

  let client, server;
  before(() => {
    rimraf.sync(testFolder);
    fs.mkdirSync(testFolder);
  })

  after(() => {
    rimraf.sync(testFolder);
  })

  beforeEach(async () => {
    fs.mkdirSync(clientFolder);
    fs.mkdirSync(serverFolder);

    server = await startServer();
    client = await startClient();
  })

  afterEach(async () => {
    rimraf.sync(clientFolder);
    rimraf.sync(serverFolder);

    kill(client);
    kill(server);
    await utils.sleep(1000);
  });

  it ('should handle quick changes', async () => {
    let size = 1000;
    while (size--) {
      process.nextTick(((size) => {
        return () => {
          if (Math.random() > 0.5) {
            fs.writeFile(path.resolve(clientFolder, 'a.txt'), size, () => {});
          } else {
            fs.writeFile(path.resolve(serverFolder, 'a.txt'), size, () => {});
          }
        }
      })(size));
    }
    await utils.sleep(1000);
    let clientContent = fs.readFileSync(path.resolve(clientFolder, 'a.txt')).toString();
    let serverContent = fs.readFileSync(path.resolve(serverFolder, 'a.txt')).toString();

    expect(clientContent).to.eq(serverContent);
  });

  it ('should hanle two way conflict', async () => {
    let size = 100, clientContent, serverContent,
      lastClientOp, lastServerOp, lastValue = 0, lastOp;
    for (let i = 0; i < size; i++) {
      if (Math.random() > 0.75) {
        fs.writeFileSync(path.resolve(clientFolder, 'b.txt'), size);
        lastOp = lastClientOp = 'change';
        lastValue = i;
      } else if (Math.random() > 0.5) {
        fs.writeFileSync(path.resolve(serverFolder, 'b.txt'), size);
        lastOp = lastServerOp = 'change';
        lastValue = i;
      } else if (Math.random() > 0.25) {
        if (fs.existsSync(path.resolve(clientFolder, 'b.txt'))) {
          fs.unlinkSync(path.resolve(clientFolder, 'b.txt'));
        }
        lastOp = lastClientOp = 'delete';
      } else {
        if (fs.existsSync(path.resolve(serverFolder, 'b.txt'))) {
          fs.unlinkSync(path.resolve(serverFolder, 'b.txt'));
        }
        lastOp= lastServerOp = 'delete'
      }
      await utils.sleep(100);
    }
    await utils.sleep(1000);
    if (lastOp === 'change') {
      clientContent = fs.readFileSync(path.resolve(clientFolder, 'b.txt')).toString();
      serverContent = fs.readFileSync(path.resolve(serverFolder, 'b.txt')).toString();
      expect(clientContent).to.eq(serverContent);
    } else {
      expect(fs.existsSync(path.resolve(clientFolder, 'b.txt'))).to.false;
      expect(fs.existsSync(path.resolve(serverFolder, 'b.txt'))).to.false;
    }
  }).timeout(20000);
});
