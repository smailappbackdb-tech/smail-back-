// models/video.model.js

import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
    },
    courseSlug: {
      type: String,
      required: true,
      trim: true,
    },
    b2FileId: {
      type: String,
      required: true,
    },
    b2FileName: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
    },
    size: {
      type: Number,
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

videoSchema.index({ courseSlug: 1, order: 1 });
videoSchema.index({ b2FileId: 1 }, { unique: true });
videoSchema.index({ b2FileName: 1 });

export default mongoose.model("Video", videoSchema);