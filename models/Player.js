var mongoose = require('mongoose');
mongoose.connection;

var PlayerSchama = mongoose.Schema({
  name: String,
  tel: Number,
  gender: String,
  height: Number,
  weight: Number,
  position: String,
  openid: {
    type: String,
    unique: true
  },
  info: {},
  title: String,
  team: String,
  status: Number, //0无所属1队长2队员3替补4邀请中
  matchdata: [] //每场比赛的数据
});
var PlayerModel = mongoose.model('Player', PlayerSchama);
module.exports = PlayerModel;