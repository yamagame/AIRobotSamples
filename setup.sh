#!/bin/sh
cd ~

sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install npm -y
sudo npm install n -g
sudo n latest
sudo npm install npm@latest -g

export CLOUD_SDK_REPO="cloud-sdk-$(lsb_release -c -s)"
echo "deb http://packages.cloud.google.com/apt $CLOUD_SDK_REPO main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
sudo apt-get update && sudo apt-get install google-cloud-sdk -y
git clone https://github.com/yamagame/AIRobotSamples
cd AIRobotSamples
npm i

sudo apt-get purge wolfram-engine -y
sudo apt-get install mecab libmecab-dev mecab-ipadic-utf8 -y
sudo apt-get install ibus-anthy -y
sudo apt-get install python-picamera
sudo apt-get install evince -y

pip3 install python3-xlib
pip3 install pyautogui

sudo rpi-update
