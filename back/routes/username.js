import express from "express";
import JWT from "jsonwebtoken";
import User from "../models/client.js";

const router = express.Router();

// ─────────────────────────────────────────
// MIDDLEWARE - VERIFY JWT
// ─────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token manquant." });
  }

  try {
    const decoded = JWT.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalide ou expiré." });
  }
};

// ─────────────────────────────────────────
// GET USERNAME FROM TOKEN
// ─────────────────────────────────────────
router.post("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("username");

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    res.status(200).json({ username: user.username });
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Erreur lors de la récupération du nom d'utilisateur.",
      });
  }
});

export default router;
























