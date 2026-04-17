import express from "express";
import crypto from "crypto";
import multer from "multer";
import User from "../models/client.js";
import isAdmin from "../middleware/isadmin.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) return cb(null, true);
    return cb(new Error("Le fichier doit etre une video."));
  },
});

const REQUIRED_B2_ENV = ["B2_KEY_ID", "B2_APPLICATION_KEY", "B2_BUCKET_ID"];
const getMissingB2Env = () => REQUIRED_B2_ENV.filter((key) => !process.env[key]);

const sanitizeName = (value) =>
  String(value || "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toSafePathSegment = (value, fallback) => {
  const clean = sanitizeName(value);
  return clean || fallback;
};

const getB2Auth = async (retries = 3) => {
  const credentials = Buffer.from(
    `${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`
  ).toString("base64");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
        {
          method: "GET",
          headers: { Authorization: `Basic ${credentials}` },
          signal: AbortSignal.timeout(30000), // 30 secondes
        }
      );

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Echec autorisation B2: ${response.status} ${details}`);
      }

      return response.json();

    } catch (err) {
      console.warn(`Auth B2 tentative ${attempt}/${retries} échouée:`, err.message);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      } else {
        throw err;
      }
    }
  }
};
const getB2UploadSlot = async ({ apiUrl, authorizationToken }) => {
  const response = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId: process.env.B2_BUCKET_ID }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Echec upload URL B2: ${response.status} ${details}`);
  }
  return response.json();
};

const uploadToB2Small = async ({ buffer, fileName, contentType, uploadUrl, uploadAuthToken }) => {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: uploadAuthToken,
      "X-Bz-File-Name": encodeURIComponent(fileName),
      "Content-Type": contentType || "b2/x-auto",
      "Content-Length": String(buffer.length),
      "X-Bz-Content-Sha1": "do_not_verify",
    },
    body: buffer,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Echec upload B2: ${response.status} ${details}`);
  }
  return response.json();
};

const CHUNK_SIZE = 100 * 1024 * 1024;

const uploadToB2Large = async ({ buffer, fileName, contentType, apiUrl, authorizationToken }) => {
  const startRes = await fetch(`${apiUrl}/b2api/v3/b2_start_large_file`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: process.env.B2_BUCKET_ID,
      fileName: encodeURIComponent(fileName),
      contentType: contentType || "b2/x-auto",
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!startRes.ok) {
    const details = await startRes.text();
    throw new Error(`Echec start large file B2: ${startRes.status} ${details}`);
  }

  const { fileId } = await startRes.json();

  const partCount = Math.ceil(buffer.length / CHUNK_SIZE);
  const partSha1Array = [];

  for (let i = 0; i < partCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, buffer.length);
    const chunk = buffer.slice(start, end);
    const partNumber = i + 1;

    // Calcul SHA1 réel du chunk
    const chunkSha1 = crypto.createHash("sha1").update(chunk).digest("hex");

    let partData = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const partUrlRes = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_part_url`, {
          method: "POST",
          headers: {
            Authorization: authorizationToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileId }),
          signal: AbortSignal.timeout(30000),
        });

        if (!partUrlRes.ok) {
          const details = await partUrlRes.text();
          throw new Error(`Echec get part URL B2: ${partUrlRes.status} ${details}`);
        }

        const { uploadUrl, authorizationToken: partAuthToken } = await partUrlRes.json();

        const partRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: partAuthToken,
            "X-Bz-Part-Number": String(partNumber),
            "Content-Length": String(chunk.length),
            "X-Bz-Content-Sha1": chunkSha1, // ✅ SHA1 réel
          },
          body: chunk,
          signal: AbortSignal.timeout(120000),
        });

        if (!partRes.ok) {
          const details = await partRes.text();
          throw new Error(`Echec upload partie ${partNumber} B2: ${partRes.status} ${details}`);
        }

        partData = await partRes.json();
        break;

      } catch (err) {
        lastError = err;
        console.warn(`Partie ${partNumber} tentative ${attempt}/3 échouée:`, err.message);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    }

    if (!partData) {
      throw lastError || new Error(`Echec upload partie ${partNumber} après 3 tentatives`);
    }

    partSha1Array.push(partData.contentSha1); // B2 retourne le SHA1 confirmé
    console.log(`Partie ${partNumber}/${partCount} uploadée`);
  }

  const finishRes = await fetch(`${apiUrl}/b2api/v3/b2_finish_large_file`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId, partSha1Array }),
    signal: AbortSignal.timeout(30000),
  });

  if (!finishRes.ok) {
    const details = await finishRes.text();
    throw new Error(`Echec finish large file B2: ${finishRes.status} ${details}`);
  }

  return finishRes.json();
};

router.get("/clients", isAdmin, async (req, res) => {
  try {
    const clients = await User.find({ role: "client" })
      .select("username email status")
      .sort({ createdAt: -1 });
    return res.status(200).json({ clients });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/upload", isAdmin, (req, res, next) => {
  upload.single("video")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Fichier trop volumineux. Maximum : 2GB." });
    }
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const missingEnv = getMissingB2Env();
    if (missingEnv.length > 0) {
      return res.status(500).json({
        message: "Configuration Backblaze manquante.",
        missingEnv,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Le fichier video est requis (champ form-data: video).",
      });
    }

    const title = toSafePathSegment(req.body?.title, "video");
    const courseSlug = toSafePathSegment(req.body?.courseSlug, "cours");
    const chapterOrder = toSafePathSegment(req.body?.chapterOrder, "0");
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(4).toString("hex");
    const extension = req.file.originalname.includes(".")
      ? req.file.originalname.substring(req.file.originalname.lastIndexOf("."))
      : "";

    const fileName = `formations/${courseSlug}/chapter-${chapterOrder}/${timestamp}-${title}-${randomPart}${extension}`;

    const auth = await getB2Auth();
    // ✅ FIX : token racine pour large file, apiUrl depuis storageApi
    const apiUrl = auth.apiInfo.storageApi.apiUrl;
    const authorizationToken = auth.authorizationToken;

    let uploaded;

    if (req.file.buffer.length >= 200 * 1024 * 1024) {
      console.log("Fichier >= 200MB → large file upload");
      uploaded = await uploadToB2Large({
        buffer: req.file.buffer,
        fileName,
        contentType: req.file.mimetype,
        apiUrl,
        authorizationToken,
      });
    } else {
      console.log("Fichier < 200MB → upload normal");
      const uploadSlot = await getB2UploadSlot({ apiUrl, authorizationToken });
      uploaded = await uploadToB2Small({
        buffer: req.file.buffer,
        fileName,
        contentType: req.file.mimetype,
        uploadUrl: uploadSlot.uploadUrl,
        uploadAuthToken: uploadSlot.authorizationToken,
      });
    }

    return res.status(201).json({
      message: "Upload video reussi.",
      publicId: uploaded.fileName,
      fileId: uploaded.fileId,
    });
  } catch (err) {
    console.error("Erreur upload Backblaze:", err);
    return res.status(500).json({
      message: "Erreur lors de l'upload video.",
      details: err.message,
    });
  }
});

export default router;