const io = require('socket.io-client');

// Replace this with a valid PR _id from your MongoDB!
const PR_ID = process.argv[2]; 

if (!PR_ID) {
  console.log("Usage: node test-socket.js <PR_ID>");
  process.exit(1);
}

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log(`✅ Connected! Socket ID: ${socket.id}`);
  
  // 1. Join Room
  socket.emit('join_pr_room', { prId: PR_ID });
  console.log(`🚪 Joining room: ${PR_ID}`);

  // 2. Wait a second, then send a live comment
  setTimeout(() => {
    console.log(`💬 Sending a test comment...`);
    socket.emit('new_comment', {
      prId: PR_ID,
      file: 'src/index.js',
      line: 10,
      text: 'This is a test comment from the CLI!',
      author: '651f1234abcd5678ef901234'
    });
  }, 2000);
});

// Listen for broadcasts
socket.on('new_comment', (data) => {
  console.log(`\n📢 [BROADCAST RECEIVED] New Comment!`);
  console.log(`Author: ${data.author}`);
  console.log(`Text: ${data.text}`);
  
  // Exit after receiving the broadcast to end the test
  setTimeout(() => process.exit(0), 1000);
});

socket.on('connect_error', (err) => {
  console.log(`❌ Connection Error: ${err.message}`);
  process.exit(1);
});
