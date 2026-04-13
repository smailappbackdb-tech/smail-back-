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
    publicId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    duration: {
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

videoSchema.index({ chapterId: 1, order: 1 });

export default mongoose.model("Video", videoSchema);