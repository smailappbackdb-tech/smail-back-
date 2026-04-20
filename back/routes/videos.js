import express from "express";
import isValidClient from "../middleware/isvalid.js";
import Video from "../models/video.js";
import Progress from "../models/progress.js";

const router = express.Router();

const REQUIRED_ENV = ["VIDEO_CDN_BASE_URL", "CDN_SIGNING_SECRET"];
const LOG_PREFIX = "[videos]";

const getMissingEnv = () => REQUIRED_ENV.filter((key) => !process.env[key]);

const decodeStoragePath = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
};

const normalizeStoragePathForSigning = (value) => {
  const normalized = String(value || "").trim().replace(/^\/+/, "");
  if (!normalized) return "";

  // Legacy objects may have been uploaded with encoded separators (%2F) as literal chars.
  // In that case we must preserve %2F for signature and URL generation.
  if (/%2F/i.test(normalized)) {
    return normalized;
  }

  return decodeStoragePath(normalized);
};

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
      Math.ceil((existing.resetAt - now) / 1000)
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
      VIDEO_RATE_LIMIT_MAX_REQUESTS - existing.count
    ),
    "X-RateLimit-Reset": String(Math.floor(existing.resetAt / 1000)),
  });

  return next();
};

// ─────────────────────────────────────────────────────────────
// GET /api/videos/:videoId/url — Obtenir URL signée de la vidéo
// ─────────────────────────────────────────────────────────────
router.get("/:videoId/url", isValidClient, videoRateLimit, async (req, res) => {
  try {
    console.log(`${LOG_PREFIX} GET /:videoId/url`, {
      videoId: req.params.videoId,
      userId: req.userId,
      role: req.user?.role,
      status: req.user?.status,
    });

    if (req.user?.role !== "client" || req.user?.status !== true) {
      console.warn(`${LOG_PREFIX} accès refusé à l'URL vidéo`, {
        videoId: req.params.videoId,
        userId: req.userId,
        role: req.user?.role,
        status: req.user?.status,
      });

      return res.status(403).json({
        message: "Déverrouillez pour accéder au contenu.",
      });
    }

    const missingEnv = getMissingEnv();
    if (missingEnv.length > 0) {
      console.error(`${LOG_PREFIX} variables CDN manquantes`, missingEnv);
      return res.status(500).json({
        message: "Configuration vidéo manquante sur le serveur.",
      });
    }

    const { videoId } = req.params;

    const video = await Video.findById(videoId);
    if (!video) {
      console.warn(`${LOG_PREFIX} vidéo introuvable`, { videoId });
      return res.status(404).json({ message: "Vidéo non trouvée." });
    }

    // Le chemin B2 est stocké en base dans b2FileName, avec fallback legacy sur publicId.
    const storagePath = normalizeStoragePathForSigning(
      video.b2FileName || video.publicId
    );

    if (!storagePath) {
      console.warn(`${LOG_PREFIX} chemin vidéo manquant en base`, { videoId });
      return res.status(404).json({ message: "Vidéo introuvable." });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 minutes

    const baseCdnUrl = String(process.env.VIDEO_CDN_BASE_URL || "").replace(
      /\/+$/,
      ""
    );

    // ✅ Chemin RAW (sans encodage) — c'est ce que url.pathname retourne dans le worker
    // Le worker décode automatiquement les segments, donc on doit signer le chemin brut
    const rawPath = `/${String(storagePath).replace(/^\/+/, "")}`;

    // ✅ Chemin encodé segment par segment — uniquement pour construire l'URL HTTP finale
    const encodedPath = String(storagePath)
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    // On signe rawPath (identique à url.pathname côté worker)
    const messageToSign = `${rawPath}:${expiresAt}:${req.userId}`;
    const token = await signUrl(messageToSign, process.env.CDN_SIGNING_SECRET);
    // ✅ token encodé dans l'URL pour éviter les caractères spéciaux base64 (+, /, =)
    const videoUrl = `${baseCdnUrl}/${encodedPath}?token=${encodeURIComponent(token)}&expires=${expiresAt}&uid=${req.userId}`;
    console.log(`${LOG_PREFIX} URL signée générée`, {
      videoId,
      videoTitle: video.title,
      expiresAt,
    });

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

// ─────────────────────────────────────────────────────────────
// POST /api/videos/:videoId/mark-watched — Marquer vidéo vue
// ─────────────────────────────────────────────────────────────
router.post("/:videoId/mark-watched", isValidClient, async (req, res) => {
  try {
    console.log(`${LOG_PREFIX} POST /:videoId/mark-watched`, {
      videoId: req.params.videoId,
      userId: req.userId,
      watchedDuration: req.body?.watchedDuration,
    });

    if (!req.user?.status) {
      console.warn(`${LOG_PREFIX} marquage vue refusé`, {
        videoId: req.params.videoId,
        userId: req.userId,
      });

      return res.status(403).json({ message: "Accès refusé." });
    }

    const { videoId } = req.params;
    const { watchedDuration } = req.body;
    const userId = req.userId;

    const video = await Video.findById(videoId);
    if (!video) {
      console.warn(`${LOG_PREFIX} vidéo introuvable pour marquage vue`, { videoId });
      return res.status(404).json({ message: "Vidéo non trouvée." });
    }

    const progress = await Progress.findOneAndUpdate(
      { userId, videoId },
      {
        watched: true,
        watchedAt: new Date(),
        watchedDuration: watchedDuration || 0,
      },
      { upsert: true, new: true }
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
    console.error(`${LOG_PREFIX} erreur marquer vidéo vue`, error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/videos/:videoId/check — Debug existence CDN
// ─────────────────────────────────────────────────────────────
router.get("/:videoId/check", isValidClient, async (req, res) => {
  console.log(`${LOG_PREFIX} GET /:videoId/check`, {
    videoId: req.params.videoId,
    userId: req.userId,
  });

  const video = await Video.findById(req.params.videoId);
  if (!video) {
    console.warn(`${LOG_PREFIX} check CDN: vidéo introuvable`, {
      videoId: req.params.videoId,
    });

    return res.status(404).json({ message: "Vidéo non trouvée en DB" });
  }

  try {
    const baseCdnUrl = String(process.env.VIDEO_CDN_BASE_URL || "").replace(
      /\/+$/,
      ""
    );

  // ✅ Décode le chemin B2 avant de construire rawPath
const decodedStoragePath = normalizeStoragePathForSigning(
  video.b2FileName || video.publicId || ""
);

if (!decodedStoragePath) {
  console.warn(`${LOG_PREFIX} chemin vidéo manquant en base`, { videoId: req.params.videoId });
  return res.status(404).json({ message: "Vidéo introuvable." });
}

const rawPath = `/${String(decodedStoragePath).replace(/^\/+/, "")}`;

const encodedPath = String(decodedStoragePath)
  .split("/")
  .filter(Boolean)
  .map((segment) => encodeURIComponent(segment))
  .join("/");

    const expiresAt = Math.floor(Date.now() / 1000) + 900;

    // ✅ Même logique que la route principale : signer rawPath
    const token = await signUrl(
      `${rawPath}:${expiresAt}:${req.userId}`,
      process.env.CDN_SIGNING_SECRET
    );

    const videoUrl = `${baseCdnUrl}/${encodedPath}?token=${encodeURIComponent(token)}&expires=${expiresAt}&uid=${req.userId}`;

    const check = await fetch(videoUrl, { method: "HEAD" });

    console.log(`${LOG_PREFIX} check CDN HEAD`, {
      videoId: req.params.videoId,
      status: check.status,
      ok: check.ok,
    });

    if (!check.ok) {
      return res.status(404).json({
        exists: false,
        status: check.status,
        publicId: video.b2FileName || video.publicId,
        uid: req.userId,
      });
    }

    return res.json({ exists: true, publicId: video.b2FileName || video.publicId, url: videoUrl });
  } catch (err) {
    console.error(`${LOG_PREFIX} erreur check CDN`, err);
    return res.status(404).json({ exists: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Fonction de signature HMAC-SHA256 → base64
// ─────────────────────────────────────────────────────────────
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