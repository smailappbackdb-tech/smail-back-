// // routes/video.js
// const express = require('express');
// const router = express.Router();
// const cloudinary = require('cloudinary').v2;
// const verifyToken = require('../middlewares/verifyToken');
// const checkSubscription = require('../middlewares/checkSubscription');

// router.get('/video/:publicId', verifyToken, checkSubscription, (req, res) => {
//   try {
//     const { publicId } = req.params;

//     // Génère une URL signée qui expire dans 2 heures
//     const signedUrl = cloudinary.utils.private_download_url(
//       publicId,
//       'mp4',
//       {
//         resource_type: 'video',
//         expires_at: Math.floor(Date.now() / 1000) + 7200, // 2h
//       }
//     );

//     res.json({ url: signedUrl });

//   } catch (error) {
//     res.status(500).json({ message: "Erreur serveur" });
//   }
// });

// module.exports = router;