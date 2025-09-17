"use strict";
require("dotenv").config();
const express = require("express");
const myDB = require("./connection");
const fccTesting = require("./freeCodeCamp/fcctesting.js");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const routes = require("./routes.js");
const auth = require("./auth.js");
const MongoStore = require("connect-mongo")(session);
const URI = process.env.MONGO_URI;
const store = new MongoStore({ url: URI });
const passportSocketIo = require("passport.socketio");
const cookieParser = require("cookie-parser");

const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(cors());

app.set("view engine", "pug");
app.set("views", "./views/pug");
fccTesting(app); // For fCC testing purposes
app.use("/public", express.static(process.cwd() + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false },
    name: "express.sid", // thêm dòng này
    store,
  })
);
app.use(passport.initialize());
app.use(passport.session());
// passport.authenticate('local');

myDB(async (client) => {
  const myDataBase = await client.db("database").collection("users");
  routes(app, myDataBase);
  auth(app, myDataBase);
}).catch((e) => {
  app.route("/").get((req, res) => {
    res.render("index", { title: e, message: "Unable to connect to database" });
  });
});

function onAuthorizeSuccess(data, accept) {
  console.log("successful connection to socket.io");

  accept(null, true);
}

function onAuthorizeFail(data, message, error, accept) {
  if (error) throw new Error(message);
  console.log("failed connection to socket.io:", message);
  accept(null, false);
}

io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: "express.sid",
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail,
  })
);

let currentUsers = 0;

io.on("connection", (socket) => {
  ++currentUsers;

  io.emit("user", {
    username: socket.request.user.username,
    currentUsers,
    connected: true,
  });

  socket.on("disconnect", () => {
    --currentUsers;
    io.emit("user", {
      username: socket.request.user.username,
      currentUsers,
      connected: false,
    });
  });

  socket.on("chat message", (message) => {
    io.emit("chat message", {
      username: socket.request.user.username,
      message,
    });
  });
});

io.emit("user count", currentUsers);
// io.emit("chat message", messageChat);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
