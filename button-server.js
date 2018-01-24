const app = require('express')()
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser')
const config = require('./config');
const dgram = require('dgram');

const raspiMode = true;

const pigpio = raspiMode ? require('pigpio') : {};
const raspi = raspiMode ? require('raspi') : {};

var led_mode = process.env.LED_MODE || 'off';
var led_bright = process.env.LED_VALUE || 1;
var buttonLevel = null;

if (config.voice_hat && raspiMode) {
  pigpio.configureClock(5, 0);
}

app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.raw({ type: 'application/*' }))

app.post('command', (req, res) => {
  res.send('OK');
});

function changeLed(payload) {
  if (payload.action === 'off') {
    led_mode = 'off';
  }
  if (payload.action === 'on') {
    led_mode = 'on';
  }
  if (payload.action === 'blink') {
    led_mode = 'blink';
  }
  if (payload.action === 'active') {
    led_mode = 'off';
  }
  if (payload.action === 'deactive') {
    led_mode = 'on';
  }
  if (payload.action === 'sound') {
    const client = dgram.createSocket('udp4');
    client.send(payload.sound, 0, payload.sound.length, 3091, 'localhost', (err) => {
    });
  }
  led_bright = (typeof payload.value !== 'undefined') ? payload.value : led_bright;
}

app.post('/command', (req, res) => {
  if (req.body.type === 'led') {
    changeLed(req.body);
  }
  res.send('OK');
})

io.on('connection', function (socket) {
  socket.on('led-command', (payload, callback) => {
    changeLed(payload);
    if (callback) callback();
  })
})

if (raspiMode) {
  raspi.init(() => {
    const servo = require('./servo')();
    const led = require('./led-controller')();
    servo.pwm2.write(led.now);
    led.on('updated', () => {
      servo.pwm2.write(led.now);
    })
    setInterval(() => {
      led.idle(led_mode, led_bright);
    }, 20);

    var Gpio = require('pigpio').Gpio,
      button = new Gpio(23, {
        mode: Gpio.INPUT,
        pullUpDown: Gpio.PUD_DOWN,
        edge: Gpio.EITHER_EDGE
      })
    
    button.on('interrupt', function (level) {
      if (buttonLevel != level) {
        buttonLevel = level;
        io.emit('button', { level: level, state: (level==0) });
      }
    });

  });
}

server.listen(3090, () => console.log('Example app listening on port 3090!'))
