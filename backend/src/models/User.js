import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
      required: true,
    },
    otp_token: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isLoggedIn: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 1,
    },
    passToken: {
      type: String,
      default: null,
    },
    passVerified: {
      type: Boolean,
      default: false,
    },
    passExpiresAt: {
      type: Date,
      default: null,
    },
    phone_number: {
      type: Number,
      unique: true,
      sparse: true,
    },
    lat: {
      type: Number,
      default: null,
    },
    lon: {
      type: Number,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const deriveFallbackName = (emailValue) => {
  const email = String(emailValue || "").toLowerCase().trim();
  const localPart = email.split("@")[0] || "";
  const cleaned = localPart
    .replace(/[^a-z0-9._-]/gi, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "FlowBot User";
  }

  return cleaned
    .split(" ")
    .map((word) =>
      word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : "",
    )
    .join(" ")
    .trim();
};

// Backfill legacy records that were created before `name` became mandatory.
userSchema.pre("validate", function setMissingName() {
  const normalizedName = String(this.name || "").trim();
  if (!normalizedName) {
    this.name = deriveFallbackName(this.email);
  }
});

const User = mongoose.model("User", userSchema);
export default User;
