const raspi = require('raspi');
const net = require('net');
const config = require('./config');

raspi.init(() => {
  const servo = require('./servo')();
  
  var textChunk = '';
  var server = net.createServer(function(socket) {
    socket.write('connected\r\n');
    socket.on('data', function(data){
      try {
        const json = JSON.parse(data);
        if (json.pwm0 != null) {
          servo.pwm0.write(json.pwm0);
        }
        if (json.pwm1 != null) {
          servo.pwm1.write(json.pwm1);
        }
        socket.write('OK\r\n');
      } catch(err) {
      }
    });
  });
  server.listen(config.tcp.port);
  
  //const gamepad = require('./gamepad')('tcp');
});
