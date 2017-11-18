//オウム返し対話
const talk = require('./talk');
const speech = require('./speech');

talk.on('idle', function() {
	speech.recording = true;
});

talk.on('talk', function() {
	speech.recording = false;
});

speech.on('data', function(data) {
	talk.play(data);
});
