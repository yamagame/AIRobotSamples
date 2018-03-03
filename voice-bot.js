const speech = require('./speech');
const request = require('request');
const io = require('socket.io-client');
const EventEmitter = require('events');

speech.on('data', function(data) {
  console.log(data);
  request({
    method: 'POST',
    uri: `http://192.168.0.101:3090/debug-speech`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: data,
  }, function(err, res, body) {
    console.log(body);
  });
});

var t = new EventEmitter();
const socket = io('http://localhost:3091');

speech.recording = false;
speech.writing = false;

socket.on('button', (payload) => {
  console.log(payload);
  if (payload.state) {
    speech.writing = (speech.writing == false)
    if (speech.writing) speech.recording = true;
  }
  socket.emit('led-command', { action: speech.writing ? 'on' : 'off' });
});

socket.on('connect', () => {
  const interval = setInterval(() => {
    if (speech.status == 'start') {
      setTimeout(() => {
        socket.emit('led-command', { action: 'blink' });
      }, 20000);
      clearInterval(interval);
    }
  }, 1000);
});

const server = require('http').Server(app);
server.listen(3090, () => console.log('Example app listening on port 3090!'))
