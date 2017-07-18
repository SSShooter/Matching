var mongoose = require('mongoose')
var teamStateSchama = mongoose.Schema({
  name: {
    unique: true,
    type: String
  },
  state: Number, // 1已匹配，等待上传成绩0未匹配,
  starttime: Number,
  lastrival: String, // 上一对手id,用于已匹配情况
  lastrivalscore: Number, // 上一对手id,用于已匹配情况
  courtnumber: Number
})
var teamStateModel = mongoose.model('teamState', teamStateSchama)
module.exports = teamStateModel