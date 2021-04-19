// const fs = require('fs');
// const path = require('path');
// const vm = require('vm');
// const http = require('http');
import http from 'http';

// const data = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf-8');
// let sandbox = {
//   require,
//   console,
// };
// const a = vm.runInNewContext(data, sandbox);
// console.log('a: ', a);

http
  .createServer((req, res) => {
    res.end('哈哈哈');
  })
  .listen(3000);
