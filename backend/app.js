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
    res.render("users", { title: "Find a Study Buddy", users });
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
        res.render("profile", { title: user.name, user, listings });
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

app.get("/listings/:id", (req, res) => {
  const listingId = req.params.id;
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
