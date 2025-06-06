const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middleware/auth.middleware");
const userController = require("../controllers/user.controller");
const bookingController = require("../controllers/booking.controller");

// Apply authentication to all admin routes
// router.use(authenticateUser);

// ===== USER MANAGEMENT ENDPOINTS =====

// Get all users with optional role filtering
router.get("/users", userController.getAllUsers);

// Get user by ID
router.get("/users/:id", userController.getUserById);

// Update user
router.put("/users/:id", async (req, res) => {
  try {
    const updatedUser = await userController.updateUserById(
      req.params.id,
      req.body
    );
    res.json({
      status: "success",
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    await userController.deleteUserById(req.params.id);
    res.json({
      status: "success",
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message,
    });
  }
});

// ===== SESSION MANAGEMENT ENDPOINTS =====

// Get all sessions/bookings with filtering options
router.get("/sessions", bookingController.getAllBookingsAdmin);

// Get session by ID
router.get("/sessions/:id", bookingController.getBookingById);

// Update session status (confirm, cancel, complete)
router.put("/sessions/:id/status", bookingController.updateBookingStatus);

// Delete session
router.delete("/sessions/:id", async (req, res) => {
  try {
    await bookingController.deleteBooking(req.params.id);
    res.json({
      status: "success",
      message: "Session deleted successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Get session statistics
router.get("/statistics/sessions", bookingController.getBookingStatistics);

// Get user statistics
router.get("/statistics/users", async (req, res) => {
  try {
    const stats = await userController.getUserStatistics();
    res.json({
      status: "success",
      message: "User statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Add this new endpoint for updating sessions
router.put("/sessions/:id", async (req, res) => {
  try {
    const updatedBooking = await bookingController.updateBooking(
      req.params.id,
      req.body,
      req.user || null  // Pass null if req.user is not available
    );
    
    // Send notification to the client about the booking update
    if (updatedBooking && updatedBooking.clientId) {
      const socketService = require('../services/socket.service');
      
      // Determine the notification type based on status
      let notificationType = 'updated';
      if (req.body.status === 'confirmed') {
        notificationType = 'confirmed';
      } else if (req.body.status === 'cancelled') {
        notificationType = 'cancelled';
      } else if (req.body.status === 'completed') {
        notificationType = 'completed';
      }
      
      // Send the notification
      socketService.sendBookingNotification(
        updatedBooking.clientId,
        updatedBooking.id,
        notificationType,
        {
          title: `Booking ${notificationType.charAt(0).toUpperCase() + notificationType.slice(1)}`,
          message: `Your booking has been ${notificationType}`,
          bookingDetails: {
            startTime: updatedBooking.startTime,
            endTime: updatedBooking.endTime,
            status: updatedBooking.status,
            providerName: updatedBooking.providerName
          }
        }
      );
    }
    
    res.json({
      status: "success",
      message: "Session updated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Get user statistics
router.get("/statistics/users", async (req, res) => {
  try {
    const stats = await userController.getUserStatistics();
    res.json({
      status: "success",
      message: "User statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

module.exports = router;
