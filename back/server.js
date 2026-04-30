import cors from "cors";
import express from "express";
import connectDB from "./DB/connection.js";
import authRoute from "./routes/authroute.js";
import dashboardLogicRoute from "./routes/dashboardlogic.js";
import usernameRoute from "./routes/username.js";
import userPasswordRoute from "./routes/userpassword.js"; 
import password from "./routes/userpassword.js";
import changeStatusClientRoute from "./routes/changestatusclient.js";
import coursesRoute from "./routes/courses.js";
import videosRoute from "./routes/videos.js";
import adminRoute from "./routes/admin.js";
import dotenv from "dotenv";
dotenv.config(); 


const app = express();

const corsOptions = {
  origin(origin, callback) {
    // DEV: Allow any localhost/127.0.0.1 on port 8080
    if (!origin) {
      return callback(null, true);
    }

    try {
      const url = new URL(origin);
      const isDevLocal =
        (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
        url.port === "8080";

      if (isDevLocal) {
        return callback(null, true);
      }
    } catch {}

    // PROD: Explicit whitelist
    const allowedProd = [
      "https://ismail-course.vercel.app",
      process.env.CLIENT_URL,
    ].filter(Boolean);

    if (allowedProd.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// ✅ Timeout 15min (900000ms) pour uploads de video
app.use((req, res, next) => {
  if (req.path.includes('/upload') || req.path.includes('/dashboardinformation')) {
    res.setTimeout(900000); // 15 minutes
  }
  next();
});

app.use("/api/auth", authRoute);
app.use("/api/dashboardinformation", dashboardLogicRoute);
app.use("/api/username", usernameRoute);
app.use("/api/userpassword", userPasswordRoute); 
app.use("/api/password", password);
app.use("/api/changestatusclient", changeStatusClientRoute);
app.use("/api/courses", coursesRoute);
app.use("/api/videos", videosRoute);
app.use("/api/admin", dashboardLogicRoute);
app.use("/api/admin", adminRoute);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
  connectDB(); // ← connecte MongoDB APRÈS que le serveur démarre
});
