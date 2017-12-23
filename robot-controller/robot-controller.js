const request = require('request');
const io = require('socket.io-client');
const mecab_proc = require('./mecab-proc');

const requestTimeout = 3000;
const connectTimeout = 30000;

var sockets = {};

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}

function timeout(timeout, callback) {
  var done = false;
  setTimeout(() => {
    if (done) return;
    done = true;
    callback(new Error('timeout'), null);
  }, timeout);
  return function(socket) {
    if (done) return;
    done = true;
    callback(null, socket);
  }
}

function removeSocket(host, id, node) {
  node.log(id);
  const t = sockets[host];
  if (t) {
    if (t.node[id]) {
      delete t.node[id];
      if (Object.keys(t.node).length <= 0) {
        t.socket.close();
        delete sockets[host];
        node.log('socket close');
      }
    }
  }
}

function createSocket(host, id, node, callback) {
  node.log(id);
  if (sockets[host]) {
    const t = sockets[host];
    t.node[id] = true;
    if (t.socket.connected) {
      if (callback) callback(t.socket);
    }
    return t.socket;
  }
  const socket = io(host);
  socket.on('connect', function(){
    node.log('socket connect');
    if (callback) callback(socket);
  });
  socket.on('event', function(data){
    node.log('socket event');
  });
  socket.on('disconnect', function(){
    node.log('socket disconnect');
  });
  const q = {}
  q[id] = true;
  sockets[host] = {
    socket: socket,
    node: q,
  }
  return socket;
}

function getId(node, name) {
  return ((Math.random() * 999999) | 0)+'-'+name;
}

//Socket.IOによる接続
function _request(node, action, host, body, callback) {
  if (!host) host = 'http://localhost:3090';
  const id = getId(node, action);
  const socket = createSocket(host, id, node, timeout(requestTimeout, (err, socket) => {
    if (err) {
      callback(null, '');
      return;
    }
    node.log('emit '+action);
    socket.emit(action, body, (data) => {
      setTimeout(() => {
        removeSocket(host, id, node);
      }, connectTimeout);
      callback(null, data);
    });
  }));
}

class Play {
  constructor(){
    this.org_message = null;
  }

  textToSpeech(node, message, host, params, callback) {
    params.message = message;
    _request(node, 'text-to-speech', host, params, callback);
  }

  delay(time, callback) {
    setTimeout(() => {
      callback(null, 'OK');
    }, time);
  }

  nextPage(node, host, callback) {
    _request(node, 'command', host, {
      command: 'right-key.cmd',
      args: '',
    }, callback);
  }

  prevPage(node, host, callback) {
    _request(node, 'command', host, {
      command: 'left-key.cmd',
      args: '',
    }, callback);
  }

  topPage(node, host, callback) {
    _request(node, 'command', host, {
      command: 'page-key.cmd',
      args: '1',
    }, callback);
  }

  openPage(node, host, page, callback) {
    _request(node, 'command', host, {
      command: 'page-key.cmd',
      args: page,
    }, callback);
  }

  doShuffle() {
    for (var i=0;i<this.shuffle.length*10;i++) {
      const a = getRndInteger(0, this.shuffle.length);
      const b = getRndInteger(0, this.shuffle.length);
      const c = this.shuffle[a];
      this.shuffle[a] = this.shuffle[b];
      this.shuffle[b] = c;
    }
    this.shufflePtr = 0;
  }

  getMessage(messages) {
    if (this.org_message == null || this.org_message != messages) {
      this.org_message = messages;
      const res = [];
      this.shuffle = [];
      messages.split('\n').forEach( (line, i) => {
        res.push(line.split(':'));
        this.shuffle.push(i);
      });
      this.messages = res;
      this.doShuffle();
    }
    return this.messages;
  }

  request(node, host, params, callback) {
    const messages = this.getMessage(params.message);
    if (params.algorithm === 'shuffle') {
      let msg = messages[this.shuffle[this.shufflePtr]][0];
      this.textToSpeech(node, msg, host, params, callback);
      this.shufflePtr++;
      if (this.shufflePtr >= this.shuffle.length) {
        this.doShuffle();
      }
    } else
    if (params.algorithm === 'random') {
      let msg = messages[getRndInteger(0, messages.length)][0];
      this.textToSpeech(node, msg, host, params, callback);
    } else
    if (params.algorithm === 'onetime') {
      if (this.shufflePtr < this.shuffle.length) {
        let msg = messages[this.shuffle[this.shufflePtr]][0];
        this.textToSpeech(node, msg, host, params, callback);
        this.shufflePtr++;
      } else {
        callback(null, 'END');
      }
    } else {
      var i = 0;
      const play = () => {
        if (i >= messages.length) {
          callback(null, 'OK');
          return;
        }
        var msg = '';
        var cmd = [];
        for (;i<messages.length;i++) {
          if (messages[i][0] !== '') {
            if (msg !== '') msg += "\n";
            msg += messages[i][0];
          }
          if (messages[i].length > 1) {
            messages[i].forEach( v => {
              cmd.push(v);
            });
            cmd = cmd.slice(1);
            i++;
            break;
          }
        }
        const doCmd = () => {
          if (cmd.length <= 0) {
            play();
            return;
          }
          const d = cmd.shift().trim();
          const page = d.match('(\\d+)page') || d.match('(\\d+)ページ');
          var delay = d.match('(\\d+)s') || d.match('(\\d+)秒');
          if (delay == null) {
            delay = d.match('(\\d+)');
          } else {
            delay = parseInt(delay)*1000;
          }
          if (d == 'next' || d.indexOf('次') >= 0) {
            this.nextPage(node, host, (err, res) => {
              if (err) {
                callback(err, 'ERR');
                return;
              }
              doCmd();
            });
          } else
          if (d == 'prev' || d.indexOf('前') >= 0) {
            this.prevPage(node, host, (err, res) => {
              if (err) {
                callback(err, 'ERR');
                return;
              }
              doCmd();
            });
          } else
          if (d == 'top' || d.indexOf('トップ') >= 0) {
            this.topPage(node, host, (err, res) => {
              if (err) {
                callback(err, 'ERR');
                return;
              }
              doCmd();
            });
          } else
          if (page !== null) {
            this.openPage(node, host, page[1], (err, res) => {
              if (err) {
                callback(err, 'ERR');
                return;
              }
              doCmd();
            });
          } else
          if (delay !== null) {
            this.delay(parseInt(delay[1]), (err, res) => {
              if (err) {
                callback(err, 'ERR');
                return;
              }
              doCmd();
            });
          } else {
            doCmd();
          }
        }
        node.log(cmd);
        if (msg == '') {
          if (cmd.length > 0) {
            doCmd();
          } else {
            play();
          }
        } else {
          this.textToSpeech(node, msg, host, params, (err, res) => {
            if (err) {
              callback(err, 'ERR');
              return;
            }
            if (cmd.length > 0) {
              doCmd();
            } else {
              play();
            }
          });
        }
      }
      play();
    }
  }
}

module.exports = function(RED) {
  "use strict";
  var net = require('net');

  function getParams(param, config) {
    if (typeof config === 'undefined') {
      config = {};
    }
    if (typeof config.voice !== 'undefined' && config.voice !== 'keep') {
      param.voice = config.voice;
    }
    if (typeof config.talkspeed !== 'undefined' && config.talkspeed !== 'keep') {
      param.talkspeed = config.talkspeed;
    }
    if (typeof config.volume !== 'undefined' && config.volume !== 'keep') {
      param.volume = config.volume;
    }
    if (typeof config.direction !== 'undefined' && config.direction !== 'keep') {
      param.direction = config.direction;
    }
    if (typeof config.silence !== 'undefined' && config.silence !== 'keep') {
      param.silence = config.silence;
    }
    if (typeof config.algorithm !== 'undefined' && config.algorithm !== 'keep') {
      param.algorithm = config.algorithm;
    }
    return param;
  }

  function RobotListenerNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.host = config.host;
    node.log(`${node.host}`);
    node.on("input", function(msg) {
      const id = getId(node, 'RobotListenerNode');
      const socket = createSocket(node.host, id, node, timeout(requestTimeout, (err, socket) => {
        if (err) {
          removeSocket(node.host, id, node);
          node.send(msg);
          return;
        }
        setTimeout(() => {
          removeSocket(node.host, id, node);
        }, connectTimeout);
        msg.robotHost = node.host;
        node.send(msg);
      }));
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("robot-listener",RobotListenerNode);

  function VoiceNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var params = getParams({}, config);
    node.voice = config.voice;
    node.log(`${node.voice}`);
    node.on("input", function(msg) {
      msg.robotParams = params;
      node.send(msg);
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("robot-voice",VoiceNode);

  //HTTPによる接続
  function _request_http(node, action, host, body, callback) {
    request({
      method: 'POST',
      uri: `${host}/${action}`,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }, function(err, res, body) {
      callback(err, body);
    });
  }

  function TextToSpeechNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.algorithmPlay = new Play();
    var params = {};
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      params.message = msg.payload;
      params = getParams(params, msg.robotParams);
      params = getParams(params, config);
      node.algorithmPlay.request(node, msg.robotHost, params, function(err, res) {
        node.log(res);
        msg.playStatus = res;
        node.send(msg);
        node.status({});
      });
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("text-to-speech",TextToSpeechNode);

  function SpeechToTextNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var param = {};
    if (typeof config.timeout !== 'undefined') {
      param.timeout = config.timeout;
    }
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'speech-to-text', msg.robotHost, param, function(err, res) {
        node.log(res);
        msg.payload = res;
        node.send(msg);
        node.status({});
      });
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("speech-to-text",SpeechToTextNode);

  function UtteranceNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.algorithmPlay = new Play();
    var params = {};
    node.utterance = config.utterance;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      params.message = node.utterance;
      params = getParams(params, msg.robotParams);
      params = getParams(params, config);
      node.algorithmPlay.request(node, msg.robotHost, params, function(err, res) {
        node.log(res);
        msg.playStatus = res;
        node.send(msg);
        node.status({});
      });
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("utterance",UtteranceNode);

  function DocomoChatNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var params = {};
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      params.message = msg.payload;
      params = getParams(params, msg.robotParams);
      params = getParams(params, config);
      _request(node, 'docomo-chat', msg.robotHost, params, function(err, res) {
        msg.utterance = msg.payload;
        msg.payload = res;
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("chat",DocomoChatNode);

  function CommandNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'command', msg.robotHost, {
        command: config.command,
        args: config.args,
      }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("command",CommandNode);

  function OpenSlideNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'command', msg.robotHost, {
        command: 'open-slide.cmd',
        args: config.args,
      }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("open-slide",OpenSlideNode);

  function NextPageNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'command', msg.robotHost, {
        command: 'right-key.cmd',
        args: '',
      }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("next-page",NextPageNode);

  function CloseSlideNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'command', msg.robotHost, {
        command: 'done-key.cmd',
        args: '',
      }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("close-slide",CloseSlideNode);

  function MecabNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    if (config.pattern) {
      node.pattern = config.pattern.split('\n').filter( v => v != '' );
    } else {
      node.pattern = [];
    }
    if (typeof config.intent === 'undefined') {
      node.intent = '';
    } else {
      node.intent = config.intent;
    }
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      mecab_proc(msg.payload, [ [node.intent, node.pattern], ] , function(err, res) {
        node.log(res);
        msg.subject = res.subject;
        msg.subjects = res.subjects;
        if (res.intent !== '') {
          msg.intent = res.intent;
        }
        if (res.match) {
          node.send([msg, null]);
        } else {
          node.send([null, msg]);
        }
        node.status({});
      });
    });
    this.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("mecab",MecabNode);

}
