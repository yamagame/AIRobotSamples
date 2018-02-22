const io = require('socket.io-client');
const EventEmitter = require('events');
const player = require('./movie-player');
const path = require('path');

const host = process.argv[2] || 'localhost';

function MovieClient() {
  var t = new EventEmitter();

  const socket = io(`http://${host}:3090/player`);
  socket.on('connect', function(){
    console.log('connect', socket.id);
  });
  socket.on('movie', function(data, callback){
    if (data.action === 'play') {
      player.play(path.join(__dirname, '../Movie' ,data.movie));
    } else if (data.action === 'check') {
      if (callback) callback({ state: player.state });
      return;
    } else if (data.action === 'cancel') {
      player.emit('cancel');
    }
    if (callback) callback({ state: player.state });
  });
  socket.on('disconnect', function(){
    console.log('disconnected');
  });

  player.on('done', function () {
    socket.emit('done');
  });

  return t;
}

module.exports = MovieClient;

if (require.main === module) {
  const t = MovieClient();
}
