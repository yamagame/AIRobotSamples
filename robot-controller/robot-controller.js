const request = require('request');

module.exports = function(RED) {
  "use strict";
  var net = require('net');

  function RobotListenerNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.host = config.host;
    node.log(`${node.host}`);
    node.on("input", function(msg) {
      msg.robotHost = node.host;
      node.send(msg);
    });
  }
  RED.nodes.registerType("robot-listener",RobotListenerNode);

  function _request(node, action, host, body, callback) {
    if (!host) host = 'http://localhost:3090';
    request({
      method: 'POST',
      uri: `${host}/${action}`,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }, function(err, res, body) {
      callback(err, body);
    });
  }

  function TextToSpeechNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'text-to-speech', msg.robotHost, { payload: msg.payload, direction: config.direction }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
  }
  RED.nodes.registerType("text-to-speech",TextToSpeechNode);

  function SpeechToTextNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var param = {};
    if (typeof config.timeout !== 'undefined') {
      param.timeout = config.timeout;
    }
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'speech-to-text', msg.robotHost, param, function(err, res) {
        node.log(res);
        msg.payload = res;
        node.send(msg);
        node.status({});
      });
    });
  }
  RED.nodes.registerType("speech-to-text",SpeechToTextNode);

  function UtteranceNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.utterance = config.utterance;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'text-to-speech', msg.robotHost, { payload: node.utterance, direction: config.direction }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
  }
  RED.nodes.registerType("utterance",UtteranceNode);

  function DocomoChatNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'docomo-chat', msg.robotHost, { payload: msg.payload, direction: config.direction }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
  }
  RED.nodes.registerType("docomo-chat",DocomoChatNode);

}
