const EventEmitter = require('events');
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request-promise');
const speech = (() => (process.env['SPEECH'] === 'off') ? (new EventEmitter()) : require('./speech'))();
const talk = require('./talk');
const dgram = require('dgram');
const config = require('./config');
const APIKEY= config.docomo.api_key;
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const buttonClient = require('./button-client')();
const HOME = (process.platform === 'darwin') ? path.join(process.env.HOME, 'Documents', 'AIRobot') : process.env.HOME;
const PICT = (process.platform === 'darwin') ? path.join(process.env.HOME, 'Pictures', 'AIRobot') : path.join(process.env.HOME, 'Pictures');
const mkdirp = require('mkdirp');
const Dora = require('dora');
const dora = new Dora();

dora.request = async function(command, options, params) {
  var len = 0;
  if (typeof command !== 'undefined') len += 1;
  if (typeof options !== 'undefined') len += 1;
  if (typeof params !== 'undefined') len += 1;
  if (len <= 0) {
    throw new Error('Illegal arguments.');
  }
  const opt = {
    method: 'POST',
    restype: 'json',
  }
  if (len == 1) {
    params = command;
    command = 'command';
  }
  if (len == 2) {
    params = options;
  }
  if (options) {
    if (options.method) opt.method = options.method;
    if (options.restype) opt.restype = options.restype;
  }
  const body = await request({
    uri: `http://localhost:3090/${command}`,
    method: opt.method,
    body: params,
    json: true,
  });
  console.log(body);
  return body;
}

const quiz_master = process.env.QUIZ_MASTER || '_quiz_master_';

var context = null;
var led_mode = 'auto';

talk.dummy = (process.env['SPEECH'] === 'off' && process.env['MACINTOSH'] !== 'on');
talk.macvoice = (process.env['MACINTOSH'] === 'on');

var robotDataPath = process.argv[2] || 'robot-data.json';

const m = function() {
  let res = {};
  for (let i = 0; i < arguments.length; ++i) {
    if (arguments[i]) Object.assign(res, arguments[i]);
  }
  return res;
};

try {
var robotJson = fs.readFileSync(robotDataPath);
} catch(err) {
}
if (robotJson) {
  var robotData = JSON.parse(robotJson);
} else {
  var robotData = {};
}
if (typeof robotData.quizAnswers === 'undefined') robotData.quizAnswers = {};
if (typeof robotData.quizEntry === 'undefined') robotData.quizEntry = {};
if (typeof robotData.quizPayload === 'undefined') robotData.quizPayload = {};
if (typeof robotData.quizList === 'undefined') robotData.quizList = {};

var saveTimeout = null;
var savedData = null;

var students = (function() {
  try {
    var d = fs.readFileSync('quiz-student.txt');
    return d.toString().split('\n').map( v => {
      if (v == '-') {
        return {
          name: '-',
          kana: '',
        }
      }
      const t = v.match(/(.+)\((.+)\)/);
      if (!t) return null;
      return {
        name: t[1].trim(),
        kana: t[2].trim(),
      }
    }).filter( l => {
      return (l);
    });
  } catch(err) {
  }
  return [];
})();

function writeRobotData() {
  if (saveTimeout == null) {
    const data = JSON.stringify(robotData, null, '  ');
    if (savedData == null || savedData !== data) {
      savedData = data;
      saveTimeout = setTimeout(() => {
        fs.writeFileSync(robotDataPath, data);
        saveTimeout = null;
      }, 1000);
    }
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

var last_led_action = 'led-off';

function servoAction(action, direction, callback) {
  if (process.env['SPEECH'] === 'off') {
    if (callback) callback();
    return;
  }
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
app.use('/images', express.static(PICT))

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
        if (led_mode == 'auto') {
          servoAction('led-off');
          last_led_action = 'led-off';
        }
        servoAction('talk', payload.direction, () => {
          talk.voice = payload.voice;
          talk.play(utt, {
            speed: payload.speed,
            volume: payload.volume,
            voice: payload.voice,
          }, () => {
            // if (led_mode == 'auto') {
            //   servoAction('led-on');
            // }
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
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
      servoAction('talk', payload.direction, () => {
        talk.play(payload.message, {
          speed: payload.speed,
          volume: payload.volume,
          voice: payload.voice,
        }, () => {
          // if (led_mode == 'auto') {
          //   servoAction('led-on');
          // }
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

  led_mode = 'auto';

  var threshold = payload.threshold;
  speech.emit('mic_threshold', threshold.toString('utf-8'));

  function removeListener() {
    speech.removeListener('data', listener);
    speech.removeListener('speech', speechListener);
    speech.removeListener('button', buttonListener);
    buttonClient.removeListener('button', listener);
  }

  if (payload.timeout != 0) {
    setTimeout(() => {
      if (!done) {
        speech.recording = false;
        removeListener();
        if (callback) callback(null, '[timeout]');
        if (led_mode == 'auto') {
          servoAction('led-off');
          last_led_action = 'led-off';
        }
      }
      done = true;
    }, payload.timeout);

    speech.recording = true;
  }

  function listener(data) {
    if (!done) {
      speech.recording = false;
      removeListener();
      if (callback) callback(null, data);
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  function speechListener(data) {
    if (!done) {
      var retval = {
        speechRequest: true,
        payload: data,
      }
      speech.recording = false;
      removeListener();
      if (callback) callback(null, retval);
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  function buttonListener(state) {
    if (state) {
      if (!done) {
        speech.recording = false;
        removeListener();
        if (callback) callback(null, '[canceled]');
        if (led_mode == 'auto') {
          servoAction('led-off');
          last_led_action = 'led-off';
        }
      }
      done = true;
    }
  }

  function listenerButton(data) {
    if (!done) {
      data.button = true;
      removeListener();
      if (callback) callback(null, data);
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  if (led_mode == 'auto') {
    if (payload.timeout > 0) {
        servoAction('led-on');
        last_led_action = 'led-on';
    } else {
        servoAction('led-off');
        last_led_action = 'led-off';
    }
  }

  buttonClient.on('button', listenerButton);
  speech.on('data', listener);
  speech.on('speech', speechListener);
  speech.on('button', buttonListener);
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
    speed: req.body.speed || null,
    volume: req.body.volume || null,
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
    threshold: (typeof req.body.payload.sensitivity === 'undefined') ? 2000 : req.body.payload.sensitivity,
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

app.post('/speech', (req, res) => {
  speech.emit('speech', req.body.toString('utf-8'));
  res.send('OK');
});

/* マイクによる音声認識の閾値を変更する
   閾値が0に近い程マイクの感度は高くなる

   curlコマンド使用例
   $ curl -X POST --data '200' http://192.168.X.X:3090/mic-threshold
*/
app.post('/mic-threshold', (req, res) => {
  speech.emit('mic_threshold', req.body.toString('utf-8'));
  res.send('OK');
})

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
      const _download = spawn('/usr/bin/curl', [`-o`, path.join(HOME, 'Documents', s.filename), `-L`, `${url}`]);
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
  if (payload.action === 'auto') {
    led_mode = 'auto';
  }
  if (payload.action === 'off') {
    led_mode = 'manual';
    servoAction('led-off');
    last_led_action = 'led-off';
  }
  if (payload.action === 'on') {
    led_mode = 'manual';
    servoAction('led-on');
    last_led_action = 'led-on';
  }
  if (payload.action === 'blink') {
    led_mode = 'manual';
    servoAction('led-blink');
    last_led_action = 'led-blink';
  }
}

function execSoundCommand(payload) {
  const sound = (typeof payload.play !== 'undefined') ? payload.play : payload.sound;
  if (typeof sound !== 'undefined') {
    const base = `${HOME}/Sound`;
    const p = path.normalize(path.join(base, sound));
    if (p.indexOf(base) == 0) {
      console.log(`/usr/bin/aplay ${p}`);
      const _playone = spawn('/usr/bin/aplay', [p]);
      _playone.on('close', function(code) {
        console.log('close', code);
      });
    }
  }
}

function quizPacket(payload) {
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
    const result = quizPacket({
      action: 'entry',
      name: quiz_master,
    });
    io.emit('quiz', result);
    setTimeout(() => {
      io.emit('quiz-reload-entry');
    }, 3000);
    return result;
  }
  if (payload.action === 'quiz-init') {
    //クイズデータの保存
    if (payload.quizId) {
      if (!robotData.quizList) {
        robotData.quizList = {};
      }
      if (!robotData.quizList[payload.quizId]) {
        robotData.quizList[payload.quizId] = {}
      }
      if (payload.quizName) {
        robotData.quizList[payload.quizId].name = payload.quizName;
      }
      if (payload.pages) {
        if (!robotData.quizList[payload.quizId].quiz) {
          robotData.quizList[payload.quizId].quiz = {}
        }
        payload.pages.forEach( page => {
          if (page.action == 'quiz' && page.question) {
            robotData.quizList[payload.quizId].quiz[page.question] = {
              choices: page.choices,
              answers: page.answers,
            }
          }
        })
      }
      writeRobotData();
    }
    payload.quizStartTime = new Date();
  }
  if (payload.action === 'quiz-ranking') {
    if (typeof payload.quizId !== 'undefined') {
      payload.quizAnswers = robotData.quizAnswers[payload.quizId];
      //ゲストプレイヤーはランキングから外す
      const ret = {};
      if (payload.quizAnswers) {
        Object.keys(payload.quizAnswers).forEach( quizId => {
          const players = payload.quizAnswers[quizId];
          ret[quizId] = {}
          if (players) {
            Object.keys(players).forEach( clientId => {
              const player = players[clientId];
              if (player.name.indexOf('ゲスト') != 0
              && player.name.indexOf('guest') != 0
              && player.name.indexOf('学生講師') != 0) {
                ret[quizId][clientId] = player;
              }
            });
          }
        });
      }
      payload.quizAnswers = ret;
    } else {
      payload.quizAnswers = robotData.quizAnswers;
    }
    payload.name = quiz_master;
  }
  if (payload.members) {
    payload.members = students.map( v => v.name );
  }
  return payload;
}

function storeQuizPayload(payload)
{
  if (payload.name !== quiz_master) {
    robotData.quizPayload['others'] = m(robotData.quizPayload['others'], payload);
  }
  robotData.quizPayload[quiz_master] = m(robotData.quizPayload[quiz_master], payload);
  writeRobotData();
}

function loadQuizPayload(payload)
{
  if (payload.name == quiz_master) {
    var val = robotData.quizPayload[quiz_master] || {};
  } else {
    var val = robotData.quizPayload['others'] || {};
  }
  val.members = students.map( v => v.name );
  return m(val, { initializeLoad: true, });
}

app.post('/result', (req, res) => {
  if (req.body.type === 'answers') {
    if (req.body.quizId) {
      const quizAnswers = robotData.quizAnswers[req.body.quizId];
      if (req.body.startTime) {
        //スタート時間が同じものだけを返す
        const result = {};
        Object.keys(quizAnswers).map( quiz => {
          const qq = quizAnswers[quiz];
          const tt = {};
          Object.keys(qq).forEach( clientId => {
            const answer = qq[clientId];
            if (answer.quizStartTime === req.body.startTime) {
              tt[clientId] = answer;
            }
          });
          if (Object.keys(tt).length > 0) {
            result[quiz] = tt;
          }
        });
        const question = (robotData.quizList) ? robotData.quizList[req.body.quizId] : null;
        res.send({ answers: result, question: question });
      } else {
        //スタート時間のリストを返す
        const result = {};
        Object.keys(quizAnswers).map( quiz => {
          const qq = quizAnswers[quiz];
          Object.keys(qq).forEach( clientId => {
            result[qq[clientId].quizStartTime] = true;
          })
        })
        res.send({ startTimes: Object.keys(result) });
      }
    } else {
      //クイズIDを返す
      res.send({ quizIds: Object.keys(robotData.quizAnswers)})
    }
    return;
  }
  res.send({ status: 'OK' });
})

app.post('/command', (req, res) => {
  if (req.body.type === 'quiz') {
    const payload = quizPacket(req.body);
    storeQuizPayload(payload);
    io.emit('quiz', payload);
    if (req.body.action == 'quiz-ranking') {
      res.send(payload.quizAnswers);
      return;
    }
    if (req.body.action == 'quiz-init') {
      res.send(payload.quizStartTime);
      return;
    }
  }
  if (req.body.type === 'led') {
    changeLed(req.body);
  }
  if (req.body.type === 'button') {
    buttonClient.doCommand(req.body);
  }
  if (req.body.type === 'movie') {
    if (playerSocket) {
      playerSocket.emit('movie', req.body, (data) => {
        res.send(data);
      });
      return;
    } else {
      res.send({ state: 'none' });
      return;
    }
  }
  if (req.body.type === 'sound') {
    execSoundCommand(req.body);
  }
  if (req.body.type === 'scenario') {
    const { action } = req.body;
    if (action == 'play') {
      dora.stop();
      function emitError(err) {
        console.log(err);
        console.log(dora.errorInfo());
        err.info = dora.errorInfo();
        if (!err.info.reason) {
          err.info.reason = err.toString();
        }
        io.emit('scenario_status', {
          err: err.toString(),
          lineNumber: err.info.lineNumber,
          code: err.info.code,
          reason: err.info.reason,
        });
      }
      try {
        const { filename, range, name } = req.body;
        const base = `${HOME}/Documents`;
        const username = (name) ? path.basename(name) : null;
        fs.readFile(path.join(base, username, filename), (err, data) => {
          if (err) {
            emitError(err);
            return;
          }
          dora.parse(data.toString(), function (filename, callback) {
            fs.readFile(path.join(base, username, filename), (err, data) => {
              if (err) {
                emitError(err);
                return;
              }
              callback(data.toString());
            });
          }).then(()=> {
            dora.play({}, {
              socket: localSocket,
              range,
            }, (err, msg) => {
              if (err) {
                emitError(err);
                console.log(`${err.info.lineNumber}行目でエラーが発生しました。\n\n${err.info.code}\n\n${err.info.reason}`);
              } else {
                io.emit('scenario_status', {
                  message: msg,
                });
                console.log(msg);
              }
            });
          }).catch((err) => {
            emitError(err);
          });
        });
      } catch(err) {
        emitError(err);
      }
    }
    if (action == 'stop') {
      dora.stop();
      //talk.stop();
      //servoAction('idle');
      speech.emit('data', 'stoped');
      if (playerSocket) {
        playerSocket.emit('movie', { action: 'cancel', }, (data) => {
        });
      }
    }
  }
  res.send({ status: 'OK' });
})

app.post('/scenario', (req, res) => {
  const base = `${HOME}/Documents`;
  const username = (req.body.name) ? path.basename(req.body.name) : null;
  const filename = (req.body.filename) ? path.basename(req.body.filename) : null;
  if (students.some( m => m.name === username ) || config.free_editor) 
  {
    if (req.body.action == 'save') {
      if (typeof req.body.text !== 'undefined') {
        if (filename) {
          mkdirp(path.join(base, username), function(err) {
            fs.writeFile(path.join(base, username, filename), req.body.text, (err) => {
              res.send({ status: (!err) ? 'OK' : err.code, });
            });
          });
        } else {
          res.send({ status: 'Not found filename', });
        }
      } else {
        res.send({ status: 'No data', });
      }
    } else
    if (req.body.action == 'load') {
      if (filename) {
        mkdirp(path.join(base, username), function(err) {
          fs.readFile(path.join(base, username, filename), (err, data) => {
            res.send({ status: (!err) ? 'OK' : err.code, text: (data) ? data.toString() : '', });
          });
        });
      } else {
        res.send({ status: 'Not found filename', });
      }
    } else
    if (req.body.action == 'list') {
      mkdirp(path.join(base, username), function(err) {
        fs.readdir(path.join(base, username), (err, items) => {
          res.send({ status: (!err) ? 'OK' : err.code, items: items.filter( v => v.indexOf('.') !== 0 ), });
        });
      });
    } else {
      res.send({ status: 'OK' });
    }
  } else {
    res.send({ status: `No name: ${username}` });
  }
})

const server = require('http').Server(app);
const io = require('socket.io')(server);

const iop = io.of('player');
var playerSocket = null;

iop.on('connection', function (socket) {
  console.log('connected iop');
  playerSocket = socket;
  socket.on('disconnect', function () {
    playerSocket = null;
    console.log('disconnect iop');
  });
});

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
        threshold: (typeof payload.sensitivity === 'undefined') ? 2000 : payload.sensitivity,
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
    const result = quizPacket(payload);
    storeQuizPayload(result);
    io.emit('quiz', result);
    if (callback) callback();
  });
  socket.on('led-command', function(payload, callback) {
    changeLed(payload);
    if (callback) callback();
  });
  socket.on('sound-command', (payload, callback) => {
    execSoundCommand(payload);
    if (callback) callback();
  })
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
        io.emit('quiz', quizPacket({
          action: 'entry',
          name: quiz_master,
        }));
        socket.emit('quiz', loadQuizPayload(payload));
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

const gpioSocket = (function() {
  const io = require('socket.io-client');
  return io('http://localhost:3091');
})();

var shutdownTimer = null;
var shutdownLEDTimer = null;
var doShutdown = false;

gpioSocket.on('button', (payload) => {
  console.log(payload);
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
  if (shutdownLEDTimer) {
    clearTimeout(shutdownLEDTimer);
    shutdownLEDTimer = null;
  }
  if (payload.state) {
    if (shutdownTimer) clearTimeout(shutdownTimer);
    shutdownTimer = setTimeout(() => {
      gpioSocket.emit('led-command', { action: 'power' });
      //さらに５秒間押し続け
      if (shutdownLEDTimer) {
        clearTimeout(shutdownLEDTimer);
        shutdownLEDTimer = null;
      }
      shutdownLEDTimer = setTimeout(() => {
        gpioSocket.emit('led-command', { action: 'on' });
        //シャットダウン
        doShutdown = true;
        servoAction('stop');
        setTimeout(() => {
          const _playone = spawn('/usr/bin/sudo', ['shutdown', 'now']);
          _playone.on('close', function(code) {
            console.log('shutdown done');
          });
          doShutdown = false;
        }, 5000)
      }, 5*1000);
    }, 5*1000);
  } else {
    if (!doShutdown) {
      if (last_led_action) {
        servoAction(last_led_action);
      }
    }
  }
  if (!doShutdown) {
    speech.emit('button', payload.state);
  }
});

const ioClient = require('socket.io-client');
const localSocket = ioClient('http://localhost:3090');

localSocket.on('connect', () => {
  console.log('connected');
});
