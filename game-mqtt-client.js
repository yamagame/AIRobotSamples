const deviceModule = require('aws-iot-device-sdk').device;
// const speech = require('./speech');
const config = require('./config');

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
rl.on('line', (input) => {
  if (connected) {
    //console.log(`Published: ${input}`);
    var arg = input.split(' ').filter( v => v != '');
    var command_json = JSON.stringify({
      account_id: clientId,
      cmd: arg[0],
      value: arg[1],
      pass: password
    });
    device.publish('topic/gunman/playground', command_json);
  } else {
    //console.log(`Received: ${input}`);
  }
});
