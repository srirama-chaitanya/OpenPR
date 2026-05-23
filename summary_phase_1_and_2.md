# OpenPR: Master Progress Report (Phase 1 & 2)

We have successfully built the entire backend foundation for your real-time collaborative code review platform. Here is exactly what we have built so far:

## Phase 1: REST API & Data Layer (The Foundation)
We started by setting up a standard HTTP REST API using Node.js, Express, and MongoDB (Mongoose).

1. **Database Schemas:**
   - Designed a `User` schema.
   - Designed a `PR_Snapshot` schema to store Pull Requests.
2. **Ingestion Pipeline (`POST /api/prs`):**
   - We built a route that takes a GitHub PR URL.
   - It hits the GitHub REST API securely using a Personal Access Token (`GITHUB_TOKEN`) and requests the raw string diff using a special GitHub header.
   - It pipes that raw diff into the `parse-diff` library, breaking it down into a clean JSON tree of additions and deletions.
   - It saves that entire structure into MongoDB.
3. **Concurrency Lock (`POST /api/prs/:id/claim`):**
   - We built an atomic `findOneAndUpdate` lock in MongoDB to ensure only one person could claim a PR at a time without race conditions.

---

## Phase 2: Real-Time Engine (The Mentorship Pivot)
We decided to pivot from a strict 1-to-1 claiming model to a collaborative "Driver and Passenger" mentoring model. To do this, we integrated WebSockets.

1. **Schema Upgrades:**
   - Modified the PR schema: Renamed `claimedBy` to `leadReviewer` (The Driver).
   - Added an `allowedEditors` array (The Passengers).
2. **Socket.io Integration:**
   - Wrapped the Express app inside a native Node HTTP server to mount `socket.io` on the same port.
3. **Room Architecture (`join_pr_room`):**
   - Users connecting to the socket are placed into specific PR "Rooms" so their chat events don't bleed into other code reviews.
4. **Access Hand-offs (`grant_edit_access`):**
   - We built an event listener where the `leadReviewer` can pass a target user's ID to the server.
   - The server verifies their permissions in MongoDB, pushes the target user to the `allowedEditors` array, saves the database, and broadcasts an `access_updated` event to unlock everyone's UI simultaneously.
5. **Live Commenting (`new_comment`):**
   - When a comment is sent, the server parses it, pushes it directly to the `comments` array in MongoDB for persistent storage, and instantly broadcasts the comment back to the entire room so UIs update without refreshing.

### What's Next?
The backend engine is fully operational. We are ready to tackle Phase 3!
