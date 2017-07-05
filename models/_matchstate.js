var mongoose = require('mongoose')
var db = mongoose.connection

var matchStateSchama = mongoose.Schema({
  name: {
    unique: true,
    type: String
  },
  state: Number, // 1已匹配，等待上传成绩0未匹配,
  lastrival: String, // 上一对手id,用于已匹配情况
  score: Number,
  list: [{
    rival: String,
    matchScore: String
  }]
})
var matchStateModel = mongoose.model('matchState', matchStateSchama)
module.exports = matchStateModel
