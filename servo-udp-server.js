const raspi = require('raspi');
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const config = require('./config');

raspi.init(() => {
  const servo = require('./servo')();

  server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
  });
  
  server.on('message', (data, rinfo) => {
    console.log(`server got: ${data} from ${rinfo.address}:${rinfo.port}`);
    try {
      const json = JSON.parse(data);
      if (json.pwm0 != null) {
        servo.pwm0.write(json.pwm0);
      }
      if (json.pwm1 != null) {
        servo.pwm1.write(json.pwm1);
      }
    } catch(err) {
    }
  });
  
  server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
  });
  
  server.bind(config.udp.port);
  
  //const gamepad = require('./gamepad')('udp');
});
