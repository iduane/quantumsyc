const systemConfig = require('./system-config');
const ignore = require('ignore')
const ig = ignore().add(systemConfig.getSystemConfig().ignores);

module.exports = {
  createStream(resp) {
    const { files } = resp;
    return files
      .filter(function(descriptor) {
        return !ig.ignores(descriptor.name);
      })
      .reduce((changes, descriptor) => {
        const path = descriptor.name;
        let op = 'change';
        if (descriptor.exists) {
          if (descriptor.new) {
            op = 'new';
          }
        } else {
          op = 'delete';
        }

        changes[path] = { op };
        return changes;
      }, {});
  }
}
