const express = require("express");
const router = express.Router();
const availabilityController = require("../controllers/availability.controller");
const {
  authenticateUser,
  authorizeRoles,
} = require("../middleware/auth.middleware");

router.use(authenticateUser);

// Create a new availability slot (tutor only)
router.post(
  "/",
  authorizeRoles("tutor", "counselor"),
  availabilityController.createAvailability
);

// Get tutor's availability (public or tutor's own)
router.get("/tutor/:providerId", availabilityController.getTutorAvailability);

// Get current tutor's availability
router.get(
  "/my",
  authorizeRoles("tutor", "counselor"),
  availabilityController.getMyAvailability
);

// Update an availability slot
router.put(
  "/:id",
  authorizeRoles("tutor", "counselor"),
  availabilityController.updateAvailability
);

// Delete an availability slot
router.delete(
  "/:id",
  authorizeRoles("tutor", "counselor"),
  availabilityController.deleteAvailability
);

module.exports = router;
