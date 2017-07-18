var mongoose = require('mongoose')
var Schema = mongoose.Schema
mongoose.connect('mongodb://localhost/test')
var teamSchama = mongoose.Schema({
  name: {
    unique: true,
    type: String
  },
  logo: String,
  descript: String,
  leader: String,
  mate: [],
  state: Number, // 1已匹配，等待上传成绩0未匹配,
  lastrival: String, // 上一对手id,用于已匹配情况
  score: Number,
  list: [{
    rival: String,
    matchScore: String
  }],
  teamstate: {
    type: Schema.Types.ObjectId,
    ref: "teamState"
  }
})
teamSchama.statics = {
  fetch: function (cb) {
    return this
      .find({})
      .exec(cb)
  },
  findById: function (id, cb) {
    return this
      .findOne({
        _id: id
      })
      .exec(cb)
  }
}
var teamModel = mongoose.model('team', teamSchama)
module.exports = teamModel