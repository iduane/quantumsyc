const { Buffer } = require('buffer');
const { setTimeout } = require('timers');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const { spawn } = require('child_process');
const { expect } = require('chai');
const utils = require('../src/utils');
const commandPath = path.resolve(__dirname, '../src/index.js');
const testFolder = path.join(__dirname, 'temp/command-line');
const clientFolder = path.join(__dirname, 'temp/command-line', 'local');
const serverFolder = path.join(__dirname, 'temp/command-line', 'server');

let server, client;

function onData(name) {
  return (data) => console.log(name + ':' + data.toString());
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [
      commandPath, 'serve', '--folder', serverFolder, '--password', '0AxMWhxBeM']);
    server.stdout.on('data', onData('server'));
    server.stderr.on('data', onData('server'));
    setTimeout(() => {
      resolve(server);
    }, 1000);
  })
}

function startClient(logger = () => {}) {
  return new Promise((resolve, reject) => {
    const client = spawn('node', [
      commandPath, 'sync', '--folder', clientFolder, '--password', '0AxMWhxBeM']);
    const loggerCB = (data) => {
      onData('client')(data);
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
    task.kill('SIGINT');
  } catch (e) {}
}

describe('Command Line', () => {
  beforeEach(() => {
    rimraf.sync(testFolder);
    mkdirp.sync(path.resolve(testFolder))

    fs.mkdirSync(clientFolder);
    fs.mkdirSync(serverFolder);
  })
  
  afterEach(async () => {
    rimraf.sync(testFolder);
    if (server) {
      kill(server);
      kill(client);
    }
    await utils.sleep(500);
  })

  it ('should sync local file to remote file', async () => {
    server = await startServer();
    client = await startClient();
    fs.writeFileSync(path.join(clientFolder, 'a.txt'), '123');
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(serverFolder, 'a.txt'))).to.true;
  }).timeout(10000);

  it ('should sync increment changes', async () => {
    server = await startServer();
    client = await startClient();
    let log;
    client.stdout.on('data', (data) => {
      log += data.toString();
    });
    server.stdout.on('data', (data) => {
      log += data.toString();
    });
    const size = 1024;
    let list = [];
    for (let i = 0; i < size; i++) {
      list.push('12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890');
    }
    const arr = new Uint16Array(1024 / 2);
    fs.writeFileSync(path.join(clientFolder, 'a.txt'), list.join(''));
    await utils.sleep(1000);
    list.push('12345');
    const result = list.join('');
    fs.writeFileSync(path.join(clientFolder, 'a.txt'), result);
    await utils.sleep(3000);
    expect(fs.readFileSync(path.join(serverFolder, 'a.txt')).toString()).to.eq(result);
    expect(log.indexOf('accept file changes')).to.gte(0);
  }).timeout(10000);

  it ('should sync remote file to local file', async () => {
    server = await startServer();
    client = await startClient();
    fs.writeFileSync(path.join(serverFolder, 'b.txt'), '123');
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'b.txt'))).to.true;
  }).timeout(10000);

  it ('should sync local folder to remote folder', async () => {
    server = await startServer();
    client = await startClient();
    fs.mkdirSync(path.join(clientFolder, 'abc'));
    fs.mkdirSync(path.join(clientFolder, 'abc/def'));
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(serverFolder, 'abc/def'))).to.true;
  }).timeout(10000);

  it ('should sync remote folder to local folder', async () => {
    server = await startServer();
    client = await startClient();
    fs.mkdirSync(path.join(serverFolder, 'abc2'));
    fs.mkdirSync(path.join(serverFolder, 'abc2/def2'));
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'abc2/def2'))).to.true;
  }).timeout(10000);

  it ('should sync folder deletion', async () => {
    server = await startServer();
    client = await startClient();
    await utils.addFolderP(path.join(serverFolder, 'xxx/a/b/c/d/e'));
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'xxx/a/b/c/d/e'))).to.true;

    await utils.deleteFolderP(path.join(serverFolder, 'xxx'));
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'xxx'))).to.false;
  }).timeout(10000);

  it ('should re-connnect server if server stop after client connected', async () => {
    server = await startServer();
    client = await startClient();
    kill(server);
    await utils.sleep(200);
    let reconnectData;
    client.stdout.on('data', (data) => {
      reconnectData += data.toString();
    });
    server = await startServer();
    await utils.sleep(4000);
    expect(reconnectData).to.exist;
    expect(reconnectData.indexOf('reconnected')).to.gt(0);
  }).timeout(10000);

  it ('should only allow one client per one server', async () => {
    let server = await startServer();
    client = await startClient();
    const client2 = await startClient();
    await utils.sleep(500);

    const exitCode = client2.exitCode;
    
    kill(client2);
    expect(exitCode).to.exist;
  }).timeout(10000);

  it ('should skip ignore file', async () => {
    server = await startServer();
    client = await startClient();
    fs.mkdirSync(path.join(serverFolder, '.git'));
    fs.writeFileSync(path.join(serverFolder, '.git/ignore.txt'), '123');
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, '.git/ignore.txt'))).to.false;
  }).timeout(10000);

  it ('should two way sync files on client connected', async () => {
    fs.writeFileSync(path.join(clientFolder, 'a.txt'), '123');
    fs.writeFileSync(path.join(serverFolder, 'b.txt'), '123');
    server = await startServer();
    client = await startClient();
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'a.txt'))).to.true;
    expect(fs.existsSync(path.join(serverFolder, 'a.txt'))).to.true;
  }).timeout(10000);

  it ('should load local config file', async () => {
    const port = Math.round(Math.random() * 10000);
    fs.mkdirSync(path.join(clientFolder, '.quantumsync'));
    fs.writeFileSync(path.join(clientFolder, '.quantumsync/quantumsync.config.json'), `{"port": ${port}}`);
    let logs = '';
    const client = await startClient((data) => {
      logs += data.toString();
    });
    await utils.sleep(1000);
    kill(client);
    expect(logs.indexOf('' + port)).to.gt(-1);
  }).timeout(10000);
})
