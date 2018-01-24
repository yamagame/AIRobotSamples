const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const spawn = require('child_process').spawn;
const path = require('path');

server.on('message', (data, rinfo) => {
  console.log(data.toString());

  const base = `${process.env.HOME}/sound`;
  const p = path.normalize(path.join(base, data.toString()));
  if (p.indexOf(base) == 0) {
    console.log(`/usr/bin/aplay ${p}`);
    const _playone = spawn('/usr/bin/aplay', [p]);
    _playone.on('close', function(code) {
      console.log('close', code);
    });
  }

});

server.bind(3091);
