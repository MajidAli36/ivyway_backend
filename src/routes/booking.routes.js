const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/booking.controller");
const {
  authenticateUser,
  authorizeRoles,
} = require("../middleware/auth.middleware");

// All routes require authentication
router.use(authenticateUser);

// Create a new booking (for students)
router.post("/", bookingController.createBooking);

// Get student's bookings
router.get("/my", bookingController.getStudentBookings);

// Get provider's bookings
router.get(
  "/provider",
  authorizeRoles("tutor", "counselor"),
  bookingController.getProviderBookings
);

// Tutor dashboard endpoints
// Get pending session requests for a tutor
router.get(
  "/requests/pending",
  authorizeRoles("tutor", "counselor", "admin"),
  bookingController.getPendingRequests
);

// Get all session requests for a tutor with optional filtering
router.get(
  "/requests/all",
  authorizeRoles("tutor", "counselor", "admin"),
  bookingController.getAllRequests
);

// Update session request status (confirm/cancel) - tutors and counselors only
router.put(
  "/requests/:id",
  authorizeRoles("tutor", "counselor"), // Removed "admin" from the authorized roles
  bookingController.updateRequestStatus
);

// Admin endpoint to view any tutor's requests
router.get(
  "/admin/tutor/:tutorId/requests",
  authorizeRoles("admin"),
  bookingController.getTutorRequestsAdmin
);

// Get booking by ID
router.get("/:id", bookingController.getBookingById);

// Cancel a booking
router.put("/:id/cancel", bookingController.cancelBooking);

// Update booking status (providers only)
router.patch(
  "/:id/status",
  authorizeRoles("tutor", "counselor", "admin"),
  bookingController.updateBookingStatus
);

module.exports = router;
