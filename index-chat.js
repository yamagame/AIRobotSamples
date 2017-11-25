//ドコモ雑談APIとの対話
const talk = require('./talk');
const speech = require('./speech');
const request = require('request');
const config = require('./config');
const APIKEY= config.docomo.api_key;

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
    console.log('docomo:'+utt);
    talk.play(utt);
	})
});
