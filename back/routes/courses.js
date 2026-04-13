import express from "express";
import Course from "../models/course.js";
import Chapter from "../models/chapter.js";
import Video from "../models/video.js";
import Progress from "../models/progress.js";
import isValidClient from "../middleware/isvalid.js";

const router = express.Router();

// GET /api/courses/:courseSlug - Obtenir un cours avec chapitres et vidéos
router.get("/:courseSlug", isValidClient, async (req, res) => {
  try {
    const { courseSlug } = req.params;
    const userId = req.userId;

    // Pas de vérification status ici - la structure est TOUJOURS visible
    // L'accès aux URLs vidéo est contrôlé dans GET /api/videos/:videoId/url

    // Obtenir le cours
    const course = await Course.findOne({ slug: courseSlug });
    if (!course) {
      return res.status(404).json({ message: "Cours non trouvé." });
    }

    // Obtenir tous les chapitres du cours
    const chapters = await Chapter.find({ courseId: course._id }).sort({
      order: 1,
    });

    if (chapters.length === 0) {
      return res.status(200).json({
        course: {
          id: course._id,
          title: course.title,
          description: course.description,
          slug: course.slug,
        },
        chapters: [],
      });
    }

    const chapterIds = chapters.map((ch) => ch._id);

    // Obtenir toutes les vidéos
    const videos = await Video.find({ chapterId: { $in: chapterIds } }).sort({
      order: 1,
    });

    const videoIds = videos.map((v) => v._id);

    // Obtenir la progression de l'utilisateur (seulement si authentifié)
    let progressData = [];
    if (userId) {
      progressData = await Progress.find({
        userId,
        videoId: { $in: videoIds },
      });
    }

    const progressMap = new Map();
    progressData.forEach((p) => {
      progressMap.set(p.videoId.toString(), {
        watched: p.watched,
        watchedAt: p.watchedAt,
        watchedDuration: p.watchedDuration,
      });
    });

    // Structurer la réponse
    const chaptersWithVideos = chapters.map((chapter) => {
      const chapterVideos = videos
        .filter((v) => v.chapterId.toString() === chapter._id.toString())
        .map((video) => {
          const progress = progressMap.get(video._id.toString()) || {
            watched: false,
            watchedAt: null,
            watchedDuration: 0,
          };

          return {
            id: video._id,
            title: video.title,
            description: video.description,
            order: video.order,
            duration: video.duration,
            isActive: video.isActive,
            progress: {
              watched: progress.watched,
              watchedAt: progress.watchedAt,
              watchedDuration: progress.watchedDuration,
            },
          };
        });

      return {
        id: chapter._id,
        title: chapter.title,
        description: chapter.description,
        order: chapter.order,
        videos: chapterVideos,
        videoCount: chapterVideos.length,
        watchedCount: chapterVideos.filter((v) => v.progress.watched).length,
      };
    });

    return res.status(200).json({
      course: {
        id: course._id,
        title: course.title,
        description: course.description,
        slug: course.slug,
      },
      chapters: chaptersWithVideos,
      totalChapters: chaptersWithVideos.length,
      totalVideos: videos.length,
      totalWatched: progressMap.size > 0
        ? Array.from(progressMap.values()).filter((p) => p.watched).length
        : 0,
    });
  } catch (error) {
    console.error("Erreur route cours:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
