const mecab_parser = require('./mecab-parser');
const sentense = process.argv[2] || "こんにちは";
const talk = require('./talk');

const utters = [
  '(subject)^知る~テル(last)=',
  '(subject)$ヲ^知る~テル(last)=',
  '(subject)^知る~テル(last)=',
  '(subject)^わかる(last)=',
  '(subject)$ヲ^教える$テ(last)=',
  '(subject)^教える$テ(last)=',
  '(subject)$ハ(last)=',
]

mecab_parser(sentense, (err, result) => {
  for (i=0;i<utters.length;i++) {
    var ret = result.match(utters[i]);
    if (ret) {
      talk.play(`${ret.subject.net.text.join('')}を知りたい`);
      break;
    }
  }
});
