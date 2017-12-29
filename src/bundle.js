const systemConfig = require('./system-config');
const ignore = require('ignore')

module.exports = {
  createStream(resp) {
    const ig = ignore().add(systemConfig.getSystemConfig().ignores);
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
      // FIXME: order changes by folder sequence, add folder first, and delete folder later that its children
  }
}
