import cors from "cors";
import express from "express";

import session from "express-session";
import connectDB from "./DB/connection.js";
import authRoute from "./routes/authroute.js";
// import passport from "./passport.js";
// import userroute from "./route/userroute.js";
import dotenv from "dotenv";
dotenv.config();



// app.use(cors()); // Allow frontend to communicate with API
// app.use(express.json()); // Parse incoming JSON data
// app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
// connectDB();



await connectDB();

const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_URL,
  }),
);
app.use(express.json());
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//   }),
// );
// app.use(passport.initialize());
// app.use(passport.session());
app.use("/api/auth", authRoute);
// app.use("/api/userroute", userroute);

app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on port " + (process.env.PORT || 3000));
});
