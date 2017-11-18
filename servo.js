const SoftPWM = require('raspi-soft-pwm').SoftPWM;

module.exports = function() {
  return {
    pwm0: new SoftPWM('GPIO22'),	//UP DOWN
    pwm1: new SoftPWM('GPIO27'),	//LEFT RIGHT
  }
}
