const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const { expect } = require('chai');
const upath = require('upath');
const checksum = require('../src/checksum');
const utils = require('../src/utils');

const testFolder = path.join(__dirname, 'temp/checksum-folder');

describe('Checksum Folder', () => {
  beforeEach(async () => {
    rimraf.sync(testFolder);
    mkdirp.sync(path.resolve(testFolder))
    await utils.sleep(500);
  })
  
  afterEach(() => {
    rimraf.sync(testFolder);
  })

  it ('should checksum all support files and folders', async () => {
    fs.writeFileSync(path.resolve(testFolder, 'file0.txt'), 'file0 content');
    fs.writeFileSync(path.resolve(testFolder, 'file01.txt'), 'file0 content');
    fs.mkdirSync(path.resolve(testFolder, 'dir1'));
    fs.writeFileSync(path.resolve(testFolder, 'dir1/file1.txt'), 'file1 content');
    fs.mkdirSync(path.resolve(testFolder, 'dir1/dir11'));
    fs.mkdirSync(path.resolve(testFolder, 'dir1/dir12'));
    fs.writeFileSync(path.resolve(testFolder, 'dir1/dir12/file1120.txt'), 'file1120 content');
    fs.writeFileSync(path.resolve(testFolder, 'dir1/dir12/file1121.txt'), 'file1121 content');
    
    const digest1 = await checksum(testFolder);
    let count = 0;
    for (let key in digest1) {
      if (digest1.hasOwnProperty(key)) {
        count++;
      }
    }
    expect(count).to.eq(8);
    expect(digest1['dir1/dir12/file1120.txt']).to.be.exist;

    const changedFilePath = upath.normalize(path.relative(testFolder, path.resolve(testFolder, 'dir1/dir12/file1120.txt')));
    const notChangedFilePath = upath.normalize( path.relative(testFolder, path.resolve(testFolder, 'dir1/dir12/file1121.txt')));
    await utils.sleep(1000);
    fs.writeFileSync(path.resolve(testFolder, changedFilePath), 'file1120 content changed');
    await utils.sleep(1000);
    const digest2 = await checksum(testFolder);
    count = 0;
    for (let key in digest2) {
      if (digest2.hasOwnProperty(key)) {
        count++;
      }
    }
    expect(count).to.eq(8);

    expect(digest1[changedFilePath].digest).not.to.eq(digest2[changedFilePath].digest)
    expect(digest1[notChangedFilePath].digest).to.eq(digest2[notChangedFilePath].digest)
  }).timeout(5000)

  it ('should skip ignore files checksum', async () => {
    rimraf.sync(testFolder);
    fs.mkdirSync(path.resolve(testFolder));
    fs.mkdirSync(path.resolve(testFolder, '.git'));
    fs.writeFileSync(path.resolve(testFolder, '.git/file1.txt'), 'file1 content');
    fs.mkdirSync(path.resolve(testFolder, 'dir1'));
    fs.writeFileSync(path.resolve(testFolder, 'dir1/file10.txt'), '10 content');
    fs.writeFileSync(path.resolve(testFolder, 'dir1/file11.txt'), '11 content');
    
    const digest1 = await checksum(testFolder);
    let count = 0;
    for (let key in digest1) {
      if (digest1.hasOwnProperty(key)) {
        count++;
      }
    }
    expect(count).to.eq(3);
    expect(digest1[path.resolve(testFolder, '.git')]).not.to.exist;
    expect(digest1[path.resolve(testFolder, '.git/file1.txt')]).not.to.exist;
  })
});
