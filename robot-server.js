const EventEmitter = require('events');
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request');
const speech = (() => (process.env['SPEECH'] === 'off') ? (new EventEmitter()) : require('./speech'))();
const talk = require('./talk');
const dgram = require('dgram');
const config = require('./config');
const APIKEY= config.docomo.api_key;
const { exec, spawn } = require('child_process');
const path = require('path');

var context = null;
var quizAnswers = {};

function chat(message, context, tone, callback) {
  const json = {
    utt: message,
  }
  if (context) {
    json.context = context;
  }
  if (tone) {
    json.t = tone;
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

app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.raw({ type: 'application/*' }))

app.use(express.static('public'))

function docomo_chat(payload, callback) {
  if (payload.tone == 'kansai_dialect') {
    var tone = "20";
  } else if (payload.tone == 'baby_talk_japanese') {
    var tone = "30";
  } else {
    var tone = "";
  }
	chat(payload.message, context, tone, function(err, body) {
    var utt = payload.message+'がどうかしましたか。';
    try {
      if (err) {
        console.error(err);
      } else {
        utt = body.utt;
        context = body.context;
      }
      if (payload.silence) {
        if (callback) callback(err, utt);
      } else {
        servoAction('talk', payload.direction, () => {
          talk.voice = payload.voice;
          talk.play(utt, {
            speed: payload.speed,
            volume: payload.volume,
            voice: payload.voice,
          }, () => {
            servoAction('idle');
            if (callback) callback(err, utt);
          });
        });
      }
    } catch(err) {
      console.error(err);
      if (callback) callback(err, '');
    }
	})
}

var playing = false;

function text_to_speech(payload, callback) {
  if (!playing) {
    if (payload.silence) {
      if (callback) callback();
    } else {
      playing = true;
      servoAction('talk', payload.direction, () => {
        talk.play(payload.message, {
          speed: payload.speed,
          volume: payload.volume,
          voice: payload.voice,
        }, () => {
          servoAction('idle');
          playing = false;
          if (callback) callback();
        });
      });
    }
  } else {
    if (callback) callback();
  }
}

function speech_to_text(payload, callback) {
  var done = false;

  if (payload.timeout != 0) {
    setTimeout(() => {
      if (!done) {
        speech.recording = false;
        if (callback) callback(null, '');
        speech.removeListener('data', listener);
      }
      done = true;
    }, payload.timeout);

    speech.recording = true;
  }

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
    speed: req.body.speed || null,
    volume: req.body.volume || null,
    tone: req.body.tone || null,
    direction: req.body.direction || null,
    voice: req.body.voice || null,
    silence: req.body.silence || null,
  }, (err, data) => {
    res.send(data);
  });
});

app.post('/text-to-speech', (req, res) => {
  console.log('/text-to-speech');
  console.log(req.body);

  text_to_speech({
    message: req.body.message,
    speed: payload.speed || null,
    volume: payload.volume || null,
    direction: req.body.direction || null,
    voice: req.body.voice || null,
    silence: req.body.silence || null,
  }, (err) => {
    res.send('OK');
  });
});

app.post('/speech-to-text', (req, res) => {
  console.log('/speech-to-text');
  console.log(req.body);

  speech_to_text({
    timeout: (typeof req.body.payload.timeout === 'undefined') ? 30000 : req.body.payload.timeout,
  }, (err, data) => {
    res.send(data);
  });
});

/*
  speech-to-textノードのデバッグ用
  Google Speech API に問い合わせないで curl コマンドでメッセージを送信できる

  curlコマンド使用例
  $ curl -X POST --data 'こんにちは' http://192.168.X.X:3090/debug-speech
*/
app.post('/debug-speech', (req, res) => {
  speech.emit('data', req.body.toString('utf-8'));
  res.send('OK');
});

/*
  Google Drive の PDFファイルを Documents フォルダにダウンロードする POST リクエスト
 
  curlコマンド使用例
  curl -X POST -d '{"url":"https://drive.google.com/file/d/[FILE-ID]/view?usp=sharing", "filename":"test.pdf"}' http:/192.168.X.X:3090/download-from-google-drive -H "Content-Type:application/json"
*/
app.post('/download-from-google-drive', (req, res) => {
  try {
    const s = req.body;
    const m = s.url.match(/.+\/file\/d\/(.+)\//);
    if (m !== null) {
      if (typeof s.filename === 'undefined') {
        s.filename = 'document.pdf';
      } else {
        s.filename = path.basename(s.filename);
      }
      const url = `https://drive.google.com/uc?export=download&id=${m[1]}`;
      const _download = spawn('/usr/bin/curl', [`-o`, path.join(process.env.HOME, 'Documents', s.filename), `-L`, `${url}`]);
      _download.on('close', function(code) {
        res.send(`${s.filename}`);
      });
    } else {
      res.send(`NG`);
    } 
  } catch(err) {
    res.send(`NG`);
  }
});

app.post('/command', (req, res) => {
  if (req.body.type === 'quiz') {
    if (req.body.action === 'result') {
      req.body.result = quizAnswers[req.body.quizId];
    }
    io.emit('quiz', req.body);
  }
  res.send('OK');
})

const server = require('http').Server(app);
const io = require('socket.io')(server);

io.on('connection', function (socket) {
  console.log('connected');
  socket.on('disconnect', function () {
    speech.recording = false;
    console.log('disconnect');
  });
  socket.on('docomo-chat', function (payload, callback) {
    try {
      docomo_chat({
        message: payload.message,
        speed: payload.speed || null,
        volume: payload.volume || null,
        tone: payload.tone || null,
        direction: payload.direction || null,
        voice: payload.voice || null,
        silence: payload.silence || null,
      }, (err, data) => {
        if (callback) callback(data);
      });
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('text-to-speech', function (payload, callback) {
    try {
      text_to_speech({
        message: payload.message,
        speed: payload.speed || null,
        volume: payload.volume || null,
        direction: payload.direction || null,
        voice: payload.voice || null,
        silence: payload.silence || null,
      }, (err) => {
        if (callback) callback('OK');
      });
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('stop-text-to-speech', function (payload, callback) {
    talk.flush();
    if (callback) callback('OK');
  });
  socket.on('speech-to-text', function (payload, callback) {
    try {
      speech_to_text({
        timeout: (typeof payload.timeout === 'undefined') ? 30000 : payload.timeout,
      }, (err, data) => {
        if (callback) callback(data);
      });
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('stop-speech-to-text', function (payload, callback) {
    speech.emit('data', 'stoped');
    if (callback) callback('OK');
  });
  socket.on('command', function(payload, callback) {
    try {
      const base = path.join(__dirname, 'command');
      const cmd = path.join(base, payload.command);
      const args = payload.args || '';
      if (cmd.indexOf(base) == 0) {
      } else {
        console.log('NG');
        if (callback) callback();
        return;
      }
      exec(`${cmd} ${args}`, (err, stdout, stderr) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log(stdout);
      });
      if (callback) callback();
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('message', function(payload, callback) {
    console.log('message', payload);
    if (callback) callback();
  });
  socket.on('quiz-command', function(payload, callback) {
    if (payload.action === 'result') {
      payload.result = quizAnswers[payload.quizId];
    }
    io.emit('quiz', payload);
    if (callback) callback();
  });
  socket.on('quiz', function(payload, callback) {
    payload.time = new Date();
    if (quizAnswers[payload.quizId] == null) {
      quizAnswers[payload.quizId] = {};
    }
    quizAnswers[payload.quizId][payload.clientId] = payload;
    console.log('quiz', payload);
    if (callback) callback();
  });
});

server.listen(3090, () => console.log('Example app listening on port 3090!'))
