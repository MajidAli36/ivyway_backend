const express = require("express");
const router = express.Router();
const counselorProfileController = require("../controllers/counselor-profile.controller");
const {
  authenticateUser,
  authorizeRoles,
} = require("../middleware/auth.middleware");
const { upload } = require("../utils/file-upload");

// Public routes
router.get("/", counselorProfileController.getAllCounselorProfiles);
router.get(
  "/user/:userId",
  counselorProfileController.getCounselorProfileByUserId
);

// Protected routes - only for counselors and admins
router.use(authenticateUser);

// Get my profile - for counselors
router.get(
  "/me",
  authorizeRoles("counselor"),
  counselorProfileController.getMyProfile
);

// Update my profile - for counselors
router.put(
  "/me",
  authorizeRoles("counselor"),
  upload.single("profileImage"),
  counselorProfileController.updateCounselorProfile
);

// Admin routes
router.delete(
  "/:userId",
  authorizeRoles("admin"),
  counselorProfileController.deleteCounselorProfile
);

module.exports = router;
