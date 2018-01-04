const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const utils = require('../src/utils');

const testFolder = path.join(__dirname, 'temp/utils-test');

describe('Utils', () => {
  beforeEach(() => {
    rimraf.sync(testFolder);
    mkdirp.sync(path.resolve(testFolder));
  })
  
  afterEach(async () => {
    rimraf.sync(testFolder);
    await utils.sleep(500);
  })

  it ('writeFile', async () => {
    await utils.writeFile(path.resolve(testFolder, 'a.txt'), 'abc');
    let fileContent = fs.readFileSync(path.resolve(testFolder, 'a.txt')).toString();

    expect(fileContent).to.eq('abc');

    await utils.writeFile(path.resolve(testFolder, 'a.txt'), 'def');
    fileContent = fs.readFileSync(path.resolve(testFolder, 'a.txt')).toString();

    expect(fileContent).to.eq('def');

    await utils.writeFile(path.resolve(testFolder, 'noexit/a1.txt'), '123');
    fileContent = fs.readFileSync(path.resolve(testFolder, 'noexit/a1.txt')).toString();

    expect(fileContent).to.eq('123');
  })

  it ('deleteFile', async () => {
    const filePath = path.resolve(testFolder, 'a.txt');
    await utils.writeFile(filePath, 'abc');

    expect(fs.existsSync(filePath)).to.true;

    await utils.deleteFile(filePath);

    expect(fs.existsSync(filePath)).to.false;

    // let hasError = false;
    // try {
    //   await utils.deleteFile(filePath);
    // } catch (e) {
    //   hasError = true;
    // }

    // expect(hasError).to.true;
  })

  it ('readFile', async() => {
    await utils.writeFile(path.resolve(testFolder, 'a.txt'), 'abc');
    const data = await utils.readFile(path.resolve(testFolder, 'a.txt'));

    expect(data.toString()).to.eq('abc');
  })

  it ('readDir', async() => {
    await utils.writeFile(path.resolve(testFolder, 'a.txt'), 'abc');
    await utils.addFolder(path.resolve(testFolder, 'b'), 'abc');

    const data = await utils.readDir(testFolder);

    expect(data).to.eql(['a.txt', 'b']);
  })

  it ('exitsResource', async () => {
    const filePath1 = path.resolve(testFolder, 'a2.txt');
    await utils.writeFile(filePath1, 'abc');

    expect(await utils.exitsResource(filePath1)).to.true;

    const filePath2 = path.resolve(testFolder, 'a21.txt');
    expect(await utils.exitsResource(filePath2)).to.false;

    await utils.deleteFile(filePath1);
    expect(await utils.exitsResource(filePath1)).to.false;

  })

  it ('addFolder', async() => {
    const filePath1 = path.resolve(testFolder, 'b');
    await utils.addFolderP(filePath1);

    expect(await utils.exitsResource(filePath1)).to.true;

    let hasError = false;
    const filePath2 = path.resolve(testFolder, 'b1/b2');
    try {
      await utils.addFolder(filePath2);
    } catch (e) {
      hasError = true;
    }

    expect(hasError).to.true;
  })

  it ('addFolderP', async() => {
    const filePath1 = path.resolve(testFolder, 'c');
    await utils.addFolderP(filePath1);

    expect(await utils.exitsResource(filePath1)).to.true;

    const filePath2 = path.resolve(testFolder, 'c1/c2/c3');
    const addedFolders = await utils.addFolderP(filePath2);

    expect(await utils.exitsResource(filePath2)).to.true;
    expect(addedFolders).to.eql([
      path.resolve(testFolder, 'c1'),
      path.resolve(testFolder, 'c1/c2'),
      path.resolve(testFolder, 'c1/c2/c3'),
    ]);
  })

  it ('deleteFolder', async() => {
    const filePath1 = path.resolve(testFolder, 'd');
    await utils.addFolder(filePath1);

    expect(await utils.exitsResource(filePath1)).to.true;

    await utils.deleteFolder(filePath1);

    expect(await utils.exitsResource(filePath1)).to.false;

    let hasError = false;
    try {
      await utils.deleteFolder(filePath1);
    } catch (e) {
      hasError = true;
    }
    expect(hasError).to.true;

    const filePath2 = path.resolve(testFolder, 'd1.txt');
    await utils.writeFile(filePath2, 'abc');
    hasError = false;
    try {
      await utils.deleteFolder(filePath2);
    } catch (e) {
      hasError = true;
    }

    expect(hasError).to.true;

  })

  it ('deleteFolderP', async() => {
    const filePath1 = path.resolve(testFolder, 'd21/b/c/d');
    await utils.addFolderP(filePath1);
    expect(await utils.exitsResource(filePath1)).to.true;


    const filePath2 = path.resolve(testFolder, 'd21');
    await utils.deleteFolderP(filePath2);
    expect(await utils.exitsResource(filePath2)).to.false;
  })

  it ('lstatResource', async() => {
    const filePath1 = path.resolve(testFolder, 'e1.txt');
    await utils.writeFile(filePath1, 'abc');

    const filePath2 = path.resolve(testFolder, 'e2');
    await utils.addFolder(filePath2, 'abc');

    const state1 = await utils.lstatResource(filePath1);
    expect(state1).to.exist;

    const state2 = await utils.lstatResource(filePath2);
    expect(state2).to.exist;

    const filePath3 = path.resolve(testFolder, 'e3');
    let hasError = false;
    try {
      await utils.lstatResource(filePath3);
    } catch (e) {
      hasError = true;
    }

    expect(hasError).to.true;
  });
});
