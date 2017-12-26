const commander = require('commander');
const pkg = require('../package.json');
const onExit = require('signal-exit');
const path = require('path');
const monitor = require('./monitor');
const Recorder = require('./recorder');
const configuration = require('./configuration');

commander
  .version(pkg.version)
  .command('sync')
  .description('Synchronize local folder to remote folder, and verse vice.')
  .option('-l, --local [localPath]', '本地目录')
  .option('-r, --remote [remotePath]', '远程目录')
  .action(options => startMonitor(options))

commander.parse(process.argv)

let termiate;

onExit(function() {
  if (termiate) {
    termiate();
  }
});

async function startMonitor(options) {
  const { local, remote } = options;

  const userConfig = {
    local: {
      path: path.resolve(process.cwd(), local)
    }
  }
  const stub = await monitor.watch(userConfig)
  termiate = stub.termiate;

  const config = configuration.getUserConfig(userConfig);
  stub.listen(new Recorder(config).listener);
}
