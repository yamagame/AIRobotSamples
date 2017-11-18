const raspi = require('raspi');
const deviceModule = require('aws-iot-device-sdk').device;
const speech = require('./speech');
const talk = require('./talk');
const config = require('./config');

raspi.init(() => {
  const device = deviceModule({
    keyPath: './credential/AIRobot.private.key',
    certPath: './credential/AIRobot.cert.pem',
    caPath: './credential/root-CA.crt',
    clientId: config.mqtt.clientId,
    region: 'us-west-2',
    baseReconnectTimeMs: 4000,
    keepalive: 30,
    protocol: 'mqtts',
    host: 'a20re49ws0utgc.iot.us-west-2.amazonaws.com',
    debug: false
  });

  device.subscribe('topic');
  device.subscribe('topic/'+config.mqtt.clientId);
  
  device
    .on('connect', function () {
      console.log('connect');
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
      console.log('message', topic, payload.toString());
      talk.play(payload.toString());
    });

  talk.on('idle', function() {
    speech.recording = true;
  });
  
  talk.on('talk', function() {
    speech.recording = false;
  });
        
  speech.on('data', function(data) {
    console.log('you:'+data);
//    speech.recording = false;
    // device.publish('topic/me', data);
    device.publish('topic/'+config.mqtt.targetId, data);
  });

});
