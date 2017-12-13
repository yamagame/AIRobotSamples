# はじめてのおしゃべりAIロボットプログラミング講座のサンプル

Node-Red からロボットを制御するための Node-Red のモジュールです。

# インストール

~/.node-red/node_modules フォルダに robot-controller というフォルダを作ってその中にこのフォルダに入っているファイルをコピーします。

npm install コマンドを使って、必要なモジュールをインストールします。

node-red を再起動すると、robot モジュールが追加されます。

# 使い方

ラズベリーパイ側で以下の２つのプログラムを実行しておく必要があります。

```
$ node robot-server.js
```

```
$ sudo node servo-head.js
```

# 追加されるノード

### text-to-speech

ロボットに payload を送って発話させます。

### speech-to-text

マイクで音声を拾って playload に聞き取った文字列をセットします。

### robot-listener

接続する先のロボットを設定します。  
デフォルトは localhost:3090 です。

### utterance

入力した文章をロボットに送って発話します。

### docomo-chat

ドコモの雑談対話APIに payload の文字列を送って発話します。

# ライセンス

[MIT](../LICENSE)
