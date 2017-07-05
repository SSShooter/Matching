/**
 * @Module   : Wechat oauth Module
 * @Brief    : Process Wechat oauth
 */

var express = require('express')
var app = express()
var router = express.Router()
var request = require('request')
var session = require('express-session')
var Player = require('../models/Player.js')
app.use(session({
  resave: true, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'bugaosuni'
}))

/* 微信登陆 */
var AppID = 'wx6cb2304c498a1465'
var AppSecret = '2225ea79fc50f98d1fddbd12aa319a80'
router.get('/wx_login', function (req, res, next) {
  // 第一步：用户同意授权，获取code
  var router = 'get_wx_access_token'
  // 这是编码后的地址
  var return_uri = 'http%3A%2F%2Fwww.time-record.net%2Foauth%2F' + router
  var scope = 'snsapi_userinfo'

  res.redirect('https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + AppID + '&redirect_uri=' + return_uri + '&response_type=code&scope=' + scope + '&state=STATE#wechat_redirect')
})

router.get('/get_wx_access_token', function (req, res, next) {
  // 第二步：通过code换取网页授权access_token
  var code = req.query.code
  request.get({
    url: 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + AppID + '&secret=' + AppSecret + '&code=' + code + '&grant_type=authorization_code'
  },
    function (error, response, body) {
      if (response.statusCode == 200) {
        // 第三步：拉取用户信息(需scope为 snsapi_userinfo)
        var data = JSON.parse(body)
        var access_token = data.access_token
        var openid = data.openid
        request.get({
          url: 'https://api.weixin.qq.com/sns/userinfo?access_token=' + access_token + '&openid=' + openid + '&lang=zh_CN'
        },
          function (error, response, body) {
            if (!openid) {
              res.send('超时，请重新登录')
              return
            }
            if (response.statusCode == 200) {
              // 第四步：根据获取的用户信息进行对应操作
              var userinfo = JSON.parse(body)
              console.log('获取微信信息成功！')
              req.session.openid = openid
              req.session.info = userinfo
              Player.findOne({
                openid: openid
              }, function (err, doc) {
                if (!err && doc) { // 无错误并已经注册
                  if (doc.team) { // 有所在队伍
                    req.session.team = doc.team
                    req.session.status = doc.status
                    res.redirect('/myTeam')
                  } else // 无所在队伍
                    { res.redirect('/teamselect') }
                } else if (err) {
                  res.send('请重新登录')
                } else { // 跳转到填写个人信息
                  console.log('我他妈找不到文档')
                  res.redirect('/register')
                }
              })
            } else {
              console.log(response.statusCode)
            }
          }
        )
      } else {
        console.log(response.statusCode)
      }
    }
  )
})

router.get('/wx_login_to_match', function (req, res, next) {
  var router = 'get_wx_access_token2'
  var return_uri = 'http%3A%2F%2Fwww.time-record.net%2Foauth%2F' + router
  var scope = 'snsapi_userinfo'

  res.redirect('https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + AppID + '&redirect_uri=' + return_uri + '&response_type=code&scope=' + scope + '&state=STATE#wechat_redirect')
})

router.get('/get_wx_access_token2', function (req, res, next) {
  var code = req.query.code
  request.get({
    url: 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + AppID + '&secret=' + AppSecret + '&code=' + code + '&grant_type=authorization_code'
  },
    function (error, response, body) {
      if (response.statusCode == 200) {
        var data = JSON.parse(body)
        var access_token = data.access_token
        var openid = data.openid
        request.get({
          url: 'https://api.weixin.qq.com/sns/userinfo?access_token=' + access_token + '&openid=' + openid + '&lang=zh_CN'
        },
          function (error, response, body) {
            if (!openid) {
              res.send('超时，请重新登录')
              return
            }
            if (response.statusCode == 200) {
              var userinfo = JSON.parse(body)
              req.session.openid = openid
              req.session.info = userinfo
              Player.findOne({
                openid: openid
              }, function (err, doc) {
                if (!err && doc) { // 无错误并已经注册
                  if (doc.team) { // 有所在队伍
                    if (doc.status == 1) { // 并且是队长
                      req.session.team = doc.team
                      res.redirect('/matchpage')
                    } else {
                      res.send('请联系队长进行此操作')
                    }
                  }
                }
              })
            } else {
              console.log(response.statusCode)
            }
          }
        )
      } else {
        console.log(response.statusCode)
      }
    }
  )
})
module.exports = router
