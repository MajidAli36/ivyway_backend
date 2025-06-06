const { User } = require("../models");
const admin = require("firebase-admin");
const { success } = require("../utils/response-formatter");
const { catchAsync, badRequest } = require("../utils/error-handler");

/**
 * Register a new user or update existing user
 */
const register = catchAsync(async (req, res) => {
  const { idToken, fullName, role } = req.body;

  if (!idToken) {
    throw badRequest("Firebase ID token is required");
  }

  if (!role) {
    throw badRequest("Role is required");
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  const { uid, email } = decodedToken;

  // Check if user exists
  let user = await User.findOne({
    where: { id: uid },
    attributes: { exclude: ["password"] },
  });

  if (user) {
    // Update existing user
    user = await user.update({
      fullName: fullName || user.fullName,
      role: role || user.role,
    });

    return res.json(success(user, "User updated successfully"));
  }

  // Create new user with Firebase UID as primary key
  user = await User.create({
    id: uid, // Using Firebase UID as primary key
    email,
    fullName: fullName || email.split("@")[0],
    role,
  });

  res.status(201).json(success(user, "User registered successfully"));
});

/**
 * Get the current user profile
 */
const getProfile = catchAsync(async (req, res) => {
  res.json(success(req.user, "User profile retrieved successfully"));
});

module.exports = {
  register,
  getProfile,
};
