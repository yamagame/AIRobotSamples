const clients = {
  servo: './servo',
  tcp: './servo-tcp-client',
  udp: './servo-udp-client',
}

function Gamepad(mode) {

  const servo = require(clients[mode])();
  const gpio = require('raspi-gpio');
  
  var result = '';
  var _result = '';
  
  var delta = 0.001;
  var servo0 = { now: 0.073 };
  var servo1 = { now: 0.073 };
  
  const input33 = new gpio.DigitalInput({
    pin: 'P1-33',
    pullResistor: gpio.PULL_DOWN
  });
  const input35 = new gpio.DigitalInput({
    pin: 'P1-35',
    pullResistor: gpio.PULL_DOWN
  });
  const input36 = new gpio.DigitalInput({
    pin: 'P1-36',
    pullResistor: gpio.PULL_DOWN
  });
  const input37 = new gpio.DigitalInput({
    pin: 'P1-37',
    pullResistor: gpio.PULL_DOWN
  });
  const input38 = new gpio.DigitalInput({
    pin: 'P1-38',
    pullResistor: gpio.PULL_DOWN
  });
  const input40 = new gpio.DigitalInput({
    pin: 'P1-40',
    pullResistor: gpio.PULL_DOWN
  });
  
  servo.pwm0.write(servo0.now);
  servo.pwm1.write(servo1.now);

  setInterval(() => {
	  result = '';
	  result += input33.read();		//RIGHT
	  result += input35.read();		//DOWN
	  result += input36.read();		//UP
	  result += input37.read();		//LEFT
	  result += input38.read();		//B
	  result += input40.read();		//A
	  
	  if (result !== _result) {
		  _result = result;
		  console.log(result);
	  }

	  //DOWN
	  if (input35.read() == '1') {
	  	servo0.now += delta;
      if (servo0.now > 0.091) servo0.now = 0.091;
      servo.pwm0.write(servo0.now);
		  console.log(servo0.now);
	  }
	  //UP
	  if (input36.read() == '1') {
      servo0.now -= delta;
      if (servo0.now < 0.056) servo0.now = 0.056;
	  	servo.pwm0.write(servo0.now);
		  console.log(servo0.now);
	  }
	  //RIGHT
	  if (input33.read() == '1') {
	  	servo1.now += delta;
      if (servo1.now > 0.100) servo1.now = 0.100;
	  	servo.pwm1.write(servo1.now);
		  console.log(servo1.now);
	  }
	  //LEFT
	  if (input37.read() == '1') {
	  	servo1.now -= delta;
      if (servo1.now < 0.050) servo1.now = 0.050;
	  	servo.pwm1.write(servo1.now);
		  console.log(servo1.now);
	  }

  }, 30);

}

module.exports = Gamepad;

if (require.main === module) {
  Gamepad('servo');
}
