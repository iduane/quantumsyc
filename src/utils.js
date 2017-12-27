module.exports = {
  mergeChanges(map, increment) {
    let merged = {}, key;
    [map, increment].forEach((obj) => {
      for (key in obj) {
        if (obj.hasOwnProperty(key)) {
          merged[key] = obj[key];
        }
      }
    })
    
    return merged;
  },

  toList(changeMap) {
    let list = [];

    for (let key in changeMap) {
      let obj = { name: key };
      for (let mapKey in changeMap[key]) {
        obj[mapKey] = changeMap[key][mapKey];
      }
      list.push(obj);
    }

    return list;
  }
}
