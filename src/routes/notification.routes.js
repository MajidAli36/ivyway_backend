const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { authenticateUser } = require("../middleware/auth.middleware");

// All routes require authentication
router.use(authenticateUser);

// Get current user's notifications
router.get("/", notificationController.getMyNotifications);

// Mark a notification as read
router.patch("/:notificationId/read", notificationController.markAsRead);

// Mark all notifications as read
router.patch("/read-all", notificationController.markAllAsRead);

module.exports = router;