const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const monitor = require('../src/monitor');
const utils = require('../src/utils');

describe('Watch Project', () => {
  const smokeFolder = path.join(__dirname, 'temp/smoke');
  const watchingFolder = path.resolve(smokeFolder, 'local');
  const targetFolder = path.resolve(smokeFolder, 'remote');

  beforeEach(() => {
    rimraf.sync(smokeFolder);
    mkdirp.sync(smokeFolder);
    mkdirp.sync(watchingFolder);
    mkdirp.sync(targetFolder);
  })
  
  afterEach(async () => {
    rimraf.sync(smokeFolder);
    await utils.sleep(500);
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
        path: watchingFolder,
      });
      terminate = stub.terminate;
      stub.listen(onMessage);
      fs.writeFileSync(path.join(watchingFolder, 'a.txt'), 'abc');
    })()
  })
})
