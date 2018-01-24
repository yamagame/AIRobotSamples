const SoftPWM = require('raspi-soft-pwm').SoftPWM;
const config = require('./config');
const EventEmitter = require('events');

module.exports = function() {
  var t = new EventEmitter();

  t.now = 0;
  t.max = 1;
  t.mode = 'off';
  t.blinkSpeed = 0.025;
  t.theta = 0;
  t.idle = function(mode, value = 1) {
    const now = t.now;
    if (t.mode !== mode) {
      if (mode == 'off') {
        t.mode = mode;
      } else
      if (mode == 'on') {
        t.mode = mode;
      } else
      if (mode == 'blink') {
        t.mode = mode;
      }
    }
    if (t.mode == 'off') {
      t.now = 0;
    }
    if (t.mode == 'on') {
      t.now = t.max;
    }
    if (t.mode == 'blink') {
      t.now = (Math.sin(t.theta)+1)*t.max/2;
      t.theta += t.blinkSpeed;
      if (t.theta >= Math.PI*2) {
        t.theta -= Math.PI*2;
      }
    }
    {
      t.max = value;
      if (t.now > t.max) t.now = t.max;
    }
    if (now != t.now) {
      t.emit('updated');
    }
  }

  return t;
}
