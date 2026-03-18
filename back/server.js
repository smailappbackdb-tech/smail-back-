// import cors from "cors";
// import express from "express";
// import connectDB from "./DB/connection.js";
// import authRoute from "./routes/authroute.js";
// import dotenv from "dotenv";
// dotenv.config();

// const app = express();

// app.use(
//   cors({
//     origin: process.env.CLIENT_URL,
//   }),
// );
// app.use(express.json());
// app.use("/api/auth", authRoute);

// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//   console.log("Server is running on port " + PORT);
//   connectDB(); // ← connecte MongoDB APRÈS que le serveur démarre
// });


import cors from "cors";
import express from "express";
import connectDB from "./DB/connection.js";
import authRoute from "./routes/authroute.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(cors()); // ← sans restriction pour tester
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Server is running" }); // ← route test
});

app.use("/api/auth", authRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
  connectDB();
});
