const admin = require("firebase-admin");
const { User } = require("../models");

/**
 * Verify a Firebase token
 * @param {string} token - Firebase ID token
 * @returns {Promise<Object|null>} Decoded token or null
 */
const verifyToken = async (token) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Get user from database to check role
    const user = await User.findOne({
      where: { id: decodedToken.uid },
      attributes: ["id", "role"],
    });

    if (!user) {
      return null;
    }

    // Return decoded token with additional user info
    return {
      ...decodedToken,
      uid: user.id, // Use our database ID instead of Firebase ID
      role: user.role,
    };
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
};

module.exports = {
  verifyToken,
};
