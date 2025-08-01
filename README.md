---

# 🧠 Auction Backend — Architecture & Approach

This project implements a **real-time auction system** using **Express**, **MongoDB**, **Redis**, **WebSockets**, and **Worker Threads** to support live bidding, leaderboard caching, and auction lifecycle monitoring.

---

## 🔧 Key Components & Flow

### 1. **Express Server**

* Serves REST APIs for user auth and auction operations (`/auth`, `/auction`).
* Applies rate limiting on bidding routes (`/auction/:id/bid`) to prevent abuse.
* Serves static frontend from the `/public` directory.

### 2. **MongoDB (via Mongoose)**

* Primary storage for user data, auctions, and bids.
* Mongoose models handle validations and queries.

### 3. **WebSocket (Socket.IO)**

* Enables real-time communication for:

  * **Live bid updates** (`new-bid`)
  * **Auction end announcements** (`auction-ended`)
  * **Leaderboard refreshes** (`leaderboard-updated`)
* Socket instance is injected into auction routes to emit events.

### 4. **Redis Leaderboard Cache**

* Leaderboards are cached using Redis `ZADD` for top bidders.
* Fall back to MongoDB if Redis is unavailable.
* Designed for fast retrieval of top N bidders.

### 5. **Worker Thread for Auction Monitoring**

* A background thread (`auctionMonitor.js`) runs every few seconds:

  * Detects auctions whose `endTime` has passed.
  * Marks auctions as completed.
  * Emits `auction-ended` events.
  * Triggers email notifications.

### 6. **Email Notifications**

* Configured to use SendGrid or Mailgun (via `mailer.ts`).
* Sends:

  * Confirmation to winning bidder.
  * Auction result summary to the auction creator.

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Add MONGO_URL, REDIS_URL, and email API keys

# Start server
npm run dev
```

---

## 📦 Technologies Used

* **Node.js + Express** – REST API backend
* **Socket.IO** – Live bid updates
* **MongoDB + Mongoose** – Data persistence
* **Redis** – Leaderboard cache
* **Worker Threads** – Background auction monitoring
* **SendGrid / Mailgun** – Email integration

---

## ✅ Future Enhancements

* Bid retry and queuing
* Notification subscriptions
* Webhooks or push messages
* In-app real-time alerts

---
