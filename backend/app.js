const express = require("express");
const path = require("path");
const mysql = require("mysql2");
require("dotenv").config();

const app = express();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Connected to MySQL database");
  }
});

app.get("/", (req, res) => {
  res.render("index", { title: "Study Buddy" });
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

app.listen(3000, () => console.log("Running on http://localhost:3000"));
