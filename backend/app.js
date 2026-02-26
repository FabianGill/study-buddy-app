const express = require("express");
const path = require("path");

const app = express();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.get("/", (req, res) => {
  res.render("index", { title: "Study Buddy" });
});

app.listen(3000, () => console.log("Running on http://localhost:3000"));
