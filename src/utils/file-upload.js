const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { AppError } = require("./error-handler");

// Ensure upload directories exist
const createDirectoryIfNotExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Create upload directories
const uploadsDir = path.join(__dirname, "../../uploads");
const profileImagesDir = path.join(uploadsDir, "profile-images");

createDirectoryIfNotExists(uploadsDir);
createDirectoryIfNotExists(profileImagesDir);

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profileImagesDir);
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new AppError("Only image files are allowed!", 400), false);
  }
  cb(null, true);
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: fileFilter,
});

// Helper to get the public URL for a file
const getFileUrl = (filename) => {
  if (!filename) return null;
  return `/uploads/profile-images/${filename}`;
};

module.exports = {
  upload,
  getFileUrl,
  profileImagesDir,
};
