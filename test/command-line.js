const { Buffer } = require('buffer');
const { setTimeout, clearInterval } = require('timers');
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

let server, client, log = '', sPid, cPid;

function onData(name, pid) {
  return (data) => {
    log += data;
    console.log(name + '(' + pid + '):' + data.toString())
  };
}

function isClientConnected() {
  let resolve;
  const intId = setInterval(() => {
    if (log.split('handshake sync end').length >= 3) {
      if (resolve) resolve();
      clearInterval(intId);
    }
  }, 200);
  return new Promise((r) => resolve = r);
}

function startClientAndServer(logger = () => {}) {
  return Promise.all([startServer(logger), startClient(logger), isClientConnected()]);
}

function startServer(logger = () => {}) {
  return new Promise((resolve, reject) => {
    server = spawn('node', [
      commandPath, 'serve', '--folder', serverFolder, '--password', '0AxMWhxBeM']);
    const loggerCB = (data) => {
      if (server) sPid = server.pid;
      onData('client', sPid)(data);
      logger(data);
    };
    server.stdout.on('data', loggerCB);
    server.stderr.on('data', loggerCB);
    resolve(server);
  })
}

function startClient(logger = () => {}) {
  return new Promise((resolve, reject) => {
    client = spawn('node', [
      commandPath, 'sync', '--folder', clientFolder, '--password', '0AxMWhxBeM']);
    const loggerCB = (data) => {
      if (client) cPid = client.pid;
      onData('client', cPid)(data);
      logger(data);
    };
    client.stdout.on('data', loggerCB);
    client.stderr.on('data', loggerCB);
    resolve(client);
  })
}

function kill(task) {
  try {
    task.kill('SIGINT');
  } catch (e) {}
}

describe('Command Line', () => {
  beforeEach(() => {
    log = '';
    sPid = '';
    cPid = '';
    rimraf.sync(testFolder);
    mkdirp.sync(path.resolve(testFolder))

    fs.mkdirSync(clientFolder);
    fs.mkdirSync(serverFolder);
  })
  
  afterEach(async () => {
    log = '';
    sPid = '';
    cPid = '';
    if (server) {
      kill(server);
      // server = null;
    }
    if (client) {
      kill(client);
      // client = null;
    }
    rimraf.sync(testFolder);

    await utils.sleep(1000);
  })

  it ('should sync local file to remote file', async () => {
    await startClientAndServer();
    fs.writeFileSync(path.join(clientFolder, 'a.txt'), '123');
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(serverFolder, 'a.txt'))).to.true;
  }).timeout(10000);

  it ('should sync increment changes', async () => {
    await startClientAndServer();
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
    await startClientAndServer();
    fs.writeFileSync(path.join(serverFolder, 'b.txt'), '123');
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'b.txt'))).to.true;
  }).timeout(10000);

  it ('should sync local folder to remote folder', async () => {
    await startClientAndServer();
    fs.mkdirSync(path.join(clientFolder, 'abc'));
    fs.mkdirSync(path.join(clientFolder, 'abc/def'));
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(serverFolder, 'abc/def'))).to.true;
  }).timeout(10000);

  it ('should sync remote folder to local folder', async () => {
    await startClientAndServer();
    fs.mkdirSync(path.join(serverFolder, 'abc2'));
    fs.mkdirSync(path.join(serverFolder, 'abc2/def2'));
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'abc2/def2'))).to.true;
  }).timeout(10000);

  it ('should sync folder deletion', async () => {
    await startClientAndServer();
    await utils.addFolderP(path.join(serverFolder, 'xxx/a/b/c/d/e'));
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'xxx/a/b/c/d/e'))).to.true;

    await utils.deleteFolderP(path.join(serverFolder, 'xxx'));
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'xxx'))).to.false;
  }).timeout(10000);

  it ('should re-connnect server if server stop after client connected', async () => {
    await startClientAndServer();
    kill(server);
    await utils.sleep(1000);
    server = await startServer();
    await utils.sleep(4000);
    expect(log.indexOf('reconnected')).to.gte(0);
  }).timeout(10000);

  it ('should only allow one client per one server', async () => {
    await startClientAndServer();
    const client2 = spawn('node', [
      commandPath, 'sync', '--folder', clientFolder, '--password', '0AxMWhxBeM']);
    await utils.sleep(4000);
    const exitCode = client2.exitCode;
    kill(client2);
    expect(exitCode).to.exist;
  }).timeout(10000);

  it ('should skip ignore file', async () => {
    await startClientAndServer();
    fs.mkdirSync(path.join(serverFolder, '.git'));
    fs.writeFileSync(path.join(serverFolder, '.git/ignore.txt'), '123');
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, '.git/ignore.txt'))).to.false;
  }).timeout(10000);

  it ('should sync reveser ignore file', async () => {
    fs.mkdirSync(path.join(serverFolder, '.quantumsync'));
    fs.mkdirSync(path.join(clientFolder, '.quantumsync'));
    const config = JSON.stringify({
      ignores: ['.abc/*', '!.abc/d/']
    });
    fs.writeFileSync(path.join(serverFolder, '.quantumsync/quantumsync.config.json'), config);
    fs.writeFileSync(path.join(clientFolder, '.quantumsync/quantumsync.config.json'), config);
    await utils.mkdirP(path.join(serverFolder, '.abc/d'));
    fs.writeFileSync(path.join(serverFolder, '.abc/a.js',), '123');
    fs.writeFileSync(path.join(serverFolder, '.abc/d/e.js'), '123');
    await startClientAndServer();

    await utils.sleep(1000);

    expect(fs.existsSync(path.join(clientFolder, '.abc/a.js'))).to.false;
    expect(fs.existsSync(path.join(clientFolder, '.abc/d/e.js'))).to.true;
    
    fs.writeFileSync(path.join(serverFolder, '.abc/f.js',), '123');
    fs.writeFileSync(path.join(serverFolder, '.abc/d/g.js'), '123');

    await utils.sleep(1000);

    expect(fs.existsSync(path.join(clientFolder, '.abc/f.js'))).to.false;
    expect(fs.existsSync(path.join(clientFolder, '.abc/d/g.js'))).to.true;
  }).timeout(10000);

  it ('should two way sync files on client connected', async () => {
    fs.writeFileSync(path.join(clientFolder, 'a.txt'), '123');
    fs.writeFileSync(path.join(serverFolder, 'b.txt'), '123');
    await startClientAndServer();
    await utils.sleep(1000);
    expect(fs.existsSync(path.join(clientFolder, 'a.txt'))).to.true;
    expect(fs.existsSync(path.join(serverFolder, 'a.txt'))).to.true;
  }).timeout(10000);

  it ('should load local config file', async () => {
    const port = Math.round(Math.random() * 10000);
    fs.mkdirSync(path.join(serverFolder, '.quantumsync'));
    fs.mkdirSync(path.join(clientFolder, '.quantumsync'));
    fs.writeFileSync(path.join(serverFolder, '.quantumsync/quantumsync.config.json'), `{"port": ${port}}`);
    fs.writeFileSync(path.join(clientFolder, '.quantumsync/quantumsync.config.json'), `{"port": ${port}}`);
    await startClientAndServer();
    expect(log.indexOf('' + port)).to.gte(0);
  }).timeout(10000);
})
