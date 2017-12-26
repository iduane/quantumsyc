const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

const monitor = require('../src/monitor');

describe('Smoke', () => {
  const smokeFolder = path.join(__dirname, 'smoke');
  const watchingFolder = path.join(__dirname, 'smoke', 'local');
  const targetFolder = path.join(__dirname, 'smoke', 'remote');

  before(() => {
    if (!fs.existsSync(smokeFolder)) {
      fs.mkdirSync(smokeFolder);
    }
    if (!fs.existsSync(watchingFolder)) {
      fs.mkdirSync(watchingFolder);
    }
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder);
    }
  })

  after(() => {
    rimraf.sync(smokeFolder);
  })

  it('should monitor changed file', (cb) => {
    let terminate;

    const onMessage = (resp) => {
      terminate();
      expect(resp.files[0].name).to.eq('a.txt');
      cb();
    };
    (async function() {
      const stub = await monitor.watch({
        local: {
          path: watchingFolder,
        },
        remote: {
          type: 'ssh',
          host: 'localhost',
          // port: '22',
          // user: 'fuya',
          path: targetFolder
        }
      });
      terminate = stub.terminate;
      stub.listen(onMessage);
      fs.writeFileSync(path.join(watchingFolder, 'a.txt'), 'abc');
    })()
  })
})
