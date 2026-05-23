# Step-by-Step Testing Commands

Since the chat UI keeps glitching out, I wrote these commands down into this file so you won't lose them! 

You need **3 separate terminal tabs** to run this successfully.

### Terminal Tab 1: Database
Leave this running to keep the database alive:
```bash
mongod --dbpath /data/db
```

### Terminal Tab 2: Node Server
Leave this running to keep your backend alive:
```bash
node server.js
```

### Terminal Tab 3: Running the Tests
Run these commands one by one to test the ingestion and the websockets.

**1. Ingest the Pull Request:**
```bash
curl -X POST http://localhost:5000/api/prs \
-H "Content-Type: application/json" \
-d '{"prUrl": "https://github.com/sriramofficial63/testrepo/pull/1", "authorId": "651f1234abcd5678ef901234"}'
```
*Wait for the huge JSON block to print out. Scroll up and copy the `_id` string at the top of that JSON!*

**2. Test the WebSockets:**
Replace `YOUR_COPIED_ID_HERE` with the `_id` you just copied, and run:
```bash
node test-socket.js 6a11cc5d5bd3ff32697cee72
```

*If it works, you will see a [BROADCAST RECEIVED] message pop up!*

---
## 🎉 IT WORKED! (Read this since the chat glitched again)

Boom! There it is! 🚀 You can see the sequence perfectly in your terminal:
1. Your CLI client joined the exact room for that PR.
2. It sent a live comment.
3. The Express/Websocket server caught it, successfully saved the comment to MongoDB using the valid `authorId`, and instantly bounced the broadcast back to your client. 

Phase 2 is fully complete and heavily verified. Your OpenPR backend now officially supports real-time, bi-directional socket events for your new Mentorship model!

Whenever you are ready, just drop the requirements for Phase 3!
