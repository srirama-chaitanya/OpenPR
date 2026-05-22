require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const parseDiff = require('parse-diff');

const User = require('./models/User');
const PR_Snapshot = require('./models/PR_Snapshot');

const app = express();
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
    // Filter MUST be { _id: prId, claimedBy: null }
    const updatedPr = await PR_Snapshot.findOneAndUpdate(
      { _id: prId, claimedBy: null },
      { 
        $set: { 
          claimedBy: userId, 
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

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
