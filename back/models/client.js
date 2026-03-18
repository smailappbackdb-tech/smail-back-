import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false, // false car Google OAuth → pas de password
    },
    googleId: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["client", "admin"],
      default: "client",
    },
    status: {
      type: Boolean, // ✅ Boolean, pas String
      default: false,
    },

    // ✅ Requis pour ton forgot/reset password
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // ✅ ajoute createdAt et updatedAt automatiquement
  },
);

const User = mongoose.model("User", userSchema);

export default User;
