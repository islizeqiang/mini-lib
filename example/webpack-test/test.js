const fs = require('fs');

let buffer = Buffer.alloc(0);

fs.createReadStream('http://127.0.0.1:7000/client.js')
  .on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
  })
  .on('end', () => {
    fs.writeFileSync('a.html', buffer);
  });
