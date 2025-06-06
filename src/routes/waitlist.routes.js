const express = require("express");
const router = express.Router();
const waitlistController = require("../controllers/waitlist.controller");
const {
  authenticateUser,
  authorizeRoles,
} = require("../middleware/auth.middleware");

// Public route - anyone can join the waitlist
router.post("/", waitlistController.addToWaitlist);

// Protected route - only admins can view the waitlist
router.get("/", waitlistController.getWaitlistUsers);

module.exports = router;
