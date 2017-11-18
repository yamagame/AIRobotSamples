const dgram = require('dgram');
const message = Buffer.from('Some bytes');
const config = require('./config');

function PWM(key) {
  var t = {
    write: function(value) {
      var v = {};
      v[key] = value;
      const client = dgram.createSocket('udp4');
      const message = JSON.stringify(v);
      console.log(message);
      client.send(message, 0, message.length, config.udp.port, config.udp.host, (err) => {
        client.close();
      });
    }
  }
  return t;
}

module.exports = function() {
  return {
    pwm0: PWM('pwm0'),
    pwm1: PWM('pwm1'),
  }
}

if (require.main === module) {
  const gamepad = require('./gamepad')('udp');
}
