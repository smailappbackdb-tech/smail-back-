import mongoose from "mongoose";

const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    watched: {
      type: Boolean,
      default: false,
    },
    watchedAt: {
      type: Date,
      default: null,
    },
    watchedDuration: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

progressSchema.index({ userId: 1, videoId: 1 }, { unique: true });

const Progress = mongoose.model("Progress", progressSchema);

export default Progress;
