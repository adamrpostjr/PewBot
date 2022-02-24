global.Olm = require('olm');
const cfg = require('./config.json');
const sdk = require('matrix-js-sdk');
const axios = require('axios');
const { dockStart } = require('@nlpjs/basic');
const syllables = require('syllables');
const fs = require('fs');
var dock, nlp, client;

const { LocalStorage } = require('node-localstorage');
const { LocalStorageCryptoStore } = require('matrix-js-sdk/lib/crypto/store/localStorage-crypto-store');
const storage = new LocalStorage(cfg.dataStorage);

client = sdk.createClient({
  baseUrl: 'https://matrix.intradatech.com',
  accessToken: cfg.accessToken,
  userId: cfg.username,
  sessionStore: new sdk.WebStorageSessionStore(storage),
  cryptoStore: new LocalStorageCryptoStore(storage),
  deviceId: cfg.deviceID,
});

client.initCrypto().then(() => {
  client.startClient();
});

const init = async () => {
  dock = await dockStart({ use: ['Basic'] });
  nlp = dock.get('nlp');
  nlp.addLanguage('en');
  await nlp.addCorpus('./corpus/en-corpus.json');
  await nlp.train();
};

client.on('sync', async (state, prevState, res) => {
  if (state !== 'PREPARED') return;
  console.log('Started');
  client.setGlobalErrorOnUnknownDevices(false);
  await init();
  client.on('Room.timeline', function (event, room, toStartOfTimeline) {
    if (toStartOfTimeline) {
      return;
    }
    if (event.getType() !== 'm.room.message') {
      return;
    }
    if (event.getSender() != '@pewboto:matrix.intradatech.com' && room.roomId == '!QVqfaQOmTBIRpkSRee:matrix.intradatech.com') {
      let msg = event.getContent().body;
      let msgArr = msg.split(' ')
      let ers = []

      msgArr.forEach(mss => {
        if (mss.endsWith('er')  && syllables(mss) >= 2) {
          ers = [...ers, mss]
        }
      });    


      if (msg.startsWith('!')) {
        replyTo(msg);
      } else if (ers.length) {
        replyHer(ers)
      } else {
        replyWithAI(msg);
      }
    }
  });
});

client.on('RoomMember.membership', function (event, member) {
  if (member.membership === 'invite' && member.userId === cfg.username) {
    client.joinRoom(member.roomId).then(function () {
      console.log('Auto-joined %s', member.roomId);
      config = {
        body: 'The quality of this chat is about to go down hill!',
        msgtype: 'm.text ',
      };
      client.sendEvent(member.roomId, 'm.room.message', config);
    });
  }
});

const replyTo = async (msg) => {
  config = {
    body: '',
    msgtype: 'm.text ',
  };

  if (msg == '!help') {
    config.body = 'Wait!';
  }

  if (msg == '!joke') {
    let joke = await axios.get('https://v2.jokeapi.dev/joke/Any?format=json&type=single&amount=1');
    config.body = joke.data.joke;
  }

  if (msg.toLowerCase().startsWith('!insult')) {
    let name = msg.split('!insult ')[1];
    let insult = await axios.get('https://insult.mattbas.org/api/insult.json?who=' + name);
    config.body = insult.data.insult;
  }

  // if (msg.toLowerCase().includes('pewbot')) {
  //   config.body = '🖕🖕🖕🖕🖕🖕           🖕🖕                           🖕🖕\n🖕🖕🖕🖕🖕🖕           🖕🖕                           🖕🖕\n🖕🖕                             🖕🖕                           🖕🖕\n🖕🖕                             🖕🖕                           🖕🖕\n🖕🖕🖕🖕🖕🖕           🖕🖕                           🖕🖕\n🖕🖕🖕🖕🖕🖕           🖕🖕                           🖕🖕\n🖕🖕                             🖕🖕                           🖕🖕\n🖕🖕                             🖕🖕                           🖕🖕\n🖕🖕                             🖕🖕                           🖕🖕\n🖕🖕                             🖕🖕🖕🖕🖕🖕🖕🖕🖕🖕\n🖕🖕                             🖕🖕🖕🖕🖕🖕🖕🖕🖕🖕.';
  // }

  if (msg.toLowerCase().includes('sales')) {
    config.body = 'There is no better sales man than I!';
  }

  // if (msg.toLowerCase().includes('coffee')) {
  //   // if it includes the word coffee we may be in business -- final checks
  //   let ardMsg = msg.toLowerCase().split(' ');
  //   let cafe = ardMsg.indexOf('coffee');
  //   let intent = ardMsg[cafe - 1];
  //   if (syngs.coffee2.includes(intent)) {
  //   }
  // }

  // if (syngs.coffee.includes(msg.toLowerCase())) {
  //   config.body = 'Make your own coffee!!';
  // }

  if (msg == '!test') {
    config.body = 'sends snowfall ❄';
    config.msgtype = 'm.emote';
    config['org.matrix.msc1767.text'] = 'sends snowfall ❄';
  }

  if (config.body != '') {
    client.sendEvent('!QVqfaQOmTBIRpkSRee:matrix.intradatech.com', 'm.room.message', config);
  } else {
    return;
  }
};

const replyHer = async(msg)=>{
  var item = msg[Math.floor(Math.random()*msg.length)];


  config = {
    body: `${item}..? I hardly know her! 🤣`,
    msgtype: 'm.text ',
  };


  client.sendEvent('!QVqfaQOmTBIRpkSRee:matrix.intradatech.com', 'm.room.message', config);
}

const replyWithAI = async (msg) => {
  // if (msg.toLowerCase().includes('coffee') || msg.toLowerCase().includes('brew') || msg.toLowerCase().includes('joe') || msg.toLowerCase().includes('mug') || msg.toLowerCase().includes('pewbot')) {
  const response = await nlp.process('en', msg);
  if (response.answer) {
    config = {
      body: response.answer,
      msgtype: 'm.text ',
    };
    client.sendEvent('!QVqfaQOmTBIRpkSRee:matrix.intradatech.com', 'm.room.message', config);
  }
  // }
};
