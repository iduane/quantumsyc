// const { expect } = require('chai');
// const sinon = require('sinon');
// const path = require('path');
// const rimraf = require('rimraf');
// const fs = require('fs');

// const monitor = require('../src/monitor');
// const entry = require('../src/index');

// describe('Command Line', () => {
//   const smokeFolder = path.join(__dirname, 'smoke');
//   const watchingFolder = path.join(__dirname, 'smoke', 'local');
//   const targetFolder = path.join(__dirname, 'smoke', 'remote');

//   before(() => {
//     if (!fs.existsSync(smokeFolder)) {
//       fs.mkdirSync(smokeFolder);
//     }
//     if (!fs.existsSync(watchingFolder)) {
//       fs.mkdirSync(watchingFolder);
//     }
//     if (!fs.existsSync(targetFolder)) {
//       fs.mkdirSync(targetFolder);
//     }
//   })

//   after(() => {
//     rimraf.sync(smokeFolder);
//   })

//   let spy, terminate;
//   beforeEach(() => {
//     spy = sinon.spy(monitor, 'watch');
//   })
//   afterEach(() => {
//     monitor.watch.restore();
//     terminate();
//   })
//   it ('should accept local path as input param', async () => {
//     const options = {
//       local: {
//         path: watchingFolder,
//       },
//       remote: {
//         type: 'ssh',
//         host: 'localhost',
//         // port: '22',
//         // user: 'fuya',
//         path: targetFolder
//       }
//     };
//     const stub = await monitor.watch(options);
//     terminate = stub.terminate;
//     expect(spy.called).to.true;
//     expect(spy.callCount).to.eq(1);
//     expect(spy.args[0][0]).eql(options);
//   })
// })
