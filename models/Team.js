var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');
var teamSchama = mongoose.Schema({
    name: {
        unique: true,
        type: String
    },
    descript: String,
    leader: String,
    mate: []
});
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
};
var teamModel = mongoose.model('team', teamSchama);
module.exports = teamModel;
