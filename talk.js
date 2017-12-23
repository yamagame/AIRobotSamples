const EventEmitter = require('events');
const spawn = require('child_process').spawn;
const path = require('path');

function say(words, params, callback) {
	const voice = params.voice;
	const speed = params.speed;
	const volume = params.volume;
  const conts = words.split(/。|@|＠|？|\s|\?/g);
  const playone = function() {
    if (conts.length <= 0) {
      callback();
      return;
    }
    const cont = conts.shift();
		if (cont == '') {
			playone();
			return;
		}
console.log(cont);
		if (voice == 'marisa') {
			const _playone = spawn(path.join(__dirname,'talk-f2.sh'), [`-s`, speed, `-g`, volume, `　${cont}`]);
			_playone.on('close', function(code) {
				playone();
			});
		} else {
			const _playone = spawn(path.join(__dirname,'talk-f1.sh'), [`-s`, speed, `-g`, volume, `　${cont}`]);
			_playone.on('close', function(code) {
				playone();
			});
		}
  }
  playone();
}

function play(speech, params) {
  return new Promise( function(resolve) {
    say(speech, params, function() {
      resolve(null, 'OK');
    });
  });
}

function Talk() {
	var t = new EventEmitter();
	t.playQue = [];
	t.playing = false;
	t.voice = 'reimu';
	t.speed = 95;
	t.volume = 100;

	t.play = function(sentence, params = {}, callback) {
		if (!params.voice) params.voice = t.voice;
		if (!params.speed) params.speed = t.speed;
		if (!params.volume) params.volume = t.volume;
		this.emit('talk');
		if (!this.playing) {
			this.playing = true;
			play(sentence, params).then(() => {
				if (this.playQue.length > 0) {
					const sentence = this.playQue.shift();
					_play(sentence);
				} else {
					this.playing = false;
					this.emit('idle');
					if (callback) callback();
				}
			});
		} else {
			this.playQue.push(sentence);
		}
	}

	t.flush = function() {
		this.playQue = [];
	}

	return t;
}

module.exports = Talk();
