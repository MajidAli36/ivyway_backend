const express = require("express");
const router = express.Router();
const tutorController = require("../controllers/tutor.controller");
const {
  authenticateUser,
  authorizeRoles,
} = require("../middleware/auth.middleware");
const { upload } = require("../utils/file-upload");

// Public routes
router.get("/", tutorController.getAllTutors);
router.get("/subject/:subject", tutorController.getTutorsBySubject);
router.get("/:id", tutorController.getTutorById);

// Public admin routes
router.put(
  "/:id/profile",
  upload.single("profileImage"),
  tutorController.createUpdateTutorProfile
);

router.delete("/:id/profile", tutorController.deleteTutorProfile);

// Protected routes
router.use(authenticateUser);

// Get current tutor's profile (tutors only)
router.get(
  "/profile/me",
  authorizeRoles("tutor"),
  tutorController.getMyTutorProfile
);

// Create/update tutor profile (tutors and admins) with file upload support
router.put(
  "/profile",
  authorizeRoles("tutor"),
  upload.single("profileImage"),
  tutorController.createUpdateTutorProfile
);

module.exports = router;
