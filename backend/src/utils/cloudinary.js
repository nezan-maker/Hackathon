const isCloudinaryHostname = (hostname) => {
  const value = String(hostname || "").trim().toLowerCase();
  return value === "cloudinary.com" || value.endsWith(".cloudinary.com");
};

export const normalizeCloudinaryUrl = (url) => {
  const value = String(url || "").trim();
  if (!value) {
    return { valid: false, message: "url is required" };
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, message: "url must be an http/https URL" };
    }

    if (!isCloudinaryHostname(parsed.hostname)) {
      return {
        valid: false,
        message: "url must be a Cloudinary image URL",
      };
    }

    return { valid: true, url: parsed.toString() };
  } catch {
    return { valid: false, message: "url must be a valid URL" };
  }
};
