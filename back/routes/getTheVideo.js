import express from "express";
import { v2 as cloudinary } from "cloudinary";
import isValidClient from "../middleware/isvalid.js";

const router = express.Router();

const REQUIRED_ENV = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_VIDEO_PUBLIC_ID",
];

const getMissingEnv = () => REQUIRED_ENV.filter((key) => !process.env[key]);

const VIDEO_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const VIDEO_RATE_LIMIT_MAX_REQUESTS = 5;
const videoRateLimitStore = new Map();

const cleanExpiredRateLimitEntries = (now) => {
  for (const [key, value] of videoRateLimitStore.entries()) {
    if (now > value.resetAt) {
      videoRateLimitStore.delete(key);
    }
  }
};

const videoRateLimit = (req, res, next) => {
  const now = Date.now();
  cleanExpiredRateLimitEntries(now);

  const key = req.userId ? String(req.userId) : req.ip;
  const existing = videoRateLimitStore.get(key);

  if (!existing || now > existing.resetAt) {
    const resetAt = now + VIDEO_RATE_LIMIT_WINDOW_MS;
    videoRateLimitStore.set(key, { count: 1, resetAt });

    res.set({
      "X-RateLimit-Limit": String(VIDEO_RATE_LIMIT_MAX_REQUESTS),
      "X-RateLimit-Remaining": String(VIDEO_RATE_LIMIT_MAX_REQUESTS - 1),
      "X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
    });

    return next();
  }

  if (existing.count >= VIDEO_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );

    res.set({
      "X-RateLimit-Limit": String(VIDEO_RATE_LIMIT_MAX_REQUESTS),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(existing.resetAt / 1000)),
      "Retry-After": String(retryAfterSeconds),
    });

    return res.status(429).json({
      message: "Trop de requetes. Reessaye dans quelques secondes.",
    });
  }

  existing.count += 1;
  videoRateLimitStore.set(key, existing);

  res.set({
    "X-RateLimit-Limit": String(VIDEO_RATE_LIMIT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(
      VIDEO_RATE_LIMIT_MAX_REQUESTS - existing.count,
    ),
    "X-RateLimit-Reset": String(Math.floor(existing.resetAt / 1000)),
  });

  return next();
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.get("/url", isValidClient, videoRateLimit, (req, res) => {
  try {
    if (req.user?.role !== "client" || req.user?.status !== true) {
      return res.status(403).json({
        message: "Accès refusé.",
      });
    }

    const missingEnv = getMissingEnv();
    if (missingEnv.length > 0) {
      console.error("Variables Cloudinary manquantes:", missingEnv);
      return res.status(500).json({
        message: "Configuration vidéo manquante sur le serveur.",
      });
    }

    const publicId = process.env.CLOUDINARY_VIDEO_PUBLIC_ID;

    // Fenetre courte pour limiter le risque de partage du lien.
    const expiresAt = Math.floor(Date.now() / 1000) + 120;

    const signedUrl = cloudinary.utils.private_download_url(publicId, "mp4", {
      resource_type: "video",
      expires_at: expiresAt,
      secure: true,
    });

    // Le lien signe ne doit pas etre conserve en cache navigateur/proxy.
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    });

    return res.status(200).json({
      url: signedUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("Erreur route vidéo:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;