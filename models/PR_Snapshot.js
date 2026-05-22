const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  lineNumber: Number,
  text: String,
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const prSnapshotSchema = new mongoose.Schema({
  prUrl: {
    type: String,
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['open', 'reviewing', 'completed'],
    default: 'open'
  },
  parsedDiff: {
    type: mongoose.Schema.Types.Mixed
  },
  comments: [commentSchema]
}, { timestamps: true });

module.exports = mongoose.model('PR_Snapshot', prSnapshotSchema);
