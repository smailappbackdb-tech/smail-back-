import JWT from "jsonwebtoken";
import User from "../models/client.js";

const isValidClient = async (req, res, next) => {
	const token = req.headers.authorization?.split(" ")[1];

	// Token is optional - allow requests to proceed and let handlers check status
	if (!token) {
		req.user = null;
		req.userId = null;
		return next();
	}

	try {
		const decoded = JWT.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id).select("username role status");

		if (!user) {
			return res.status(401).json({ message: "Utilisateur non trouvé." });
		}

		req.user = user;
		req.userId = user._id;
		next();
	} catch (err) {
		return res.status(401).json({ message: "Token invalide ou expiré." });
	}
};

export default isValidClient;
