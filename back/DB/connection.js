import mongoose from "mongoose";
import dotenv from "dotenv";
import Video from "../models/video.js";

dotenv.config();

const dropLegacyVideoIndexes = async () => {
  try {
    const indexes = await Video.collection.indexes();
    const legacyIndexes = indexes.filter(
      (index) =>
        index?.key?.cloudinaryPublicId === 1 || index?.key?.publicId === 1
    );

    for (const legacyIndex of legacyIndexes) {
      await Video.collection.dropIndex(legacyIndex.name);
      console.log(`Dropped legacy index: ${legacyIndex.name}`);
    }
  } catch (error) {
    // Continue startup even if index cleanup fails.
    console.warn("Legacy video index cleanup skipped:", error.message);
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    await dropLegacyVideoIndexes();
    await Video.syncIndexes();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectDB;
