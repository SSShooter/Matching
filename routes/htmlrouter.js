var express = require('express')
var app = express()
var router = express.Router()
var path = require('path')

var dirname = path.resolve(__dirname, '..')

router.get('/myTeam', function (req, res) {
  res.sendFile(dirname + '/html/myTeam.html')
})

router.get('/newteam', function (req, res) {
  res.sendFile(dirname + '/html/newTeam.html')
})

router.get('/searchteam', function (req, res) {
  res.sendFile(dirname + '/html/searchTeam.html')
})

router.get('/matchInfo', function (req, res) {
  res.sendFile(dirname + '/html/matchInfo.html')
})

router.get('/register', function (req, res) {
  res.sendFile(dirname + '/html/Register.html')
})

router.get('/teamselect', function (req, res) {
  res.sendFile(dirname + '/html/teamSelect.html')
})

router.get('/matchpage', function (req, res) {
  res.sendFile(dirname + '/html/matchpage.html')
})

// 裁判
router.get('/back', function (req, res) {
  res.sendFile(dirname + '/html/dataupdate.html')
})

router.get('/getpersonaldata', function (req, res) {
  res.sendFile(dirname + '/html/getpersonalmatchdata.html')
})

router.get('/getteamdata', function (req, res) {
  res.sendFile(dirname + '/html/getteamdata.html')
})

router.get('/matchresult', function (req, res) {
  res.sendFile(dirname + '/html/matchresult.html')
})
module.exports = router
