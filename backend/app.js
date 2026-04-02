const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
require("dotenv").config();

const app = express();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "studybuddy-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

db.getConnection((err, connection) => {
  if (err) console.error("Database connection failed:", err);
  else {
    console.log("Connected to MySQL database");
    connection.release();
  }
});

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.get("/", (req, res) => {
  res.render("index", { title: "Study Buddy" });
});

app.get("/register", (req, res) => {
  res.render("register", { title: "Register" });
});

app.post("/register", async (req, res) => {
  const { name, email, password, year_of_study, bio } = req.body;
  const avatar_initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  try {
    const hash = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (name, email, password_hash, year_of_study, bio, avatar_initials) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, hash, year_of_study, bio, avatar_initials],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.render("register", { title: "Register", error: "Email already registered." });
          }
          throw err;
        }
        req.session.user = { user_id: result.insertId, name, email, avatar_initials };
        res.redirect("/users");
      }
    );
  } catch (err) {
    console.error(err);
    res.render("register", { title: "Register", error: "Something went wrong." });
  }
});

app.get("/login", (req, res) => {
  res.render("login", { title: "Login" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, users) => {
    if (err) throw err;
    if (users.length === 0) {
      return res.render("login", { title: "Login", error: "No account found with that email." });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.render("login", { title: "Login", error: "Incorrect password." });
    }
    req.session.user = { user_id: user.user_id, name: user.name, email: user.email, avatar_initials: user.avatar_initials };
    res.redirect("/users");
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.get("/users", (req, res) => {
  db.query("SELECT * FROM users", (err, users) => {
    if (err) throw err;
    res.render("users", { title: "Find a Study Buddy", users, getLevel });
  });
});

app.get("/users/:id", (req, res) => {
  const userId = req.params.id;
  db.query("SELECT * FROM users WHERE user_id = ?", [userId], (err, users) => {
    if (err) throw err;
    if (users.length === 0) return res.status(404).send("User not found");
    const user = users[0];
    db.query(
      "SELECT l.*, GROUP_CONCAT(t.tag_name) as tags FROM listings l LEFT JOIN listing_tags lt ON l.listing_id = lt.listing_id LEFT JOIN tags t ON lt.tag_id = t.tag_id WHERE l.user_id = ? GROUP BY l.listing_id",
      [userId],
      (err, listings) => {
        if (err) throw err;
        res.render("profile", { title: user.name, profileUser: user, listings, getLevel });
      }
    );
  });
});

app.get("/listings", (req, res) => {
  db.query(
    "SELECT l.*, u.name as user_name, u.avatar_initials, GROUP_CONCAT(t.tag_name) as tags FROM listings l JOIN users u ON l.user_id = u.user_id LEFT JOIN listing_tags lt ON l.listing_id = lt.listing_id LEFT JOIN tags t ON lt.tag_id = t.tag_id WHERE l.status = 'active' GROUP BY l.listing_id",
    (err, listings) => {
      if (err) throw err;
      res.render("listings", { title: "Browse Listings", listings });
    }
  );
});


// POINTS HELPER FUNCTION
function addPoints(userId, points) {
  db.query("UPDATE users SET points = points + ? WHERE user_id = ?", [points, userId], (err) => {
    if (err) console.error("Points update failed:", err);
  });
}

function getLevel(points) {
  if (points >= 200) return { level: "Champion", badge: "💎" };
  if (points >= 101) return { level: "Expert", badge: "🏆" };
  if (points >= 51)  return { level: "Helper", badge: "⭐" };
  if (points >= 21)  return { level: "Learner", badge: "📚" };
  return { level: "Newcomer", badge: "🌱" };
}

// CREATE LISTING - show form
app.get("/listings/create", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  db.query("SELECT * FROM tags", (err, tags) => {
    if (err) throw err;
    res.render("create-listing", { title: "Create Listing", tags });
  });
});

// CREATE LISTING - handle form
app.post("/listings/create", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const { title, description, listing_type, tag_ids } = req.body;
  const userId = req.session.user.user_id;
  db.query(
    "INSERT INTO listings (user_id, title, description, listing_type, status) VALUES (?, ?, ?, ?, 'active')",
    [userId, title, description, listing_type],
    (err, result) => {
      if (err) throw err;
      const listingId = result.insertId;
      if (tag_ids) {
        const tags = Array.isArray(tag_ids) ? tag_ids : [tag_ids];
        const tagValues = tags.map(tagId => [listingId, tagId]);
        db.query("INSERT INTO listing_tags (listing_id, tag_id) VALUES ?", [tagValues], (err) => {
          if (err) throw err;
          res.redirect("/listings/" + listingId);
        });
      } else {
        res.redirect("/listings/" + listingId);
      }
    }
  );
});

app.get("/listings/:id", (req, res) => {
  const listingId = req.params.id;
  // Increment view count
  db.query("UPDATE listings SET views = views + 1 WHERE listing_id = ?", [listingId], () => {});
  // Check if views reached 5 - give points to owner
  db.query("SELECT user_id, views FROM listings WHERE listing_id = ?", [listingId], (err, rows) => {
    if (!err && rows.length > 0 && rows[0].views === 5) {
      addPoints(rows[0].user_id, 5);
    }
  });
  db.query(
    "SELECT l.*, u.name as user_name, u.avatar_initials, u.bio, u.year_of_study, GROUP_CONCAT(t.tag_name) as tags FROM listings l JOIN users u ON l.user_id = u.user_id LEFT JOIN listing_tags lt ON l.listing_id = lt.listing_id LEFT JOIN tags t ON lt.tag_id = t.tag_id WHERE l.listing_id = ? GROUP BY l.listing_id",
    [listingId],
    (err, results) => {
      if (err) throw err;
      if (results.length === 0) return res.status(404).send("Listing not found");
      res.render("listing-detail", { title: results[0].title, listing: results[0] });
    }
  );
});

app.get("/tags", (req, res) => {
  db.query(
    "SELECT t.*, COUNT(lt.listing_id) as listing_count FROM tags t LEFT JOIN listing_tags lt ON t.tag_id = lt.tag_id GROUP BY t.tag_id ORDER BY t.category",
    (err, tags) => {
      if (err) throw err;
      res.render("tags", { title: "Browse by Subject", tags });
    }
  );
});




// GET REVIEWS FOR A LISTING
app.get("/listings/:id/reviews", (req, res) => {
  const listingId = req.params.id;
  db.query(
    `SELECT r.*, u.name as reviewer_name, u.avatar_initials 
     FROM reviews r 
     JOIN users u ON r.reviewer_id = u.user_id
     JOIN sessions s ON r.session_id = s.session_id
     WHERE s.listing_id = ?
     ORDER BY r.created_at DESC`,
    [listingId],
    (err, reviews) => {
      if (err) throw err;
      res.json(reviews);
    }
  );
});

// POST A REVIEW
app.post("/listings/:id/review", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const listingId = req.params.id;
  const { rating, comment } = req.body;
  const reviewerId = req.session.user.user_id;
  db.query(
    "INSERT INTO sessions (requester_id, listing_id, status) VALUES (?, ?, 'accepted')",
    [reviewerId, listingId],
    (err, result) => {
      if (err) throw err;
      const sessionId = result.insertId;
      db.query(
        "INSERT INTO reviews (session_id, reviewer_id, rating, comment) VALUES (?, ?, ?, ?)",
        [sessionId, reviewerId, rating, comment],
        (err) => {
          if (err) throw err;
          // Give points to listing owner based on rating
          db.query("SELECT user_id FROM listings WHERE listing_id = ?", [listingId], (err, rows) => {
            if (!err && rows.length > 0) {
              const ownerId = rows[0].user_id;
              const pts = rating == 5 ? 20 : rating == 4 ? 10 : rating == 3 ? 5 : 0;
              if (pts > 0) addPoints(ownerId, pts);
            }
          });
          res.redirect("/listings/" + listingId);
        }
      );
    }
  );
});


// MESSAGES - inbox
app.get("/messages", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const userId = req.session.user.user_id;
  db.query(
    `SELECT m.*, 
     u1.name as sender_name, u1.avatar_initials as sender_avatar,
     u2.name as receiver_name, u2.avatar_initials as receiver_avatar
     FROM messages m
     JOIN users u1 ON m.sender_id = u1.user_id
     JOIN users u2 ON m.receiver_id = u2.user_id
     WHERE m.receiver_id = ? OR m.sender_id = ?
     ORDER BY m.created_at DESC`,
    [userId, userId],
    (err, messages) => {
      if (err) throw err;
      res.render("messages", { title: "Messages", messages });
    }
  );
});

// MESSAGES - conversation with a user
app.get("/messages/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const myId = req.session.user.user_id;
  const otherId = req.params.userId;
  db.query("SELECT * FROM users WHERE user_id = ?", [otherId], (err, users) => {
    if (err) throw err;
    if (users.length === 0) return res.status(404).send("User not found");
    const otherUser = users[0];
    db.query(
      `SELECT m.*, u.name as sender_name, u.avatar_initials as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.user_id
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
       OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at ASC`,
      [myId, otherId, otherId, myId],
      (err, messages) => {
        if (err) throw err;
        db.query(
          "UPDATE messages SET is_read = TRUE WHERE receiver_id = ? AND sender_id = ?",
          [myId, otherId],
          () => {}
        );
        res.render("conversation", { title: "Chat with " + otherUser.name, messages, otherUser });
      }
    );
  });
});

// MESSAGES - send message
app.post("/messages/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const senderId = req.session.user.user_id;
  const receiverId = req.params.userId;
  const { content } = req.body;
  db.query(
    "INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)",
    [senderId, receiverId, content],
    (err) => {
      if (err) throw err;
      res.redirect("/messages/" + receiverId);
    }
  );
});

// MATCHING ALGORITHM
app.get("/match", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const userId = req.session.user.user_id;
  db.query(
    `SELECT DISTINCT u.*, 
     COUNT(DISTINCT lt2.tag_id) as matching_tags
     FROM users u
     JOIN listings l ON u.user_id = l.user_id
     JOIN listing_tags lt ON l.listing_id = lt.listing_id
     JOIN listing_tags lt2 ON lt.tag_id = lt2.tag_id
     JOIN listings l2 ON lt2.listing_id = l2.listing_id
     WHERE l2.user_id = ? 
     AND u.user_id != ?
     AND l.status = 'active'
     GROUP BY u.user_id
     ORDER BY matching_tags DESC
     LIMIT 6`,
    [userId, userId],
    (err, matches) => {
      if (err) throw err;
      res.render("match", { title: "Your Matches", matches });
    }
  );
});

app.listen(3000, () => console.log("Running on http://localhost:3000"));
