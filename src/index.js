const commander = require('commander');
const pkg = require('../package.json');
const onExit = require('signal-exit');
const path = require('path');
const fs  = require('fs');
const Monitor = require('./monitor');
const Client = require('./client');
const Server = require('./server');
const Bundle = require('./bundle');

const systemConfig = require('./system-config');

let monitor, client, server;

commander
  .version(pkg.version)
  .command('sync')
  .description('Synchronize local folder to remote folder, and verse vice.')
  .option('-f, --folder [localFolder]', 'folder to sync')
  .option('-h, --host [host]', '远程 Quantum server 地址, e.g. 10.111.3.190')
  .option('-p, --port [port]', 'remote port')
  .action(async (options) => {
    const folder = fixPath(options.folder);
    const config = systemConfig.getSystemConfig();
    const host = options.host || config.host;
    const port = options.port || config.port;

    monitor = await Monitor.watch({ path: folder });
    client = new Client({ host, port });
    await client.start();

    connect(monitor, client);
  });

commander
  .command('serve')
  .description('Provide remote service for Quantum synchronization')
  .option('-f, --folder [localFolder]', 'folder to be synced')
  .option('-p, --port [port]', 'exposed port')
  .action(async (options) => {
    const folder = fixPath(options.folder);
    const config = systemConfig.getSystemConfig();
    const port = options.port || config.port;

    monitor = await Monitor.watch({ path: folder });
    server = new Server({ port });
    await server.start();

    connect(monitor, server);
  })

commander.parse(process.argv)

onExit(function() {
  [monitor, client, server].forEach((resource, index) => {
    if (resource) {
      resource.terminate();
    }
  });
});

function fixPath(folder) {
  if (!folder || !fs.existsSync(path.resolve(folder))) {
    return path.resolve(process.cwd());
  }

  return folder;
}

function connect(monitor, vehicle) {
  monitor.listen(function(resp) {
    vehicle.dispatch(Bundle.createStream(resp));
  });
}
