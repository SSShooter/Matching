var mongoose = require('mongoose')
var matchSchama = mongoose.Schema({
  team1: String,
  team2: String,
  score1: String,
  score2: String,
  personal:{}
})
var matchModel = mongoose.model('match', matchSchama)
module.exports = matchModel