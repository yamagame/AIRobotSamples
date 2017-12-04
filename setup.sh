apt-get update
apt-get upgrade -y
apt-get install npm -y
apt-get install ibus-anthy -y
npm install npm@latest -g
npm install n -g
n latest
export CLOUD_SDK_REPO="cloud-sdk-$(lsb_release -c -s)"
echo "deb http://packages.cloud.google.com/apt $CLOUD_SDK_REPO main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
sudo apt-get update && sudo apt-get install google-cloud-sdk
sudo apt-get install mecab libmecab-dev mecab-ipadic-utf8
git clone https://github.com/yamagame/AIRobotSamples
cd AIRobotSamples
npm i
rpi-update
