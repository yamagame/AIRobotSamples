const EventEmitter = require('events');
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request');
const speech = require('./speech');
//const speech = new EventEmitter();
const talk = require('./talk');
const dgram = require('dgram');
const config = require('./config');
const APIKEY= config.docomo.api_key;
const { exec, spawn } = require('child_process');

var context = null;

function chat(message, context, callback) {
  const json = {
    utt: message,
  }
  if (context) {
    json.context = context;
  }
  request.post({
    url:'https://api.apigw.smt.docomo.ne.jp/dialogue/v1/dialogue?APIKEY='+APIKEY,
    json,
  }, function optionalCallback(err, httpResponse, body) {
    callback(err, body);
  });
}

speech.recording = false;

function servoAction(action, direction, callback) {
  const client = dgram.createSocket('udp4');
  var done = false;
  function response() {
    if (!done) {
      client.removeListener('message', response);
      if (callback) callback();
    }
    done = true;
  }
  client.on('message', response);
  if (direction) {
    client.send(direction, 0, direction.length, config.udp.port, config.udp.host, (err) => {
    });
  }
  client.send(action, 0, action.length, config.udp.port, config.udp.host, (err) => {
  });
  setTimeout(()=>{
    response();
  }, 3000);
}

talk.on('idle', function() {
	//speech.recording = true;
});

talk.on('talk', function() {
	speech.recording = false;
});

speech.on('data', function(data) {
  console.log(data);
});

const app = express()

app.use(bodyParser.json())

function docomo_chat(payload, callback) {
	chat(payload.message, context, function(err, body) {
    var utt = payload.message+'がどうかしましたか。';
		if (err) {
		} else {
      utt = body.utt;
			context = body.context;
		}
    servoAction('talk', payload.direction, () => {
    	talk.play(utt, () => {
        servoAction('idle');
        if (callback) callback();
    	});
    });
	})
}

var playing = false;

function text_to_speech(payload, callback) {
  if (!playing) {
    playing = true;
    servoAction('talk', payload.direction, () => {
    	talk.play(payload.message, () => {
        servoAction('idle');
        playing = false;
        if (callback) callback();
    	});
    });
  } else {
    if (callback) callback();
  }
}

function speech_to_text(payload, callback) {
  var done = false;
  
  setTimeout(() => {
    if (!done) {
      speech.recording = false;
      if (callback) callback(null, '');
      speech.removeListener('data', listener);
    }
    done = true;
  }, payload.timeout);
  
  speech.recording = true;
  
  function listener(data) {
    if (!done) {
      speech.recording = false;
      if (callback) callback(null, data);
      speech.removeListener('data', listener);
    }
    done = true;
  }
  
  speech.on('data', listener);
}

app.post('/docomo-chat', (req, res) => {
  console.log('/docomo-chat');
  console.log(req.body);

  docomo_chat({
    message: req.body.message,
    direction: req.body.direction || null,
  }, (err) => {
    res.send('OK');
  });
});

app.post('/text-to-speech', (req, res) => {
  console.log('/text-to-speech');
  console.log(req.body);
  
  text_to_speech({
    message: req.body.message,
    direction: req.body.direction || null,
  }, (err) => {
    res.send('OK');
  });
});

app.post('/speech-to-text', (req, res) => {
  console.log('/speech-to-text');
  console.log(req.body);
  
  speech_to_text({
    timeout: req.body.timeout || 30000,
  }, (err, data) => {
    res.send(data);
  });
});

const server = require('http').Server(app);
const io = require('socket.io')(server);

io.on('connection', function (socket) {
  console.log('connected');
  socket.on('docomo-chat', function (payload, callback) {
    docomo_chat({
      message: payload.message,
      direction: payload.direction || null,
    }, (err) => {
      if (callback) callback('OK');
    });
  });
  socket.on('text-to-speech', function (payload, callback) {
    text_to_speech({
      message: payload.message,
      direction: payload.direction || null,
    }, (err) => {
      if (callback) callback('OK');
    });
  });
  socket.on('speech-to-text', function (payload, callback) {
    speech_to_text({
      timeout: payload.timeout || 30000,
    }, (err, data) => {
      if (callback) callback(data);
    });
  });
  socket.on('command', function(payload, callback) {
    exec(payload.command, (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(stdout);
    });
    if (callback) callback();
  });
  socket.on('message', function(payload, callback) {
    console.log('message', payload);
    if (callback) callback();
  });
});

server.listen(3090, () => console.log('Example app listening on port 3090!'))
