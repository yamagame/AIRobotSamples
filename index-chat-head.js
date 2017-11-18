//ドコモ雑談APIとの対話
const talk = require('./talk');
const speech = require('./speech');
const request = require('request');
const dgram = require('dgram');
const client = dgram.createSocket('udp4');
const config = require('./config');
const APIKEY= process.env.DOCOMO_API_KEY || config.docomo.api_key;

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

talk.on('idle', function() {
	speech.recording = true;
	servoAction('idle');
});

talk.on('talk', function() {
	speech.recording = false;
});

speech.on('data', function(data) {
  console.log('you:'+data);
	speech.recording = false;
	chat(data, context, function(err, body) {
    var utt = data+'がどうかしましたか。';
		if (err) {
		} else {
      utt = body.utt;
			context = body.context;
		}
    //console.log('docomo:'+utt);
    //player.play(utt);
    utterance = utt;
    servoAction('talk');
	})
});
