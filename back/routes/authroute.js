import express from "express";
import JWT from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import User from "../models/client.js";
import passport from "../services/passport.js";

const router = express.Router();

// ─────────────────────────────────────────
// GOOGLE AUTH
// ─────────────────────────────────────────

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/api/auth/google/failure",
  }),
  (req, res) => {
    try {
      const token = JWT.sign({ id: req.user._id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      // Redirige vers le frontend avec le token dans l'URL
      res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Erreur lors de la génération du token." });
    }
  },
);

router.get("/google/failure", (req, res) => {
  res.status(401).json({ message: "Échec de l'authentification Google." });
});

// ─────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email déjà utilisé." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "Utilisateur créé avec succès." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email et mot de passe requis." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email introuvable." });
    }

    // Empêche le login classique si le compte est Google
    if (!user.password) {
      return res.status(400).json({
        message: "Ce compte utilise Google. Connectez-vous avec Google.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mot de passe incorrect." });
    }

    const token = JWT.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email requis." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Réponse volontairement vague pour éviter l'énumération d'emails
      return res.json({
        message:
          "Si cet email existe, un lien de réinitialisation a été envoyé.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1h
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    // 🚧 Temporaire — remplacer par sendResetPasswordEmail(user.email, resetUrl)
    console.log("Reset URL (dev only):", resetUrl);

    res.json({
      message: "Si cet email existe, un lien de réinitialisation a été envoyé.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ message: "Token et nouveau mot de passe requis." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      message: "Le mot de passe doit contenir au moins 8 caractères.",
    });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Token invalide ou expiré." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Mot de passe mis à jour avec succès." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// get user name :  
router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("username");
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }
    res.json({ username: user.username });
  } catch (err) {
    console.error(err);
      
    res.status(500).json({ message: "Erreur serveur." });

  }
});



export default router;
