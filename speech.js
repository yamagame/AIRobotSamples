const EventEmitter = require('events');
const speech = require('@google-cloud/speech')();
const mic = require('mic');
const config = require('./config');

function Speech() {
  var t = new EventEmitter();
  t.recording = true;

  const requestOpts = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'ja-JP',
      maxAlternatives: 3,
    },
    interimResults: false // If you want interim results, set this to true
  };

  if (config.voice_hat) {
    var device = 'plughw:0,0';
  } else {
    var device = 'plughw:1,0';
  }
  var micInstance = mic({
    'device': device,
    'rate': '16000',
    'channels': '1',
    'debug': false,
    'exitOnSilence': 6,
  });
  var micInputStream = micInstance.getAudioStream();

  var recognizeStream = null;

  micInputStream.on('data', function (data) {
    if (micInputStream.incrConsecSilenceCount() > micInputStream.getNumSilenceFramesExitThresh()) {
      if (recognizeStream) {
        recognizeStream.end();
        recognizeStream = null;
      }
    } else {
      if (recognizeStream == null && t.recording) {
        recognizeStream = speech.streamingRecognize(requestOpts)
          .on('error', console.error)
          .on('data', (data) => {
            if (!t.recording) return;
            if (data.results[0] && data.results[0].alternatives[0]) {
              const alternatives = data.results[0].alternatives.map(v => v);
              const sentence = alternatives.shift();
              t.emit('data', sentence.transcript);
            }
          })
      }
      if (t.recording) {
        recognizeStream.write(data);
      } else {
        if (recognizeStream) {
          recognizeStream.end();
          recognizeStream = null;
        }
      }
    }
  })

  micInputStream.on('error', function (err) {
    console.log("Error in Input Stream: " + err);
  });

  micInputStream.on('startComplete', function () {
    console.log("Got SIGNAL startComplete");
  });

  micInputStream.on('stopComplete', function () {
    console.log("Got SIGNAL stopComplete");
  });

  micInputStream.on('pauseComplete', function () {
    console.log("Got SIGNAL pauseComplete");
  });

  micInputStream.on('resumeComplete', function () {
    console.log("Got SIGNAL resumeComplete");
  });

  micInputStream.on('silence', function () {
    console.log("Got SIGNAL silence");
  });

  micInputStream.on('processExitComplete', function () {
    console.log("Got SIGNAL processExitComplete");
  });

  micInstance.start();

  return t;
}

const sp = Speech();
module.exports = sp;

if (require.main === module) {
  sp.on('data', function (data) {
    console.log(data);
  });
}
