import express from "express";
import JWT from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/client.js";

const router = express.Router();

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

router.put("/change-password", verifyToken, async (req, res) => {
	const { currentPassword, password, newPassword } = req.body;
	const oldPassword = currentPassword || password;

	if (!oldPassword || !newPassword) {
		return res.status(400).json({
			message: "Mot de passe actuel et nouveau mot de passe requis.",
		});
	}

	if (newPassword.length < 8) {
		return res.status(400).json({
			message: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
		});
	}

	try {
		const user = await User.findById(req.userId);

		if (!user) {
			return res.status(404).json({ message: "Utilisateur non trouvé." });
		}

		if (!user.password) {
			return res.status(400).json({
				message: "Ce compte n'utilise pas de mot de passe .",
			});
		}

		const isMatch = await bcrypt.compare(oldPassword, user.password);
		if (!isMatch) {
			return res.status(400).json({
				message: "Mot de passe actuel incorrect.",
			});
		}

		user.password = await bcrypt.hash(newPassword, 10);
		await user.save();

		return res.status(200).json({
			message: "Mot de passe modifié avec succès.",
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ message: "Erreur serveur." });
	}
});

export default router;
