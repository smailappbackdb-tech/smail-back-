import express from "express";
import User from "../models/client.js";
import isAdmin from "../middleware/isadmin.js";

const router = express.Router();

router.get("/clients", isAdmin, async (req, res) => {
	try {
		const clients = await User.find({ role: "client" })
			.select("username email status")
			.sort({ createdAt: -1 });

		return res.status(200).json({
			clients,
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ message: "Erreur serveur." });
	}
});

export default router;
