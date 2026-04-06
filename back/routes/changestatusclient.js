import express from "express";
import User from "../models/client.js";
import isAdmin from "../middleware/isadmin.js";

const router = express.Router();

router.put("/:id/validate", isAdmin, async (req, res) => {
	const { status } = req.body;

	if (status === undefined || typeof status !== "boolean") {
		return res.status(400).json({
			message: "Le champ 'status' est requis et doit être booléen (true ou false).",
		});
	}

	try {
		const client = await User.findById(req.params.id);

		if (!client) {
			return res.status(404).json({ message: "Client non trouvé." });
		}

		if (client.role !== "client") {
			return res.status(400).json({
				message: "L'utilisateur ciblé n'est pas un client.",
			});
		}

		client.status = status;
		await client.save();

		return res.status(200).json({
			message: `Client ${status ? "validé" : "invalidé"} avec succès.`,
			client: {
				id: client._id,
				username: client.username,
				email: client.email,
				status: client.status,
			},
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ message: "Erreur serveur." });
	}
});

export default router;
