#!/bin/bash
cd `dirname $0`
node voice-bot.js &
sudo node button-gpio.js
