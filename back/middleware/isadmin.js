import JWT from "jsonwebtoken";
import User from "../models/client.js";

const isAdmin = async (req, res, next) => {
	const token = req.headers.authorization?.split(" ")[1];

	if (!token) {
		return res.status(401).json({ message: "Token manquant." });
	}

	try {
		const decoded = JWT.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id).select("role username");

		if (!user) {
			return res.status(404).json({ message: "Utilisateur non trouvé." });
		}

		if (user.role !== "admin") {
			return res.status(403).json({ message: "Accès réservé aux administrateurs." });
		}

		req.user = user;
		req.userId = user._id;
		next();
	} catch (err) {
		return res.status(401).json({ message: "Token invalide ou expiré." });
	}
};

export default isAdmin;
