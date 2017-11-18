const EventEmitter = require('events');
const spawn = require('child_process').spawn;
const path = require('path');

function say(words, callback) {
  const conts = words.split(/。|@|＠|？|\s|\?/g);
  const playone = function() {
    if (conts.length <= 0) {
      callback();
      return;
    }
    const cont = conts.shift();
console.log(cont);
    const _playone = spawn(path.join(__dirname,'talk.sh'), [`　${cont}`]);
    _playone.on('close', function(code) {
      playone();
    });
  }
  playone();
}

function play(speech) {
  return new Promise( function(resolve) {
    say(speech, function() {
      resolve(null, 'OK');
    });
  });
}

function Talk() {
	var t = new EventEmitter();
	t.playQue = [];
	t.playing = false;
	
	t.play = function(sentence, callback) {
		this.emit('talk');
		if (!this.playing) {
			this.playing = true;
			play(sentence).then(() => {
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
