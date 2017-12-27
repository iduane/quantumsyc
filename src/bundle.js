module.exports = {
  createStream(resp) {
    const { files } = resp;
    return files.reduce((changes, descriptor) => {
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
