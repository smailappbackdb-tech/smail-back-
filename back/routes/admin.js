import express from "express";
import isAdmin from "../middleware/isadmin.js";
import Course from "../models/course.js";
import Chapter from "../models/chapter.js";
import Video from "../models/video.js";

const router = express.Router();

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};


router.use(isAdmin);

// GET /api/admin/courses
router.get("/courses", async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Liste des cours recuperee avec succes.",
      courses,
    });
  } catch (error) {
    console.error("Erreur liste cours:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// PUT /api/admin/courses/:courseId
router.put("/courses/:courseId", async (req, res) => {
  const { courseId } = req.params;
  const { title, slug, description } = req.body;

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Cours non trouve." });
    }

    if (title !== undefined) {
      const normalizedTitle = String(title).trim();
      if (!normalizedTitle) {
        return res.status(400).json({ message: "title invalide." });
      }

      const duplicateTitle = await Course.findOne({
        _id: { $ne: courseId },
        title: normalizedTitle,
      });
      if (duplicateTitle) {
        return res.status(409).json({ message: "Ce title existe deja." });
      }

      course.title = normalizedTitle;
    }

    if (slug !== undefined) {
      const normalizedSlug = String(slug).trim().toLowerCase();
      if (!normalizedSlug) {
        return res.status(400).json({ message: "slug invalide." });
      }

      const duplicateSlug = await Course.findOne({
        _id: { $ne: courseId },
        slug: normalizedSlug,
      });
      if (duplicateSlug) {
        return res.status(409).json({ message: "Ce slug existe deja." });
      }

      course.slug = normalizedSlug;
    }

    if (description !== undefined) {
      course.description = String(description || "").trim();
    }

    await course.save();

    return res.status(200).json({
      message: "Cours mis a jour avec succes.",
      course,
    });
  } catch (error) {
    console.error("Erreur update cours:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// DELETE /api/admin/courses/:courseId
router.delete("/courses/:courseId", async (req, res) => {
  const { courseId } = req.params;

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Cours non trouve." });
    }

    const chapters = await Chapter.find({ courseId }).select("_id");
    const chapterIds = chapters.map((chapter) => chapter._id);

    const deletedVideos = await Video.deleteMany({ chapterId: { $in: chapterIds } });
    const deletedChapters = await Chapter.deleteMany({ courseId });
    await Course.deleteOne({ _id: courseId });

    return res.status(200).json({
      message: "Cours supprime avec succes.",
      deleted: {
        courses: 1,
        chapters: deletedChapters.deletedCount,
        videos: deletedVideos.deletedCount,
      },
    });
  } catch (error) {
    console.error("Erreur suppression cours:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// GET /api/admin/courses/:courseId/chapters
router.get("/courses/:courseId/chapters", async (req, res) => {
  const { courseId } = req.params;

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Cours non trouve." });
    }

    const chapters = await Chapter.find({ courseId }).sort({ order: 1 });

    return res.status(200).json({
      message: "Liste des chapitres recuperee avec succes.",
      course,
      chapters,
    });
  } catch (error) {
    console.error("Erreur liste chapitres:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// PUT /api/admin/chapters/:chapterId
router.put("/chapters/:chapterId", async (req, res) => {
  const { chapterId } = req.params;
  const { title, order, description } = req.body;
  const parsedOrder = order !== undefined ? toNumber(order) : undefined;

  if (order !== undefined && parsedOrder === null) {
    return res.status(400).json({ message: "order doit etre un number." });
  }

  try {
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: "Chapitre non trouve." });
    }

    if (title !== undefined) {
      const normalizedTitle = String(title).trim();
      if (!normalizedTitle) {
        return res.status(400).json({ message: "title invalide." });
      }
      chapter.title = normalizedTitle;
    }

    if (parsedOrder !== undefined) {
      const duplicateOrder = await Chapter.findOne({
        _id: { $ne: chapterId },
        courseId: chapter.courseId,
        order: parsedOrder,
      });
      if (duplicateOrder) {
        return res.status(409).json({
          message: "Un chapitre avec ce order existe deja pour ce cours.",
        });
      }
      chapter.order = parsedOrder;
    }

    if (description !== undefined) {
      chapter.description = String(description || "").trim();
    }

    await chapter.save();

    return res.status(200).json({
      message: "Chapitre mis a jour avec succes.",
      chapter,
    });
  } catch (error) {
    console.error("Erreur update chapitre:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// DELETE /api/admin/chapters/:chapterId
router.delete("/chapters/:chapterId", async (req, res) => {
  const { chapterId } = req.params;

  try {
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: "Chapitre non trouve." });
    }

    const deletedVideos = await Video.deleteMany({ chapterId });
    await Chapter.deleteOne({ _id: chapterId });

    return res.status(200).json({
      message: "Chapitre supprime avec succes.",
      deleted: {
        chapters: 1,
        videos: deletedVideos.deletedCount,
      },
    });
  } catch (error) {
    console.error("Erreur suppression chapitre:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// GET /api/admin/chapters/:chapterId/videos
router.get("/chapters/:chapterId/videos", async (req, res) => {
  const { chapterId } = req.params;

  try {
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: "Chapitre non trouve." });
    }

    const videos = await Video.find({ chapterId }).sort({ order: 1 });

    return res.status(200).json({
      message: "Liste des videos recuperee avec succes.",
      chapter,
      videos,
    });
  } catch (error) {
    console.error("Erreur liste videos:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// PUT /api/admin/videos/:videoId
router.put("/videos/:videoId", async (req, res) => {
  const { videoId } = req.params;
  const { title, publicId, order, duration, description, isActive } = req.body;
  const normalizedIncomingPublicId = String(publicId || "").trim();
  const parsedOrder = order !== undefined ? toNumber(order) : undefined;
  const parsedDuration = duration !== undefined ? toNumber(duration) : undefined;

  if (order !== undefined && parsedOrder === null) {
    return res.status(400).json({ message: "order doit etre un number." });
  }

  if (duration !== undefined && parsedDuration === null) {
    return res.status(400).json({ message: "duration doit etre un number." });
  }

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: "Video non trouvee." });
    }

    if (title !== undefined) {
      const normalizedTitle = String(title).trim();
      if (!normalizedTitle) {
        return res.status(400).json({ message: "title invalide." });
      }
      video.title = normalizedTitle;
    }

    if (publicId !== undefined) {
      const normalizedPublicId = normalizedIncomingPublicId;
      if (!normalizedPublicId) {
        return res.status(400).json({ message: "publicId invalide." });
      }

      const duplicatePublicId = await Video.findOne({
        _id: { $ne: videoId },
        publicId: normalizedPublicId,
      });
      if (duplicatePublicId) {
        return res.status(409).json({
          message: "Cette video existe deja.",
        });
      }

      video.publicId = normalizedPublicId;
    }

    if (parsedOrder !== undefined) {
      const duplicateOrder = await Video.findOne({
        _id: { $ne: videoId },
        chapterId: video.chapterId,
        order: parsedOrder,
      });
      if (duplicateOrder) {
        return res.status(409).json({
          message: "Une video avec ce order existe deja pour ce chapitre.",
        });
      }

      video.order = parsedOrder;
    }

    if (parsedDuration !== undefined) {
      video.duration = parsedDuration;
    }

    if (description !== undefined) {
      video.description = String(description || "").trim();
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive doit etre un boolean." });
      }
      video.isActive = isActive;
    }

    await video.save();

    return res.status(200).json({
      message: "Video mise a jour avec succes.",
      video,
    });
  } catch (error) {
    console.error("Erreur update video:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// DELETE /api/admin/videos/:videoId
router.delete("/videos/:videoId", async (req, res) => {
  const { videoId } = req.params;

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: "Video non trouvee." });
    }

    await Video.deleteOne({ _id: videoId });

    return res.status(200).json({
      message: "Video supprimee avec succes.",
      deleted: { videos: 1 },
    });
  } catch (error) {
    console.error("Erreur suppression video:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/admin/courses
router.post("/courses", async (req, res) => {
  const { title, slug, description = "" } = req.body;

  if (!title || !slug) {
    return res.status(400).json({
      message: "title et slug sont requis.",
    });
  }

  try {
    const normalizedSlug = slug.trim().toLowerCase();
    const existingCourse = await Course.findOne({
      $or: [{ title: title.trim() }, { slug: normalizedSlug }],
    });

    if (existingCourse) {
      return res.status(409).json({
        message: "Un cours avec ce title ou ce slug existe deja.",
      });
    }

    const course = await Course.create({
      title: title.trim(),
      slug: normalizedSlug,
      description: description?.trim?.() || "",
    });

    return res.status(201).json({
      message: "Cours cree avec succes.",
      course,
    });
  } catch (error) {
    console.error("Erreur creation cours:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/admin/chapters
router.post("/chapters", async (req, res) => {
  const { courseId, title, order, description = "" } = req.body;
  const parsedOrder = toNumber(order);

  if (!courseId || !title || parsedOrder === null) {
    return res.status(400).json({
      message: "courseId, title et order (number) sont requis.",
    });
  }

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Cours non trouve." });
    }

    const duplicateOrder = await Chapter.findOne({ courseId, order: parsedOrder });
    if (duplicateOrder) {
      return res.status(409).json({
        message: "Un chapitre avec ce order existe deja pour ce cours.",
      });
    }

    const chapter = await Chapter.create({
      courseId,
      title: title.trim(),
      order: parsedOrder,
      description: description?.trim?.() || "",
    });

    return res.status(201).json({
      message: "Chapitre cree avec succes.",
      chapter,
    });
  } catch (error) {
    console.error("Erreur creation chapitre:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/admin/videos
router.post("/videos", async (req, res) => {
  const {
    chapterId,
    title,
    publicId,
    order,
    duration = 0,
    description = "",
  } = req.body;
  const normalizedIncomingPublicId = String(publicId || "").trim();
  const parsedOrder = toNumber(order);
  const parsedDuration = toNumber(duration) ?? 0;

  if (!chapterId || !title || !normalizedIncomingPublicId || parsedOrder === null) {
    return res.status(400).json({
      message: "chapterId, title, publicId et order (number) sont requis.",
    });
  }

  try {
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: "Chapitre non trouve." });
    }

    const existingPublicId = await Video.findOne({
      publicId: normalizedIncomingPublicId,
    });
    if (existingPublicId) {
      return res.status(409).json({
        message: "Cette video existe deja.",
      });
    }

    const duplicateOrder = await Video.findOne({ chapterId, order: parsedOrder });
    if (duplicateOrder) {
      return res.status(409).json({
        message: "Une video avec ce order existe deja pour ce chapitre.",
      });
    }

    const video = await Video.create({
      chapterId,
      title: title.trim(),
      publicId: normalizedIncomingPublicId,
      order: parsedOrder,
      duration: parsedDuration,
      description: description?.trim?.() || "",
    });

    return res.status(201).json({
      message: "Video creee avec succes.",
      video,
    });
  } catch (error) {
    console.error("Erreur creation video:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
