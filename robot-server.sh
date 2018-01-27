#!/bin/bash
cd `dirname $0`
node robot-server.js &
sudo node servo-head.js
