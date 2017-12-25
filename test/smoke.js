import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import fs from 'fs';
import rimraf from 'rimraf';

import quantum from '../src/quantum';

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
    let end;

    const onMessage = (resp) => {
      end();
      expect(resp.files[0].name).to.eq('a.txt');
      cb();
    };
    (async function() {
      const stub = await quantum({
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
      }, onMessage);
      end = stub.end;
      fs.writeFileSync(path.join(watchingFolder, 'a.txt'), 'abc');
    })()
  })
})
