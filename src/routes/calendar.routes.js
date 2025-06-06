const express = require("express");
const router = express.Router();
const calendarController = require("../controllers/calendar.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Apply authentication to all calendar routes
// router.use(authMiddleware.verifyToken);

router.use(authMiddleware.authenticateUser);
// Start Google Calendar OAuth flow
router.get(
  "/connect/google",
  calendarController.initiateGoogleCalendarConnection
);

// Google OAuth callback
router.get("/connect/google/callback", calendarController.handleGoogleCallback);

// Check if user has connected Google Calendar
// router.get("/status", calendarController.getConnectionStatus);

// Disconnect Google Calendar
router.delete("/connect/google", calendarController.disconnectGoogleCalendar);

// Sync with Google Calendar
// router.post("/sync", calendarController.syncWithGoogle);

module.exports = router;
