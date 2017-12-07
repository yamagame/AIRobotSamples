const deviceModule = require('aws-iot-device-sdk').device;
// const speech = require('./speech');
const config = require('./config');

const USAGE = `
コマンドの説明
new: 新規アカウント登録
start: ゲーム参加
up: 上に移動
down: 下に移動
left: 左に移動
right: 右に移動
shot: 弾を撃つ
coin: 持っているコインの枚数を表示
help: ヘルプ
`;

const clientId = process.argv[2] || config.mqtt.clientId;
var password = null;

console.log(`start ${clientId}`);

const device = deviceModule({
  keyPath: './credential/AIRobot.private.key',
  certPath: './credential/AIRobot.cert.pem',
  caPath: './credential/root-CA.crt',
  clientId: clientId,
  region: 'us-west-2',
  baseReconnectTimeMs: 4000,
  keepalive: 30,
  protocol: 'mqtts',
  host: 'a20re49ws0utgc.iot.us-west-2.amazonaws.com',
  debug: false
});

device.subscribe('topic');
device.subscribe('topic/gunman/'+clientId);

var connected = false;

device
  .on('connect', function () {
    console.log('connect');
    connected = true;
  });
device
  .on('close', function () {
    console.log('close');
  });
device
  .on('reconnect', function () {
    console.log('reconnect');
  });
device
  .on('offline', function () {
    console.log('offline');
  });
device
  .on('error', function (error) {
    console.log('error', error);
  });
device
  .on('message', function (topic, payload) {
    try {
      const data = JSON.parse(payload.toString());
      //console.log(data);
      if (data.pass) {
        password = data.pass;
      }
      //console.log('message', topic, data.message);
      console.log(data.message);
    } catch(err) {
      console.error(err);
    }
  });

// speech.on('data', function(data) {
//   console.log('you:'+data);
//   device.publish('topic/gunman/'+config.mqtt.targetId, data);
// });

const readline = require('readline');

console.log(USAGE);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
rl.on('line', (input) => {
  if (connected) {
    //console.log(`Published: ${input}`);
    var arg = input.split(' ').filter( v => v != '');
    if (arg[0] == 'help') {
      console.log(USAGE);
    } else {
      var command_json = JSON.stringify({
        account_id: clientId,
        cmd: arg[0],
        value: arg[1],
        pass: password
      });
      device.publish('topic/gunman/playground', command_json);
    }
  } else {
    //console.log(`Received: ${input}`);
  }
});
