const express = require("express");
const router = express.Router();

// Import all route modules
const userRoutes = require("./user.routes");
const bookingRoutes = require("./booking.routes");
const availabilityRoutes = require("./availability.routes");
const calendarRoutes = require("./calendar.routes");
const waitlistRoutes = require("./waitlist.routes");
const authRoutes = require("./auth.routes");
const tutorRoutes = require("./tutor.routes");
const adminRoutes = require("./admin.routes");
const messagingRoutes = require("./messaging.routes");
const notificationRoutes = require("./notification.routes");
const counselorProfileRoutes = require("./counselor-profile.routes");
// const studentProfileRoutes = require("./student-profile.routes");

// Register routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/bookings", bookingRoutes);
router.use("/availability", availabilityRoutes);
router.use("/calendar", calendarRoutes);
router.use("/waitlist", waitlistRoutes);
router.use("/tutors", tutorRoutes);
router.use("/messaging", messagingRoutes);
router.use("/admin", adminRoutes);
router.use("/notifications", notificationRoutes);
router.use("/counselor-profiles", counselorProfileRoutes);
// router.use("/student-profiles", studentProfileRoutes);

// API health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "API is running",
    timestamp: new Date(),
  });
});

module.exports = router;
