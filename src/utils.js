var fs = require('fs');
var path = require('path');

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
  },

  mkdirP(dir) {
    try{
      fs.mkdirSync(dir);
    }
    catch(e){
      if(e.code === 'ENOENT'){
        this.mkdirP(path.dirname(dir));
        this.mkdirP(dir);
      }
    }
  }
}
