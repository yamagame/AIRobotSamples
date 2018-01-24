#!/bin/bash
cd `dirname $0`
node play-sound.js &
sudo node button-server.js
