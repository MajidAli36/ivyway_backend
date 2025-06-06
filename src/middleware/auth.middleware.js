const admin = require("firebase-admin");
const { User } = require("../models");
const env = require("../config/environment");
const { unauthorized } = require("../utils/error-handler");

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      privateKey: env.firebase.privateKey.replace(/\\n/g, "\n"),
      clientEmail: env.firebase.clientEmail,
    }),
  });
}

/**
 * Middleware to authenticate users with Firebase
 */
const authenticateUser = async (req, res, next) => {
  try {
    // Get the token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw unauthorized("No token provided");
    }

    const token = authHeader.split(" ")[1];

    // Verify the token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email } = decodedToken;

    // Find user by Firebase UID (now primary key)
    let user = await User.findOne({
      where: { id: uid },
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      // Get additional info from Firebase
      const firebaseUser = await admin.auth().getUser(uid);

      // Check for custom claims to determine role
      const customClaims = firebaseUser.customClaims || {};
      const role = customClaims.role;

      // Create the user in PostgreSQL with Firebase UID as primary key
      user = await User.create({
        id: uid, // Using Firebase UID as primary key
        email: email,
        fullName: firebaseUser.displayName || email.split("@")[0],
        role: role,
      });
    } else if (!user.role) {
      // If user exists but has no role, check Firebase for role update
      try {
        const firebaseUser = await admin.auth().getUser(uid);
        const customClaims = firebaseUser.customClaims || {};

        if (customClaims.role) {
          // Update user with role from Firebase
          await user.update({ role: customClaims.role });
          // Refresh user object with the new role
          user = await User.findOne({
            where: { id: uid },
            attributes: { exclude: ["password"] },
          });
        }
      } catch (claimError) {
        console.error("Error checking Firebase claims:", claimError);
      }
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(unauthorized(error.message));
  }
};

/**
 * Middleware to check user roles
 * @param {...string} roles - Allowed roles for the route
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw unauthorized("Authentication required");
    }

    if (!roles.includes(req.user.role)) {
      throw unauthorized("Insufficient permissions");
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  authorizeRoles,
};
