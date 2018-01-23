//首振り
const pigpio = require('pigpio');
const raspi = require('raspi');
const Servo = require('./action').Servo;
const Action = require('./action').Action;
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const config = require('./config');

if (config.voice_hat) {
  pigpio.configureClock(5, 0);
}

var mode = process.env.MODE || 'idle';
var led_mode = process.env.LED_MODE || 'off';

const servo0 = Servo(0.073);	//UP DOWN
const servo1 = Servo(0.073);	//LEFT RIGHT
const action = Action(servo0, servo1);

function startServo() {
  const servo = require('./servo')();
  const led = require('./led-controller')();
  servo.pwm0.write(servo0.now);	//UP DOWN
  servo.pwm1.write(servo1.now);	//LEFT RIGHT
  servo.pwm2.write(led.now);
  servo0.on('updated', () => {
    servo.pwm0.write(servo0.now);
  })
  servo1.on('updated', () => {
    servo.pwm1.write(servo1.now);
  })
  led.on('updated', () => {
    servo.pwm2.write(led.now);
  })
  setInterval(() => {
    action.idle(mode);
    led.idle(led_mode);
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
      if (data == 'talk' || data == 'idle') {
        mode = data;
      } else
      if (data == 'led-on' || data == 'led-off' || data == 'led-blink') {
        led_mode = data.toString().split('-')[1];
      } else {
        action.idle(data);
      }
      
      function change(state) {
        if (state == 'talking') {
          server.send(data, 0, data.length, rinfo.port, rinfo.address, (err) => {
          });
          action.removeListener('talk', change);
        } else {
          console.log('centering');
        }
      }
      action.on('talk', change);

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
