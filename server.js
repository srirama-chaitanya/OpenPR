require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const parseDiff = require('parse-diff');
const http = require('http');
const { Server } = require('socket.io');

const User = require('./models/User');
const PR_Snapshot = require('./models/PR_Snapshot');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes

/**
 * Route 1: The Ingestion Pipeline (POST /api/prs)
 */
app.post('/api/prs', async (req, res) => {
  try {
    const { prUrl, authorId } = req.body;
    
    if (!prUrl || !authorId) {
      return res.status(400).json({ error: 'prUrl and authorId are required' });
    }

    // Extract owner, repo, pull_number from the URL
    // Example: https://github.com/owner/repo/pull/12
    const githubUrlRegex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
    const match = prUrl.match(githubUrlRegex);
    
    if (!match) {
      return res.status(400).json({ error: 'Invalid GitHub PR URL format' });
    }

    const [, owner, repo, pull_number] = match;

    // Fetch raw diff from GitHub API
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`, {
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
      }
    });

    const rawDiff = response.data;
    
    // Parse raw diff string
    const parsedDiff = parseDiff(rawDiff);

    // Create a new PR_Snapshot document
    const newPrSnapshot = new PR_Snapshot({
      prUrl,
      authorId,
      parsedDiff
    });

    await newPrSnapshot.save();

    res.status(201).json(newPrSnapshot);

  } catch (error) {
    console.error('Error in PR ingestion:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to ingest PR' });
  }
});

/**
 * Route 2: The Concurrency Lock (POST /api/prs/:id/claim)
 */
app.post('/api/prs/:id/claim', async (req, res) => {
  try {
    const prId = req.params.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Atomic findOneAndUpdate to prevent race conditions
    // Filter MUST be { _id: prId, leadReviewer: null }
    const updatedPr = await PR_Snapshot.findOneAndUpdate(
      { _id: prId, leadReviewer: null },
      { 
        $set: { 
          leadReviewer: userId, 
          status: 'reviewing' 
        } 
      },
      { new: true } // Return the updated document
    );

    if (!updatedPr) {
      // Return 409 Conflict if already claimed or does not exist
      return res.status(409).json({ error: 'PR is already claimed, does not exist, or could not be found' });
    }

    res.status(200).json(updatedPr);

  } catch (error) {
    console.error('Error claiming PR:', error.message);
    res.status(500).json({ error: 'Internal server error while claiming PR' });
  }
});

// WebSockets Logic
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Join PR Room
  socket.on('join_pr_room', ({ prId }) => {
    socket.join(prId);
    console.log(`Socket ${socket.id} joined room: ${prId}`);
  });

  // 2. The "Hand-off" Mechanism (Granting Access)
  socket.on('grant_edit_access', async ({ prId, targetUserId, requestingUserId }) => {
    try {
      const pr = await PR_Snapshot.findById(prId);
      if (!pr) return;

      // Verify the requesting user is the actual leadReviewer
      if (pr.leadReviewer && pr.leadReviewer.toString() === requestingUserId) {
        // Grant access
        if (!pr.allowedEditors.includes(targetUserId)) {
          pr.allowedEditors.push(targetUserId);
          await pr.save();
        }
        
        // Broadcast to everyone in the room that access was updated
        io.to(prId).emit('access_updated', { targetUserId, prId });
      }
    } catch (err) {
      console.error('Error granting edit access:', err.message);
    }
  });

  // 3. Live Commenting
  socket.on('new_comment', async ({ prId, file, line, text, author }) => {
    try {
      const newComment = {
        lineNumber: line,
        text,
        authorId: author // Assuming author is the userId string
      };

      // Save comment to DB
      await PR_Snapshot.updateOne(
        { _id: prId },
        { $push: { comments: newComment } }
      );

      // Broadcast to room instantly
      io.to(prId).emit('new_comment', { prId, file, line, text, author });
    } catch (err) {
      console.error('Error adding comment:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
