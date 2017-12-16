const EventEmitter = require('events');
const spawn = require('child_process').spawn;
const path = require('path');

function say(words, voice, callback) {
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
			const _playone = spawn(path.join(__dirname,'talk-f2.sh'), [`　${cont}`]);
			_playone.on('close', function(code) {
				playone();
			});
		} else {
			const _playone = spawn(path.join(__dirname,'talk-f1.sh'), [`　${cont}`]);
			_playone.on('close', function(code) {
				playone();
			});
		}
  }
  playone();
}

function play(speech, voice) {
  return new Promise( function(resolve) {
    say(speech, voice, function() {
      resolve(null, 'OK');
    });
  });
}

function Talk() {
	var t = new EventEmitter();
	t.playQue = [];
	t.playing = false;
	t.voice = 'reimu';
	
	t.play = function(sentence, callback) {
		var voice = this.voice;
		if (!voice) voice = 'reimu';
		this.emit('talk');
		if (!this.playing) {
			this.playing = true;
			play(sentence, voice).then(() => {
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
