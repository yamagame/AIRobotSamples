const EventEmitter = require('events');
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request');
const speech = require('./speech');
const talk = require('./talk');
const dgram = require('dgram');
const config = require('./config');
const APIKEY= process.env.DOCOMO_API_KEY || config.docomo.api_key;

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
	speech.recording = true;
});

talk.on('talk', function() {
	speech.recording = false;
});

speech.on('data', function(data) {
  console.log(data);
});

const app = express()

app.use(bodyParser.json())

app.post('/docomo-chat', (req, res) => {
  console.log('/docomo-chat');
  console.log(req.body);
  
  const direction = req.body.direction || null;

  function talkPlay() {
  	chat(req.body.payload, context, function(err, body) {
      var utt = req.body.payload+'がどうかしましたか。';
  		if (err) {
  		} else {
        utt = body.utt;
  			context = body.context;
  		}
      servoAction('talk', direction, () => {
      	talk.play(utt, () => {
          servoAction('idle');
          res.send('OK');
      	});
      });
  	})
  }
  talkPlay();
});

app.post('/text-to-speech', (req, res) => {
  console.log('/text-to-speech');
  console.log(req.body);
  
  const direction = req.body.direction || null;

  function talkPlay() {
    servoAction('talk', direction, () => {
    	talk.play(req.body.payload, () => {
        servoAction('idle');
        res.send('OK');
    	});
    });
  }
  talkPlay();
});

app.post('/speech-to-text', (req, res) => {
  console.log('/speech-to-text');
  console.log(req.body);
  
  const timeout = req.body.timeout || 30000;
  
  var done = false;
  
  setTimeout(() => {
    if (!done) {
      res.send('');
      speech.removeListener('data', listener);
    }
    done = true;
  }, timeout);
  
  speech.recording = true;
  
  function listener(data) {
    if (!done) {
      res.send(data);
      speech.removeListener('data', listener);
    }
    done = true;
  }
  
  speech.on('data', listener);
});

app.listen(3090, () => console.log('Example app listening on port 3090!'))
