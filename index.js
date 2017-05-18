var _ = require('underscore');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 80;
var bs = require('binarysearch');
var Team = require('./models/Team.js');
var Player = require('./models/Player.js');
var MatchState = require('./models/matchstate.js');
var bodyParser = require('body-parser');
var session = require('express-session');
var oauth = require('./routes/oauth');
var formidable = require('formidable');
var fs = require('fs');
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
/**
 * 
 */
app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  resave: true, // don't save session if unmodified  
  saveUninitialized: false, // don't create session until something stored  
  secret: 'bugaosuni'
}));

app.use('/oauth', oauth);

app.use(function (req, res, next) {
  if (!req.session.info) {
    if (req.url == "/oauth/wx_login") {
      next(); //如果请求的地址是登录则通过，进行下一个请求  
    } else {
      res.send('请重新授权');
    }
  } else {
    next();
  }
});

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/homepage.html');
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

app.get('/myTeam', function (req, res) {
  res.sendFile(__dirname + '/myTeam.html');
});

app.post('/allow', function (req, res) {
  Player.findOne({
    openid: req.body.id
  }, function (err, doc) {
    doc.status = 2; //身份改为队员
    doc.save(function () {
      res.json({
        code: 0
      });
    });
  });
});

app.post('/disallow', function (req, res) {
  Player.findOne({
    openid: req.body.id
  }, function (err, doc) {
    console.log('disallow');
    doc.status = req.session.status = 0; //身份改为无所属
    doc.save(function () {
      Team.findOne({ //从队员列表移除
        name: req.session.team
      }, function (err, team) {
        team.mate = _.without(team.mate, req.body.id);
        team.save(function () {
          res.json({
            code: 0
          });
        });
      })
    });
  });
});

app.post('/teaminfo', function (req, res) {
  Team.findOne({
    name: req.session.team
  }, function (err, doc) {
    console.log(req.session.status);
    if (err) {
      res.json({
        code: 1,
        msg: '数据库错误',
        err: err
      });
      return;
    }
    matestatePromise = [Player.findOne({
      openid: doc.leader
    }).exec()];
    doc.mate.forEach(function (val) {
      console.log(val);
      matestatePromise.push(Player.findOne({
        openid: val
      }).exec());
    })
    var teamname = doc.name;
    var teamdesc = doc.desc;
    Promise.all(matestatePromise).then(function (value) {
      res.json({
        code: 0,
        msg: 'ok',
        teamname: doc.name,
        teamdesc: doc.descript,
        member: value,
        mystatus: req.session.status
      });
    }, function (err) {
      console.log(err);
    });
  });
});

app.get('/newteam', function (req, res) {
  res.sendFile(__dirname + '/newTeam.html');
});

app.post('/newteam', function (req, res) {
  if (!req.session.openid) {
    res.json({
      code: 1,
      msg: '请重新登录'
    });
  } else {
    let newTeam = new Team(req.body);
    newTeam.save(function (err, doc) {
      if (err) {
        res.json({
          code: 1,
          msg: '数据库错误',
          err: err
        });
      } else {
        //队伍创建成功
        Player.findOne({
          openid: req.session.openid
        }, function (err, doc) {
          doc.team = req.body.name;
          doc.status = req.session.status = 1;
          doc.save();
        })
        req.session.team = req.body.name;
        res.json({
          code: 0,
          msg: doc
        });
      }
    });
  }
});

app.post('/info', function (req, res) {
  var info = req.session.info;
  console.log(info);
  res.json({
    code: 0,
    msg: 'ok',
    info: info
  });
});

app.post('/uploadlogo', function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
    if (err) {
      res.send(err);
      return;
    }
    var extName = ''; //后缀名
    switch (files.upload.type) {
      case 'image/pjpeg':
        extName = 'jpg';
        break;
      case 'image/jpeg':
        extName = 'jpg';
        break;
      case 'image/png':
        extName = 'png';
        break;
      case 'image/x-png':
        extName = 'png';
        break;
    }
    var newName = Date.now() + randomString();
    fs.renameSync(files.upload.path, __dirname + "/public/teamlogo/" + newName + '.' + extName);
    console.log("/public/teamlogo" + newName + '.' + extName);
    res.send('http://www.time-record.net/teamlogo/' + newName + '.' + extName);
  });
});

function randomString(len) {　　
  len = len || 4;　　
  var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'; /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/ 　　
  var maxPos = $chars.length;　　
  var pwd = '';　　
  for (i = 0; i < len; i++) {　　　　
    pwd += $chars.charAt(Math.floor(Math.random() * maxPos));　　
  }　　
  return pwd;
}
app.get('/searchteam', function (req, res) {
  res.sendFile(__dirname + '/searchTeam.html');
});

app.post('/searchteam', function (req, res) {
  let keyword = req.body.keyword;
  if (!keyword) return;
  Team.find({
    name: new RegExp(keyword, 'i')
  }, function (err, doc) {
    if (err) {
      res.json({
        code: 1,
        msg: '出错',
        err: err
      });
    } else {
      if (doc) {
        res.json({
          code: 0,
          msg: 'ok',
          doc: doc
        });
      }
    }
  });
});

app.post('/jointeam', function (req, res) {
  if (!req.session.openid) {
    res.json({
      code: 1,
      msg: '请重新登录'
    });
  } else {
    Player.findOne({
      openid: req.session.openid
    }, function (err, doc) {
      doc.team = req.body.teamname;
      doc.status = req.session.status = 4;
      console.log(req.session.status);
      doc.save(function (err) {
        Team.findOne({
          name: req.body.teamname
        }, function (err, doc) {
          doc.mate.push(req.session.openid);
          doc.save(function () {
            req.session.team = req.body.teamname;
            res.json({
              code: 0,
              msg: 'ok'
            });
          });
        });
      });
    });
  }
});

app.post('/leftteam', function (req, res) { //不用传入参数，使用session解决问题
  if (!req.session.openid) {
    res.json({
      code: 1,
      msg: '请重新登录'
    });
  } else {
    Player.findOne({
      openid: req.session.openid
    }, function (err, doc) {
      doc.team = '';
      doc.status = req.session.status = 0;
      console.log(req.session.status);
      doc.save();
    });
    Team.findOne({
      name: req.session.team
    }, function (err, doc) {
      doc.mate = _.without(doc.mate, req.session.openid);
      doc.save();
    });
    req.session.team = '';
    res.json({
      code: 0,
      msg: 'ok'
    });
  }
});

app.get('/matchInfo', function (req, res) {
  res.sendFile(__dirname + '/matchInfo.html');
});

app.get('/register', function (req, res) {
  res.sendFile(__dirname + '/Register.html');
});

app.post('/register', function (req, res) {
  req.body.openid = req.session.openid;
  req.body.info = req.session.info;
  if (!req.session.openid) {
    res.json({
      code: 1,
      msg: '请重新登录'
    });
  } else {
    let newPlayer = new Player(req.body);
    newPlayer.save(function (err, doc) {
      if (err) {
        res.json({
          code: 1,
          msg: '数据库错误',
          err: err
        });
      } else {
        res.json({
          code: 0,
          msg: doc
        });
      }
    });
  }
});

app.get('/teamselect', function (req, res) {
  res.sendFile(__dirname + '/teamSelect.html');
});

var que = [];
var score_que = [];
var lastRival = {};
var cache = {};

io.on('connection', function (socket) {
  socket.on('online', function (id) {
    socket.Teamname = id; //在socket缓存id
    console.log(socket.Teamname);
  });
  socket.on('join', function (score, id) { //加入匹配存入分数与id
    let test = bs.closest(score_que, score); //查找最近分数最近的对手，返回数组位置
    console.log(id);
    if (test === -1) { //无人等待匹配
      console.log('没人，等待匹配')
      score_que[0] = score;
      que[0] = socket.id;
    } else if ((score_que[test] - score) < 500) { //匹配到旗鼓相当的对手
      let Team1 = _.findWhere(io.sockets.sockets, {
        id: socket.id
      });
      let Team2 = _.findWhere(io.sockets.sockets, {
        id: que[test]
      });
      if (lastRival[Team1.Teamname] === Team2.Teamname) { //与上场比赛是同一对手，所以不能匹配
        console.log('与上场比赛是同一对手，等待其他匹配');
        let key = bs.insert(score_que, score);
        que.splice(key, 0, socket.id);
      } else {
        console.log('与' + score_que[test] + '分玩家匹配')
        score_que.splice(test, 1); //匹配成功，从等待列表删除
        let Team2_id = que.splice(test, 1); //得到的是数组，所以下面使用Team2_id[0]
        MatchState.findOne({
          name: Team1.Teamname
        }, function (err, doc) {
          doc.lastrival = Team2.Teamname;
          doc.state = 1;
          doc.save();
        });
        MatchState.findOne({
          name: Team2.Teamname
        }, function (err, doc) {
          doc.lastrival = Team1.Teamname;
          doc.state = 1;
          doc.save();
        });
        lastRival[Team1.Teamname] = Team2.Teamname;
        lastRival[Team2.Teamname] = Team1.Teamname;
        Team1.emit('match successfully', Team2.Teamname);
        Team2.emit('match successfully', Team1.Teamname);
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
      delete cache[socket.Teamname]; //如果断线用户上传了成绩一定要删除，下次再重新上传
    }
  });
  socket.on('submit', function (Teamname, rival, myScore, rivalScore) {
    var winner;
    if (Number(myScore) > Number(rivalScore)) winner = 1;
    else if (Number(myScore) == Number(rivalScore)) winner = 0;
    else winner = 2;
    let result = myScore + ':' + rivalScore; //自己的结果
    let rivalResult = rivalScore + ':' + myScore; //对手的结果
    //自己的结果缓存
    cache[Teamname] = result;
    if (cache[rival]) {
      //存在cache[rival]即对方已经上传成绩
      //双方成绩应该必须一样（但是前后相反）
      let rivalSocket = _.findWhere(io.sockets.sockets, {
        Teamname: rival
      });
      if (cache[rival] === rivalResult) {
        console.log(winner);
        ScoreCalc(Teamname, rival, winner, result, rivalResult);
        MatchState.findOne({
          name: Teamname
        }, function (err, doc) {
          doc.state = 0;
          doc.save();
        });
        MatchState.findOne({
          name: rival
        }, function (err, doc) {
          doc.state = 0;
          doc.save();
        });
        socket.emit('submit successfully');
        rivalSocket.emit('submit successfully');
        delete cache[Teamname];
        delete cache[rival];
      } else {
        //提交的成绩不一样,清除缓存等待重新上传
        delete cache[Teamname];
        delete cache[rival];
        socket.emit('submit wrong');
        rivalSocket.emit('submit wrong');
      }
    } else {
      socket.emit('wait rival submit');
    }
  });
});


function ScoreCalc(Team1_name, Team2_name, winner, Team1_result, Team2_result) {
  var query1 = MatchState.findOne({
    name: Team1_name
  });
  var promise1 = query1.exec();
  var query2 = MatchState.findOne({
    name: Team2_name
  });
  var promise2 = query2.exec();
  Promise.all([promise1, promise2]).then(value => {
    if (winner != 0) { //非平分的情况
      let Team1_score = value[0].score;
      let Team2_score = value[1].score;
      let Ea = 1 / (1 + Math.pow(10, (Team2_score - Team1_score) / 400));
      let Eb = 1 - Ea;
      let Team1_new_score, Team2_new_score, change;
      if (winner == 1) {
        change = Math.round(200 * (1 - Ea));
        Team1_new_score = Team1_score + change;
        Team2_new_score = Team2_score - change;
      } else {
        change = Math.round(200 * (1 - Eb));
        Team1_new_score = Team1_score - change;
        Team2_new_score = Team2_score + change;
      }
      if (Team1_new_score < 0) Team1_new_score = 0;
      if (Team2_new_score < 0) Team2_new_score = 0;
      value[0].score = Team1_new_score;
      value[0].list.push({
        rival: Team2_name,
        matchScore: Team1_result
      });
      value[1].score = Team2_new_score;
      value[1].list.push({
        rival: Team1_name,
        matchScore: Team2_result
      });
      value[0].save();
      value[1].save();
    } else { //平分的情况，不用计算直接保存0比0的战绩
      value[0].list.push({
        rival: Team2_name,
        matchScore: Team1_result
      });
      value[1].list.push({
        rival: Team1_name,
        matchScore: Team2_result
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