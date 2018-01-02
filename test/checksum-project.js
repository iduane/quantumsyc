const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const { expect } = require('chai');
const checksum = require('../src/checksum');
const utils = require('../src/utils');

const testFolder = path.join(__dirname, 'temp/checksum-folder');

describe('Checksum Folder', () => {
  beforeEach(() => {
    mkdirp.sync(path.resolve(testFolder))
  })
  
  afterEach(() => {
    rimraf.sync(testFolder);
  })

  it ('should checksum all support files and folders', () => {
    fs.writeFileSync(path.resolve(testFolder, 'file0.txt'), 'file0 content');
    fs.writeFileSync(path.resolve(testFolder, 'file01.txt'), 'file0 content');
    fs.mkdirSync(path.resolve(testFolder, 'dir1'));
    fs.writeFileSync(path.resolve(testFolder, 'dir1/file1.txt'), 'file1 content');
    fs.mkdirSync(path.resolve(testFolder, 'dir1/dir11'));
    fs.mkdirSync(path.resolve(testFolder, 'dir1/dir12'));
    fs.writeFileSync(path.resolve(testFolder, 'dir1/dir12/file1120.txt'), 'file1120 content');
    fs.writeFileSync(path.resolve(testFolder, 'dir1/dir12/file1121.txt'), 'file1121 content');
    
    const digest1 = checksum(testFolder);
    let count = 0;
    for (let key in digest1) {
      if (digest1.hasOwnProperty(key)) {
        count++;
      }
    }
    expect(count).to.eq(8);

    const changedFilePath = path.relative(testFolder, path.resolve(testFolder, 'dir1/dir12/file1120.txt'));
    const notChangedFilePath = path.relative(testFolder, path.resolve(testFolder, 'dir1/dir12/file1121.txt'));
    fs.writeFileSync(path.resolve(testFolder, changedFilePath), 'file1120 content changed');

    const digest2 = checksum(testFolder);
    count = 0;
    for (let key in digest2) {
      if (digest2.hasOwnProperty(key)) {
        count++;
      }
    }
    expect(count).to.eq(8);

    expect(digest1[changedFilePath].digest).not.to.eq(digest2[changedFilePath].digest)
    expect(digest1[notChangedFilePath].digest).to.eq(digest2[notChangedFilePath].digest)
  })

  it ('should skip ignore files checksum', () => {
    rimraf.sync(testFolder);
    fs.mkdirSync(path.resolve(testFolder));
    fs.mkdirSync(path.resolve(testFolder, '.git'));
    fs.writeFileSync(path.resolve(testFolder, '.git/file1.txt'), 'file1 content');
    fs.mkdirSync(path.resolve(testFolder, 'dir1'));
    fs.writeFileSync(path.resolve(testFolder, 'dir1/file10.txt'), '10 content');
    fs.writeFileSync(path.resolve(testFolder, 'dir1/file11.txt'), '11 content');
    
    const digest1 = checksum(testFolder);
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
