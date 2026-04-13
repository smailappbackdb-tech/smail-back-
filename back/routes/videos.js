import express from "express";
import isValidClient from "../middleware/isvalid.js";
import Video from "../models/video.js";
import Progress from "../models/progress.js";

const router = express.Router();

const REQUIRED_ENV = ["VIDEO_CDN_BASE_URL", "CDN_SIGNING_SECRET"];

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

// GET /api/videos/:videoId/url - Obtenir URL signée de la vidéo
router.get("/:videoId/url", isValidClient, videoRateLimit, async (req, res) => {
  try {
    if (req.user?.role !== "client" || req.user?.status !== true) {
      return res.status(403).json({
        message: "Déverrouillez pour accéder au contenu.",
      });
    }

    const missingEnv = getMissingEnv();
    if (missingEnv.length > 0) {
      console.error("Variables CDN manquantes:", missingEnv);
      return res.status(500).json({
        message: "Configuration vidéo manquante sur le serveur.",
      });
    }

    const { videoId } = req.params;

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: "Vidéo non trouvée." });
    }

    const publicId = video.publicId;

    const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 minutes

    const baseCdnUrl = String(process.env.VIDEO_CDN_BASE_URL || "").replace(/\/+$/, "");
    const encodedPath = String(publicId)
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const path = `/${encodedPath}`;
    const token = await signUrl(`${path}:${expiresAt}`, process.env.CDN_SIGNING_SECRET);
    const videoUrl = `${baseCdnUrl}${path}?token=${token}&expires=${expiresAt}`;

    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    });

    return res.status(200).json({
      url: videoUrl,
      expiresAt,
      videoTitle: video.title,
    });
  } catch (error) {
    console.error("Erreur route vidéo URL:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/videos/:videoId/mark-watched - Marquer une vidéo comme vue
router.post("/:videoId/mark-watched", isValidClient, async (req, res) => {
  try {
    if (!req.user?.status) {
      return res.status(403).json({ message: "Accès refusé." });
    }

    const { videoId } = req.params;
    const { watchedDuration } = req.body;
    const userId = req.userId;

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: "Vidéo non trouvée." });
    }

    const progress = await Progress.findOneAndUpdate(
      { userId, videoId },
      {
        watched: true,
        watchedAt: new Date(),
        watchedDuration: watchedDuration || 0,
      },
      { upsert: true, new: true },
    );

    return res.status(200).json({
      message: "Vidéo marquée comme vue.",
      progress: {
        watched: progress.watched,
        watchedAt: progress.watchedAt,
        watchedDuration: progress.watchedDuration,
      },
    });
  } catch (error) {
    console.error("Erreur marquer vidéo vue:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// GET /api/videos/:videoId/check - Debug existence CDN
router.get("/:videoId/check", isValidClient, async (req, res) => {
  const video = await Video.findById(req.params.videoId);
  if (!video) return res.status(404).json({ message: "Vidéo non trouvée en DB" });

  try {
    const baseCdnUrl = String(process.env.VIDEO_CDN_BASE_URL || "").replace(/\/+$/, "");
    const encodedPath = String(video.publicId)
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const path = `/${encodedPath}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    const token = await signUrl(`${path}:${expiresAt}`, process.env.CDN_SIGNING_SECRET);
    const videoUrl = `${baseCdnUrl}${path}?token=${token}&expires=${expiresAt}`;

    const check = await fetch(videoUrl, { method: "HEAD" });

    if (!check.ok) {
      return res.status(404).json({ exists: false, status: check.status, publicId: video.publicId });
    }

    return res.json({ exists: true, publicId: video.publicId, url: videoUrl });
  } catch (err) {
    return res.status(404).json({ exists: false, error: err.message });
  }
});

async function signUrl(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export default router;