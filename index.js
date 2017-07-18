const path = require('path')
var _ = require('underscore')
var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var port = process.env.PORT || 80
var bs = require('binarysearch')
var Team = require('./models/Team')
var TeamState = require('./models/TeamState')
var Player = require('./models/Player')
var bodyParser = require('body-parser')
var session = require('express-session')
var oauth = require('./routes/oauth')
var htmlrouter = require('./routes/htmlrouter')
var formidable = require('formidable')
var fs = require('fs')
var mongoose = require('mongoose')
mongoose.Promise = global.Promise
var moment = require('moment')
moment.locale('zh-cn')


Team.findOne({
    name: 'ce1'
  })
  .populate('teamstate')
  .exec(function (err, doc) {
    if (!err && !doc) return
    doc.teamstate.lastrival = 'ssss'
    doc.teamstate.save()
  })
/**
 * get /oauth 微信登陆
 * get /myteam 跳到我的队伍页面
 *
 */
app.use(express.static('public'))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(session({
  resave: true, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'bugaosuni'
}))

app.use('/oauth', oauth)

app.use('/', htmlrouter)

// 裁判获取两队成员
app.post('/getplayer', function (req, res) {
  var t1 = req.body.team1
  var t2 = req.body.team2
  console.log(t1, t2)
  var p1 = Team.findOne({
    name: t1
  })
  var p2 = Team.findOne({
    name: t2
  })
  Promise.all([p1, p2]).then(value => {
    var mate = [value[0].leader]
    mate = mate.concat(value[0].mate)
    mate = mate.concat(value[1].leader)
    mate = mate.concat(value[1].mate)
    console.log(mate)
    var mateP = mate.map(function (val) {
      return Player.findOne({
        openid: val
      }).exec()
    })
    Promise.all(mateP).then(function (val) {
      res.json({
        mate: val
      })
    })
  })
})

// 裁判记录球员数据
app.post('/personaldata', function (req, res) {
  console.log(req.body)
  var promises = []
  for (let i = 0; i < 10; i++) {
    if (!req.body[i + 'openid']) break
    Player.findOne({
      openid: req.body[i + 'openid']
    }, function (err, doc) {
      if (err) {
        res.json({
          code: 1,
          err: err
        })
      }
      var data = [req.body[i + 'lanban'], req.body[i + 'zhugong'], req.body[i + 'qiangduan'], req.body[i + 'gaimao'], req.body[i + 'fangui'], req.body[i + 'defen']]
      doc.matchdata.push(data)
      doc.markModified('matchdata')
      promises.push(doc.save())
    })
  }
  Promise.all(promises).then(function (val) {
    res.json({
      code: 0
    })
  }, function (err) {
    res.json({
      code: 1,
      msg: err
    })
  })
})

// 裁判上传成绩
app.post('/judgesubmit', function (req, res) {
  var winner
  var team1 = req.body.team1
  var team2 = req.body.team2
  var score1 = req.body.score1
  var score2 = req.body.score2
  var court = req.body.court
  if (Number(score1) > Number(score2)) winner = 1
  else if (Number(score1) === Number(score2)) winner = 0
  else winner = 2
  retrieveCourt(court)
  console.log(usingCourt, unuseCourt)
  ScoreCalc(team1, team2, winner, score1, score2, function () {
    res.json({
      code: 0,
      msg: 'ok'
    })
  })
})

// 登陆检验
app.use(function (req, res, next) {
  if (!req.session.openid) {
    res.json({
      code: 1,
      msg: '请重新登录'
    })
  } else {
    next()
  }
})

// 允许进队
app.post('/allow', function (req, res) {
  Player.update({
    openid: req.body.id
  }, {
    status: 2
  }, function (err) {
    if (err) {
      res.json({
        code: 1,
        err: err
      })
    }
    res.json({
      code: 0
    })
  })
})

// 拒绝进队
app.post('/disallow', function (req, res) {
  Player.update({ // 更改玩家的队伍状态
    openid: req.body.id
  }, {
    status: 0
  }, err => {
    if (err) {
      res.json({
        code: 1,
        err: err
      })
    }
    Team.findOne({ // 从队员列表移除
      name: req.session.team
    }, function (err, team) {
      if (err) {
        res.json({
          code: 1,
          err: err
        })
      }
      team.mate = _.without(team.mate, req.body.id)
      team.save(function (err) {
        if (err) {
          res.json({
            code: 1,
            err: err
          })
        }
        res.json({
          code: 0
        })
      })
    })
  })
})

// 解散队伍
app.post('/dissolveteam', function (req, res) {
  Team.findOneAndRemove({
    name: req.session.team
  }, function (err, doc) {
    if (err) {
      res.json({
        code: 1,
        err: err
      })
    }
    var matePromise = [Player.findOne({
      openid: doc.leader
    }).exec()]
    doc.mate.forEach(function (val) {
      matePromise.push(Player.findOne({
        openid: val
      }).exec())
    })
    Promise.all(matePromise).then(function (value) {
      console.log(value)
      value.forEach(function (val) {
        val.status = 0
        val.team = ''
        val.save(function () {
          res.json({
            code: 0,
            msg: 'ok'
          })
        })
      })
    })
  })
})

// 获取队伍信息（包括所有成员）
app.post('/teaminfo', function (req, res) {
  Team.findOne({
    name: req.session.team
  }, function (err, doc) {
    console.log(req.session.status)
    if (err) {
      res.json({
        code: 1,
        msg: '数据库错误',
        err: err
      })
      return
    }
    if (!doc) {
      res.json({
        mystatus: req.session.status
      })
      return
    }
    var matestatePromise = [Player.findOne({
      openid: doc.leader
    }).exec()]
    doc.mate.forEach(function (val) {
      console.log(val)
      matestatePromise.push(Player.findOne({
        openid: val
      }).exec())
    })
    Promise.all(matestatePromise).then(function (value) {
      res.json({
        code: 0,
        msg: 'ok',
        teamname: doc.name,
        teamdesc: doc.descript,
        list: doc.list,
        member: value,
        mystatus: req.session.status,
        myopenid: req.session.openid
      })
    }, function (err) {
      console.log(err)
    })
  })
})

// 新建队伍
app.post('/newteam', function (req, res) {
  req.body.score = 0 // 初始化分数为0
  let newTeamState = new TeamState({
    name: req.body.name
  })
  req.body.teamstate = newTeamState._id
  let newTeam = new Team(req.body)
  newTeamState.save(function () {
    newTeam.save(function (err, doc) {
      if (err) {
        res.json({
          code: 1,
          msg: '数据库错误',
          err: err
        })
      } else {
        // 队伍创建成功
        Player.findOne({
          openid: req.session.openid
        }, function (err, doc) {
          if (err) {
            res.json({
              code: 1,
              err: err
            })
          }
          doc.team = req.body.name
          doc.status = 1
          req.session.status = 1
          req.session.team = req.body.name
          doc.save(function () {
            res.json({
              code: 0,
              msg: doc
            })
          })
        })
      }
    })
  })
})

// 获取微信用户情报
app.post('/info', function (req, res) {
  var info = req.session.info
  res.json({
    code: 0,
    msg: 'ok',
    info: info
  })
})

// 上传队伍logo（可用，但前端裁剪未完成）
app.post('/uploadlogo', function (req, res) {
  var form = new formidable.IncomingForm()
  form.parse(req, function (err, fields, files) {
    if (err) {
      res.send(err)
      return
    }
    var extName = '' // 后缀名
    switch (files.upload.type) {
      case 'image/pjpeg':
        extName = 'jpg'
        break
      case 'image/jpeg':
        extName = 'jpg'
        break
      case 'image/png':
        extName = 'png'
        break
      case 'image/x-png':
        extName = 'png'
        break
    }
    var newName = Date.now() + randomString()
    fs.renameSync(files.upload.path, path.join(__dirname, '/public/teamlogo/', newName + '.' + extName))
    console.log('/public/teamlogo' + newName + '.' + extName)
    res.send('http://www.time-record.net/teamlogo/' + newName + '.' + extName)
  })
})

// 随机字符串命名
function randomString(len) {
  len = len || 4
  var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678' /** **默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
  var maxPos = $chars.length
  var pwd = ''
  for (var i = 0; i < len; i++) {
    pwd += $chars.charAt(Math.floor(Math.random() * maxPos))
  }
  return pwd
}

// 搜索队伍
app.post('/searchteam', function (req, res) {
  let keyword = req.body.keyword
  if (!keyword) return
  Team.find({
    name: new RegExp(keyword, 'i')
  }, function (err, doc) {
    if (err) {
      res.json({
        code: 1,
        msg: '出错',
        err: err
      })
    } else {
      if (doc) {
        res.json({
          code: 0,
          msg: 'ok',
          doc: doc
        })
      }
    }
  })
})

// 发起加入队伍请求
app.post('/jointeam', function (req, res) {
  Player.findOne({
    openid: req.session.openid
  }, function (err, doc) {
    if (err) {
      res.json({
        code: 1,
        err: err
      })
    }
    doc.team = req.body.teamname
    doc.status = req.session.status = 4
    doc.save(function (err) {
      if (err) {
        res.json({
          code: 1,
          err: err
        })
      }
      Team.findOne({
        name: req.body.teamname
      }, function (err, doc) {
        if (err) {
          res.json({
            code: 1,
            err: err
          })
        }
        doc.mate.push(req.session.openid)
        doc.save(function () {
          req.session.team = req.body.teamname
          res.json({
            code: 0,
            msg: 'ok'
          })
        })
      })
    })
  })
})

// 离开队伍
app.post('/leftteam', function (req, res) { // 不用传入参数，使用session解决问题
  Player.findOne({ // 更改玩家队伍状态
    openid: req.session.openid
  }, function (err, doc) {
    if (err) {
      res.json({
        code: 1,
        err: err
      })
    }
    doc.team = ''
    doc.status = req.session.status = 0
    console.log(req.session.status)
    doc.save()
  })
  Team.findOne({ // 在队伍中除名
    name: req.session.team
  }, function (err, doc) {
    if (err) {
      res.json({
        code: 1,
        err: err
      })
    }
    doc.mate = _.without(doc.mate, req.session.openid)
    doc.save()
  })
  req.session.team = ''
  res.json({
    code: 0,
    msg: 'ok'
  })
})

// 用户注册（信息登记）
app.post('/register', function (req, res) {
  req.body.openid = req.session.openid
  req.body.info = req.session.info
  req.body.matchdata = []
  let newPlayer = new Player(req.body)
  newPlayer.save(function (err, doc) {
    if (err) {
      res.json({
        code: 1,
        msg: '数据库错误',
        err: err
      })
    } else {
      res.json({
        code: 0,
        msg: doc
      })
    }
  })
})

// 获取个人比赛数据
app.post('/getpersonaldata', function (req, res) {
  Player.findOne({
    openid: req.session.openid
  }, function (err, doc) {
    if (err) {
      res.json({
        code: 1,
        err: err
      })
    }
    res.json({
      data: doc.matchdata
    })
  })
})

// 队伍情报获取
app.get('/getinfo', function (req, res) {
  Team.findOne({
      name: req.session.team
      // >注意点<
    })
    .populate('teamstate')
    .exec(function (err, doc) {
      if (err) {
        res.json({
          code: 1,
          err: err
        })
      }
      res.json(doc)
    })
})

// 天梯胜负得分计算
function ScoreCalc(team1Name, team2Name, winner, team1Result, team2Result, cb) {
  var promise1 = Team.findOne({
    name: team1Name
  }).populate('teamstate').exec()
  var promise2 = Team.findOne({
    name: team2Name
  }).populate('teamstate').exec()
  Promise.all([promise1, promise2]).then(value => {
    value[0].teamstate.state = 0
    value[1].teamstate.state = 0
    value[1].teamstate.save()
    value[0].teamstate.save()
    if (winner !== 0) { // 非平分的情况
      let team1Score = value[0].score
      let team2Score = value[1].score
      let Ea = 1 / (1 + Math.pow(10, (team2Score - team1Score) / 400))
      let Eb = 1 - Ea
      let team1NewScore, team2NewScore, change
      if (winner === 1) {
        change = Math.round(200 * (1 - Ea))
        team1NewScore = team1Score + change
        team2NewScore = team2Score - change
      } else {
        change = Math.round(200 * (1 - Eb))
        team1NewScore = team1Score - change
        team2NewScore = team2Score + change
      }
      if (team1NewScore < 0) team1NewScore = 0
      if (team2NewScore < 0) team2NewScore = 0
      value[0].score = team1NewScore
      value[1].score = team2NewScore
    }
    value[0].list.push({
      rival: team2Name,
      matchScore: team1Result + ':' + team2Result
    })
    value[1].list.push({
      rival: team1Name,
      matchScore: team2Result + ':' + team1Result
    })
    var p1 = value[0].save()
    var p2 = value[1].save()
    Promise.all([p1, p2]).then(cb())
  })
}

// 队列(放置socket)
var que = []

// 队列(放置名称)（是否在队列的唯一依据）（重连后socket.id会改变）
var nameQue = []

var teamname2socket = {}

// 分数队列 于队列相对应，用于按分数匹配
var scoreQue = []

// 记录各队伍上一个对手
var lastRival = {}

// 未使用场地
var unuseCourt = [1]

// 已使用场地
var usingCourt = []

// 分配场地
function distributeCourt() {
  var number = unuseCourt.shift()
  usingCourt.push({
    number: number,
    time: +new Date()
  })
  return number
}

// 回收场地
function retrieveCourt(court) {
  court = Number(court)
  unuseCourt.push(court)
  var temp = _.pluck(usingCourt, 'number')
  var index = _.indexOf(temp, court)
  usingCourt.splice(index, 1)
}

// 检查是否有空场
function hasEmptyCourt() {
  if (_.isEmpty(unuseCourt)) return false
  else return true
}

var teampage = io.of('/teampage').on('connection', function (socket) {
  // 上线用于队伍页面信息更新推送
  socket.on('playeronline', function (id) {
    socket.openid = id // 在socket缓存队伍名
    console.log(socket.openid)
  })

  // 入队推送
  socket.on('someone join', function (teamname) {
    Team.findOne({
      name: teamname
    }, function (err, team) {
      if (err) {
        socket.emit('err')
        return false
      }
      var mate = [team.leader]
      mate = mate.concat(team.mate)
      for (let i = 0; i < mate.length; i++) {
        let temp = _.findWhere(io.sockets.sockets, {
          openid: mate[i]
        })
        console.log(mate[i])
        console.log(temp)
        if (temp) {
          temp.emit('someone join')
        }
      }
    })
  })

  // 离队推送
  socket.on('someone leave', function (teamname) {
    Team.findOne({
      name: teamname
    }, function (err, team) {
      if (err) {
        socket.emit('err')
        return false
      }
      var mate = [team.leader]
      mate = mate.concat(team.mate)
      for (let i = 0; i < mate.length; i++) {
        let temp = _.findWhere(io.sockets.sockets, {
          openid: mate[i]
        })
        console.log(mate[i])
        console.log(temp)
        if (temp) {
          temp.emit('someone leave')
        }
      }
    })
  })
})

var match = io.of('/match').on('connection', function (socket) {
  // 队伍上线(参数: 队名 分数)
  socket.on('online', function (id, score) {
    if (!hasEmptyCourt()) {
      console.log(usingCourt[0].time)
      var fromNow = moment(usingCourt[0].time).add(13, 'm').fromNow()
      console.log(fromNow)
      socket.emit('court full', fromNow)
    }
    //队名2socket对象
    teamname2socket[id] = socket
    socket.Teamname = id // 在socket缓存队伍名
    socket.Score = score
    console.log(socket.Teamname)
  })

  // 匹配请求
  socket.on('join', (score, id) => { // 加入匹配存入分数与id
    let isInQue = _.indexOf(nameQue, id)
    console.log('isInQue', isInQue)
    if (isInQue !== -1) {
      scoreQue[isInQue] = score
      que[isInQue] = socket
      nameQue[isInQue] = id
      console.log('nameQue', nameQue)
      return
    }
    let test = bs.closest(scoreQue, score) // 查找最近分数最近的对手，返回数组位置
    if (test === -1) { // 无人等待匹配
      console.log('状态', '没人，等待匹配')
      scoreQue[0] = score
      que[0] = socket
      nameQue[0] = id
    } else if ((scoreQue[test] - score) < 500) { // 匹配到旗鼓相当的对手
      let Team1 = socket
      let Team2 = que[test]
      //todo 更改对手来源
      if (lastRival[Team1.Teamname] === Team2.Teamname) { // 与上场比赛是同一对手，所以不能匹配
        console.log('状态', '与上场比赛是同一对手，等待其他匹配')
        let key = bs.insert(scoreQue, score)
        que.splice(key, 0, socket)
      } else { //成功匹配的情况
        var courtNumber = distributeCourt()
        console.log('状态', '与' + scoreQue[test] + '分玩家匹配')
        console.log('场地', usingCourt)
        scoreQue.splice(test, 1) // 匹配成功，从等待列表删除
        que.splice(test, 1) // 删除列表中队伍（待确定
        console.log('队伍1：', Team1.Teamname, '队伍2：', Team2.Teamname)
        TeamState.findOne({
            name: Team1.Teamname
          })
          .exec(function (err, doc) {
            doc.state = 1
            doc.lastrival = Team2.Teamname
            doc.lastrivalscore = Team2.Score
            doc.courtnumber = courtNumber
            doc.save()
          })
        TeamState.findOne({
            name: Team2.Teamname
          })
          .exec(function (err, doc) {
            doc.state = 1
            doc.lastrival = Team1.Teamname
            doc.lastrivalscore = Team1.Score
            doc.courtnumber = courtNumber
            doc.save()
          })
        lastRival[Team1.Teamname] = Team2.Teamname
        lastRival[Team2.Teamname] = Team1.Teamname
        Team1.emit('match successfully', Team2.Teamname, Team2.Score, courtNumber)
        Team2.emit('match successfully', Team1.Teamname, Team1.Score, courtNumber)
      }
    } else { // 差距太大
      console.log('状态', '无旗鼓相当的对手，等待匹配')
      let key = bs.insert(scoreQue, score)
      que.splice(key, 0, socket)
      nameQue.splice(key, 0, id)
    }
    console.log('nameQue', nameQue)
    console.log('\n')
  })

  // 取消匹配请求
  socket.on('cancel', function () {
    let key = _.indexOf(que, socket)
    //找不到则不删除（有可能是离线遗留问题）（重新按匹配时覆盖原来的socket）
    if (key !== -1) {
      console.log(nameQue[key] + '取消匹配')
      scoreQue.splice(key, 1)
      que.splice(key, 1)
      nameQue.splice(key, 1)
      console.log('nameQue', nameQue)
      console.log('\n')
    }
  })

  // 断线
  socket.on('disconnect', function (reason) {
    console.log('disconnect', reason)
    let key = _.indexOf(que, socket)
    if (key !== -1) { // 未匹配用户断线
      console.log(socket.id + '玩家断线')
      scoreQue.splice(key, 1) // 链接断开，从等待列表删除
      que.splice(key, 1)
      console.log(que)
    }
  })

  // 比赛开始信号
  socket.on('matchstart', function (t1, t2) {
    let startTime = +new Date()
    TeamState.findOne({
        name: t1
      })
      .exec((err, doc) => {
        doc.starttime = startTime
        doc.save()
      })
    TeamState.findOne({
        name: t2
      })
      .exec((err, doc) => {
        doc.starttime = startTime
        doc.save()
      })
    if (teamname2socket[t1])
      teamname2socket[t1].emit('start')
    if (teamname2socket[t2])
      teamname2socket[t2].emit('start')
  })

  // 比赛结束信号
  socket.on('matchover', function (t1, t2) {
    if (teamname2socket[t1])
      teamname2socket[t1].emit('over')
    if (teamname2socket[t2])
      teamname2socket[t2].emit('over')
  })
})

// 等待上传分数，双方都上传后进行分数计算，计算后进入数据库
http.listen(port, function () {
  console.log('listening on *:' + port)
})