const SoftPWM = require('raspi-soft-pwm').SoftPWM;

module.exports = function() {
  return {
    pwm0: new SoftPWM('GPIO26'),	//UP DOWN
    pwm1: new SoftPWM('GPIO6'),	//LEFT RIGHT
  }
}
