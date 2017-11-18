//オウム返し対話
const talk = require('./talk');
const speech = require('./speech');
const dgram = require('dgram');
const client = dgram.createSocket('udp4');
const config = require('./config');

var utterance = null;

client.on('message', function (message, remote) {
  console.log(remote.address + ':' + remote.port +' - ' + message);
  if (message == 'talk') {
    setTimeout(function() {
    	talk.play(utterance);
    }, 300);
  }
});

function servoAction(action) {
  client.send(action, 0, action.length, config.udp.port, config.udp.host, (err) => {
  });
}

talk.on('idle', function() {
	speech.recording = true;
	servoAction('idle');
});

talk.on('talk', function() {
	speech.recording = false;
});

speech.on('data', function(data) {
	speech.recording = false;
  utterance = data;
	servoAction('talk');
});
