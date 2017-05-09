var _ = require('underscore');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 2031;
var bs = require('binarysearch');
var Player = require('./player.js');
var MatchState = require('./matchstate.js');
var bodyParser = require('body-parser');
var session = require('express-session');

app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  resave: true, // don't save session if unmodified  
  saveUninitialized: false, // don't create session until something stored  
  secret: 'love'
}));
app.use(function (req, res, next) {
  if (!req.session.name) {
    if (req.url == "/login" || req.url == "/register") {
      next(); //如果请求的地址是登录则通过，进行下一个请求  
    } else {
      res.redirect('/login');
    }
  } else {
    next();
  }
});
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/homepage.html');
});
app.get('/register', function (req, res) {
  res.sendFile(__dirname + '/register.html');
});
app.post('/register', function (req, res) {
  let name = req.body.name;
  let password = req.body.password;
  let email = req.body.email;
  let newPlayer = new Player({
    name: name,
    password: password,
    email: email
  });
  let state = new MatchState({
    name: name,
    score: 0
  });
  state.save();
  newPlayer.save(function (err) {
    if (err) {
      res.json({
        code: 1,
        msg: '用户名已被注册'
      });
    } else {
      res.json({
        code: 0
      });
    }
  });
});
app.get('/login', function (req, res) {
  res.sendFile(__dirname + '/login.html');
});
app.post('/login', function (req, res) {
  let name = req.body.name;
  let password = req.body.password;
  Player.findOne({
    name: name
  }, function (err, player) {
    if (!err) {
      if (player) {
        player.comparePassword(password, function (err, isMatch) {
          if (isMatch) {
            req.session.name = player.name;
            res.json({
              code: 0,
              msg: '登陆成功'
            })
          } else {
            res.json({
              code: 1,
              msg: '用户名不存在或密码错误'
            })
          }
        });
      } else {
        res.json({
          code: 1,
          msg: '用户名不存在或密码错误'
        })
      }
    }
  });
});
app.get('/getinfo', function (req, res) {
  var query = MatchState.findOne({
    name: req.session.name
  });
  var promise = query.exec();
  promise.then(function (doc) {
    res.json(doc);
  });
});

app.get('/logout', function (req, res) {
  req.session = null;
  res.redirect('/login');
});

app.get('/homepage', function (req, res) {
  res.sendFile(__dirname + '/homepage.html');
});
var que = [];
var score_que = [];
var lastRival = {};
var cache = {};

io.on('connection', function (socket) {
  socket.on('join', function (score, id) {
    let test = bs.closest(score_que, score); //查找最近分数最近的对手，返回数组位置
    socket.playername = id;
    console.log(id);
    if (test === -1) { //无人等待匹配
      console.log('没人，等待匹配')
      score_que[0] = score;
      que[0] = socket.id;
    } else if ((score_que[test] - score) < 500) { //匹配到旗鼓相当的对手
      let player1 = _.findWhere(io.sockets.sockets, {
        id: socket.id
      });
      let player2 = _.findWhere(io.sockets.sockets, {
        id: que[test]
      });
      if (lastRival[player1.playername] === player2.playername) { //与上场比赛是同一对手，所以不能匹配
        console.log('与上场比赛是同一对手，等待其他匹配');
        let key = bs.insert(score_que, score);
        que.splice(key, 0, socket.id);
      } else {
        console.log('与' + score_que[test] + '分玩家匹配')
        score_que.splice(test, 1); //匹配成功，从等待列表删除
        let player2_id = que.splice(test, 1); //得到的是数组，所以下面使用player2_id[0]
        lastRival[player1.playername] = player2.playername;
        lastRival[player2.playername] = player1.playername;
        player1.emit('match successfully', player2.playername);
        player2.emit('match successfully', player1.playername);
      }
    } else { //差距太大
      console.log('无旗鼓相当的对手，等待匹配')
      let key = bs.insert(score_que, score);
      que.splice(key, 0, socket.id);
    }
    console.log(que);
    console.log(score_que);
    console.log('\n');
  });
  socket.on('cancel', function () {
    let key = _.indexOf(que, socket.id);
    console.log(socket.id + '玩家取消匹配');
    score_que.splice(key, 1);
    que.splice(key, 1);
    console.log(que);
  });
  socket.on('disconnect', function (reason) {
    console.log(reason);
    let key = _.indexOf(que, socket.id);
    if (key != -1) { //未匹配用户断线
      console.log(socket.id + '玩家断线');
      score_que.splice(key, 1); //链接断开，从等待列表删除
      que.splice(key, 1);
      console.log(que);
    } else { //已匹配用户断线

    }
  });
  socket.on('submit', function (playername, rival, myScore, rivalScore) {
    var winner;
    if (Number(myScore) > Number(rivalScore)) winner = 1;
    else if (Number(myScore) == Number(rivalScore)) winner = 0;
    else winner = 2;
    let result = myScore + ':' + rivalScore; //自己的结果
    let rivalResult = rivalScore + ':' + myScore; //对手的结果
    //自己的结果缓存
    cache[playername] = result;
    if (cache[rival]) {
      //存在cache[rival]即对方已经上传成绩
      //双方成绩应该必须一样（但是前后相反）
      let rivalSocket = _.findWhere(io.sockets.sockets, {
        playername: rival
      });
      if (cache[rival] === rivalResult) {
        console.log(winner);
        ScoreCalc(playername, rival, winner, result, rivalResult);
        socket.emit('submit successfully');
        rivalSocket.emit('submit successfully');
        delete cache[playername];
        delete cache[rival];
      } else {
        //提交的成绩不一样,清除缓存等待重新上传
        delete cache[playername];
        delete cache[rival];
        socket.emit('submit wrong');
        rivalSocket.emit('submit wrong');
      }
    } else {
      socket.emit('wait rival submit');
    }
  });
});


function ScoreCalc(player1_name, player2_name, winner, player1_result, player2_result) {
  var query1 = MatchState.findOne({
    name: player1_name
  });
  var promise1 = query1.exec();
  var query2 = MatchState.findOne({
    name: player2_name
  });
  var promise2 = query2.exec();
  Promise.all([promise1, promise2]).then(value => {
    if (winner != 0) { //非平分的情况
      let player1_score = value[0].score;
      let player2_score = value[1].score;
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
      value[0].score = player1_new_score;
      value[0].list.push({
        rival: player2_name,
        matchScore: player1_result
      });
      value[1].score = player2_new_score;
      value[1].list.push({
        rival: player1_name,
        matchScore: player2_result
      });
      value[0].save();
      value[1].save();
    } else { //平分的情况，不用计算直接保存0比0的战绩
      value[0].list.push({
        rival: player2_name,
        matchScore: player1_result
      });
      value[1].list.push({
        rival: player1_name,
        matchScore: player2_result
      });
      value[0].save();
      value[1].save();
    }

  });

}

//等待上传分数，双方都上传后进行分数计算，计算后进入数据库

http.listen(port, function () {
  console.log('listening on *:' + port);
});