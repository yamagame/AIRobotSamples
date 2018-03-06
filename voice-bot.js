const speech = require('./speech');
const request = require('request');
const io = require('socket.io-client');
const EventEmitter = require('events');
const express = require('express')
const bodyParser = require('body-parser')
const talk = require('./talk');
const spawn = require('child_process').spawn;

speech.on('data', function(data) {
  console.log(data);
  request({
    method: 'POST',
    uri: `http://192.168.0.101:3090/speech`,
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

var sleepTimer = null;
var shutdownTimer = null;
var shutdownLEDTimer = null;

socket.on('button', (payload) => {
  console.log(payload);
  if (shutdownTimer) clearTimeout(shutdownTimer);
  if (shutdownLEDTimer) clearTimeout(shutdownLEDTimer);
  if (payload.state) {
    if (shutdownTimer) clearTimeout(shutdownTimer);
    speech.writing = (speech.writing == false)
    if (sleepTimer) clearTimeout(sleepTimer);
    if (speech.writing) {
      speech.recording = true;
      //3分でスリープ
      sleepTimer = setTimeout(() => {
        speech.writing = false;
        socket.emit('led-command', { action: 'blink' });
      }, 3*60*1000);
    }
    //５秒間押し続け
    shutdownTimer = setTimeout(() => {
      socket.emit('led-command', { action: 'power' });
      //さらに５秒間押し続け
      shutdownLEDTimer = setTimeout(() => {
        socket.emit('led-command', { action: 'on' });
        //シャットダウン
        const _playone = spawn('/usr/bin/sudo', ['shutdown', 'now']);
        _playone.on('close', function(code) {
          console.log('shutdonw done');
        });
      }, 5*1000);
    }, 5*1000);
  }
  socket.emit('led-command', { action: speech.writing ? 'on' : 'off' });
});

socket.on('connect', () => {
  const interval = setInterval(() => {
    if (speech.status == 'start') {
      socket.emit('led-command', { action: 'power' });
      setTimeout(() => {
        socket.emit('led-command', { action: 'blink' });
      }, 20000);
      clearInterval(interval);
    }
  }, 1000);
});

const app = express()

app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.raw({ type: 'application/*' }))

app.post('/debug-speech', (req, res) => {
  talk.play(req.body.toString('utf-8'));
  res.send('OK');
});

const server = require('http').Server(app);
server.listen(3090, () => console.log('Example app listening on port 3090!'))
