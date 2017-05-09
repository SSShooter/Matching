var mongoose = require('mongoose');
var db = mongoose.connection;

var matchStateSchama = mongoose.Schema({
  name: {
    unique: true,
    type: String
  },
  score: Number,
  list: [{
    rival: String,
    matchScore: String
  }]
});
var matchStateModel = mongoose.model('matchState',matchStateSchama);
module.exports = matchStateModel;