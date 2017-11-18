//首振り
const raspi = require('raspi');
const Servo = require('./action').Servo;
const Action = require('./action').Action;
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const config = require('./config');

var mode = process.env.MODE || 'idle';

const servo0 = Servo(0.073);	//UP DOWN
const servo1 = Servo(0.073);	//LEFT RIGHT
const action = Action(servo0, servo1);

function startServo() {
  const servo = require('./servo')();
  servo.pwm0.write(servo0.now);	//UP DOWN
  servo.pwm1.write(servo1.now);	//LEFT RIGHT
  servo0.on('updated', () => {
    servo.pwm0.write(servo0.now);
  })
  servo1.on('updated', () => {
    servo.pwm1.write(servo1.now);
  })
  setInterval(() => {
    action.idle(mode);
  }, 20);
}

function startServer() {
  server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
  });
  
  server.on('message', (data, rinfo) => {
    console.log(`server got: ${data} from ${rinfo.address}:${rinfo.port}`);
    try {
      mode = data;
      server.send(data, 0, data.length, rinfo.port, rinfo.address, (err) => {
      });
    } catch(err) {
    }
  });
  
  server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
  });
  
  server.bind(config.udp.port);
}

raspi.init(() => {
  startServo();
  startServer();
});
