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
const fs = require('fs');
const buttonClient = require('./button-client')();

const quiz_master = process.env.QUIZ_MASTER || '_quiz_master_';

var context = null;

var robotDataPath = process.argv[2] || 'robot-data.json';

try {
var robotJson = fs.readFileSync(robotDataPath);
} catch(err) {
}
if (robotJson) {
  var robotData = JSON.parse(robotJson);
} else {
  var robotData = {
    quizAnswers: {},
    quizEntry: {},
  }
}

var saveTimeout = null;

function writeRobotData() {
  if (saveTimeout == null) {
    saveTimeout = setTimeout(() => {
      fs.writeFileSync(robotDataPath, JSON.stringify(robotData, null, '  '));
      saveTimeout = null;
    }, 1000);
  }
}

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
        if (callback) callback(null, '[timeout]');
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

function quiz_button(payload, callback) {
  var done = false;

  if (payload.timeout != 0) {
    setTimeout(() => {
      if (!done) {
        if (callback) callback(null, '[timeout]');
        buttonClient.removeListener('button', listener);
      }
      done = true;
    }, payload.timeout);
  }

  function listener(data) {
    if (!done) {
      if (callback) callback(null, data);
      buttonClient.removeListener('button', listener);
    }
    done = true;
  }

  buttonClient.on('button', listener);
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

function changeLed(payload) {
  if (payload.action === 'off') {
    servoAction('led-off');
  }
  if (payload.action === 'on') {
    servoAction('led-on');
  }
  if (payload.action === 'blink') {
    servoAction('led-blink');
  }
}

function quizPayload(payload) {
  // if (payload.action === 'result') {
  //   payload.result = quizAnswers[payload.question];
  // }
  if (payload.action === 'entry') {
    payload.entry = Object.keys(robotData.quizEntry).map( key => {
      return {
        clientId: robotData.quizEntry[key].clientId,
        name: robotData.quizEntry[key].name,
      }
    }).filter( v => v.name != quiz_master );
    //payload.name = quiz_master;
  }
  if (payload.action === 'quiz-entry-init') {
    robotData.quizEntry = {};
    writeRobotData();
    io.emit('quiz', quizPayload({
      action: 'entry',
      name: quiz_master,
    }));
    setTimeout(() => {
      io.emit('quiz-reload-entry');
    }, 3000);
  }
  if (payload.action === 'quiz-init') {
    payload.quizStartTime = new Date();
  }
  if (payload.action === 'quiz-ranking') {
    if (typeof payload.quizId !== 'undefined') {
      payload.quizAnswers = robotData.quizAnswers[payload.quizId];
    } else {
      payload.quizAnswers = robotData.quizAnswers;
    }
    payload.name = quiz_master;
  }
  return payload;
}

app.post('/command', (req, res) => {
  if (req.body.type === 'quiz') {
    io.emit('quiz', quizPayload(req.body));
  }
  if (req.body.type === 'led') {
    changeLed(req.body);
  }
  if (req.body.type === 'button') {
    buttonClient.doCommand(req.body);
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
      const cmd = path.normalize(path.join(base, payload.command));
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
    io.emit('quiz', quizPayload(payload));
    if (callback) callback();
  });
  socket.on('led-command', function(payload, callback) {
    changeLed(payload);
    if (callback) callback();
  });
  socket.on('button-command', function(payload, callback) {
    buttonClient.doCommand(payload);
    if (callback) callback();
  });
  socket.on('quiz', function(payload, callback) {
    payload.time = new Date();
    if (typeof payload.question === 'undefined') {
      //参加登録
      if (typeof payload.clientId !== 'undefined') {
        robotData.quizEntry[payload.clientId] = payload;
        writeRobotData();
        io.emit('quiz', quizPayload({
          action: 'entry',
          name: quiz_master,
        }));
      }
    } else {
      if (payload.name === quiz_master) return;
      let quizId = payload.quizId;
      if (robotData.quizAnswers[quizId] == null) {
        robotData.quizAnswers[quizId] = {};
      }
      if (robotData.quizAnswers[quizId][payload.question] == null) {
        robotData.quizAnswers[quizId][payload.question] = {};
      }
      const p = { ...payload };
      delete p.question
      delete p.quizId
      robotData.quizAnswers[quizId][payload.question][payload.clientId] = p;
      writeRobotData();
    }
    console.log('quiz', payload);
    if (callback) callback();
  });
  socket.on('quiz-button', function (payload, callback) {
    try {
      quiz_button({
        timeout: (typeof payload.timeout === 'undefined') ? 30000 : payload.timeout,
      }, (err, data) => {
        if (callback) callback(data);
      });
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('stop-quiz-button', function (payload, callback) {
    buttonClient.emit('button', 'stoped');
    if (callback) callback('OK');
  });
});

server.listen(3090, () => console.log('Example app listening on port 3090!'))
