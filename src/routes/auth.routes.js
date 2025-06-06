const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticateUser } = require("../middleware/auth.middleware");

// Public routes
router.post("/register", authController.register);

// Protected routes
router.get("/profile", authenticateUser, authController.getProfile);

module.exports = router;
