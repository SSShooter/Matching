var _ = require('underscore');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 2030;
var bs = require('binarysearch');
var Player = require('./player.js');

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

var que = [];
var score_que = [];

io.on('connection', function (socket) {
  socket.on('join', function (score) {
    let test = bs.closest(score_que, score);
    console.log(score + '分玩家进入游戏');
    if (test === -1) { //无人等待匹配
      console.log('没人，等待匹配')
      score_que[0] = score;
      que[0] = socket.id;
    } else if ((score_que[test] - score) < 500) {
      console.log('与' + score_que[test] + '分玩家匹配')
      score_que.splice(test, 1); //匹配成功，从等待列表删除
      let player2_id = que.splice(test, 1); //得到的是数组
      let player1 = _.findWhere(io.sockets.sockets, {
        id: socket.id
      });
      let player2 = _.findWhere(io.sockets.sockets, {
        id: player2_id[0]
      });
      player1.emit('match successfully');
      player2.emit('match successfully');
    } else { //差距太大
      console.log('无旗鼓相当的对手，等待匹配')
      let key = bs.insert(score_que, score);
      que.splice(key, 0, socket.id);
    }
    // console.log(que);
    // console.log(score_que);
    console.log('\n');
  });
  socket.on('disconnect', function () {
    let key = _.indexOf(que, socket.id);
    if (key != -1) { //未匹配用户断线
      console.log(socket.id + '玩家断线');
      score_que.splice(key, 1); //链接断开，从等待列表删除
      que.splice(key, 1);
      console.log(que);
    } else { //已匹配用户断线

    }
  });
});

function ScoreCalc(player1_score, player2_score, winner) {
  let Ea = 1 / (1 + Math.pow(10, (player2_score - player1_score) / 400));
  let Eb = 1 - Ea;
  let player1_new_score, player2_new_score, change;
  if (winner == 1) {
    change = Math.round(200 * (1 - Ea));
    player1_new_score = player1_score + change;
    player2_new_score = player2_score - change;
  } else {
    change = Math.round(200 * (1 - Eb));
    player1_new_score = player1_score - change;
    player2_new_score = player2_score + change;
  }
  if (player1_new_score < 0) player1_new_score = 0;
  if (player2_new_score < 0) player2_new_score = 0;
  return {
    player1_new_score: player1_new_score,
    player2_new_score: player2_new_score
  };
}

http.listen(port, function () {
  console.log('listening on *:' + port);
});

var ssshooter = new Player({
  name: 'ssshooter',
  password: '6262991210'
});

ssshooter.save(function (err) {
  if (err) console.log('err');
  else console.log('save');
});

Player.findById('5909414056dd933e36d79394',function(err,data){
  console.log(data);
})