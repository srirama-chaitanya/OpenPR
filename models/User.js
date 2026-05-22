const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  githubId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  reputation: [{
    language: String,
    score: Number
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
