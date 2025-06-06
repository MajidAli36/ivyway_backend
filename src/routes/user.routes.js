const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware.authenticateUser);

// Get user profile
router.get("/profile", userController.getProfile);

// Update user profile
router.put("/profile", userController.updateProfile);

// Get all tutors (for student booking)
router.get("/tutors", userController.getTutors);

module.exports = router;
