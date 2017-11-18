const net = require('net');
const config = require('./config');

const client = new net.Socket();
client.connect(config.tcp.port, config.tcp.host, function() {
	console.log('Connected');
});

client.on('data', function(data) {
	console.log('Received: ' + data);
});

client.on('close', function() {
	console.log('Connection closed');
});

function PWM(key) {
  var t = {
    write: function(value) {
      var v = {};
      v[key] = value;
      client.write(JSON.stringify(v));
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
  const gamepad = require('./gamepad')('tcp');
}
