var mongoose = require('mongoose')
mongoose.connect('mongodb://localhost/test')
// 用于md5加密
var bcrypt = require('bcryptjs')
// 加盐数
var SALT_WORK_FACTOR = 5
var playerSchama = mongoose.Schema({
  name: {
    unique: true,
    type: String
  },
  password: String,
  email: String,
  mobile: Number,
  gender: Number
})
playerSchama.pre('save', function (next) {
  var player = this
  if (this.isNew) {
    this.createAt = this.updateAt = Date.now()
  } else {
    this.updateAt = Date.now()
  }
  bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
    if (err) return next(err)

    bcrypt.hash(player.password, salt, function (err, hash) {
      if (err) return next(err)

      player.password = hash
      next()
    })
  })
})
playerSchama.methods = {
  comparePassword: function (_password, cb) {
    bcrypt.compare(_password, this.password, function (err, isMatch) {
      if (err) return cb(err)
      cb(null, isMatch)
    })
  }
}
playerSchama.statics = {
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
var playerModel = mongoose.model('player', playerSchama)
module.exports = playerModel
