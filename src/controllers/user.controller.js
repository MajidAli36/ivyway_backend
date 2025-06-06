const { User, TutorProfile } = require("../models");
const { success } = require("../utils/response-formatter");
const { notFound, badRequest, catchAsync } = require("../utils/error-handler");
const { Op } = require("sequelize");

/**
 * Get current user profile
 */
const getProfile = catchAsync(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ["firebaseId"] },
    include: req.user.role === "tutor" ? [
      {
        model: TutorProfile,
        as: "tutorProfile"
      }
    ] : []
  });

  if (!user) {
    throw notFound("User not found");
  }

  res.json(success(user, "User profile retrieved successfully"));
});

/**
 * Update user profile
 */
const updateProfile = catchAsync(async (req, res) => {
  const { firstName, lastName, timezone } = req.body;

  // Validate input
  if (!firstName && !lastName && !timezone) {
    throw badRequest("No fields to update");
  }

  const user = await User.findByPk(req.user.id);

  if (!user) {
    throw notFound("User not found");
  }

  // Update fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (timezone) user.timezone = timezone;

  await user.save();

  res.json(success(user, "Profile updated successfully"));
});

/**
 * Get all tutors
 */
const getTutors = catchAsync(async (req, res) => {
  const tutors = await User.findAll({
    where: { role: "tutor" },
    attributes: { exclude: ["firebaseId"] },
    include: [
      {
        model: TutorProfile,
        as: "tutorProfile"
      }
    ]
  });

  res.json(success(tutors, "Tutors retrieved successfully"));
});

// Add these methods to your existing user.controller.js

/**
 * Get all users with optional role filtering
 */
const getAllUsers = catchAsync(async (req, res) => {
  const { role, page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;
  
  const whereClause = role ? { role } : {};
  
  const { count, rows } = await User.findAndCountAll({
    where: whereClause,
    attributes: { exclude: ["firebaseId"] },
    limit: limitNum,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: TutorProfile,
        as: "tutorProfile",
        required: false
      }
    ]
  });
  
  const result = {
    users: rows,
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(count / limitNum)
    }
  };
  
  res.json(success(result, "Users retrieved successfully"));
});

/**
 * Get user by ID (internal function)
 */
const getUserByIdInternal = async (id) => {
  const user = await User.findByPk(id, {
    attributes: { exclude: ["firebaseId"] },
    include: [
      {
        model: TutorProfile,
        as: "tutorProfile",
        required: false
      }
    ]
  });
  
  if (!user) {
    throw notFound("User not found");
  }
  
  return user;
};

/**
 * Get user by ID (API route handler)
 */
const getUserById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = await getUserByIdInternal(id);
  res.json(success(user, "User retrieved successfully"));
});

/**
 * Update user by ID
 */
const updateUserById = catchAsync(async (id, userData) => {
  const user = await User.findByPk(id);
  
  if (!user) {
    throw notFound("User not found");
  }
  
  // Update user fields
  const { fullName, email, role } = userData;
  
  if (fullName) user.fullName = fullName;
  if (email) user.email = email;
  if (role) user.role = role;
  
  await user.save();
  
  // If updating to tutor role and tutor profile doesn't exist, create it
  if (role === "tutor") {
    const tutorProfile = await TutorProfile.findOne({ where: { userId: id } });
    if (!tutorProfile) {
      await TutorProfile.create({
        userId: id,
        subjects: [],
      });
    }
  }
  
  // Return updated user with profile if applicable
  return getUserByIdInternal(id);  // Use the internal function here
});

/**
 * Delete user by ID
 */
const deleteUserById = catchAsync(async (id) => {
  const user = await User.findByPk(id);
  
  if (!user) {
    throw notFound("User not found");
  }
  
  await user.destroy();
  return true;
});

/**
 * Get user statistics
 */
const getUserStatistics = catchAsync(async () => {
  const totalUsers = await User.count();
  const studentCount = await User.count({ where: { role: "student" } });
  const tutorCount = await User.count({ where: { role: "tutor" } });
  const counselorCount = await User.count({ where: { role: "counselor" } });
  
  // Get new users in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const newUsers = await User.count({
    where: {
      createdAt: {
        [Op.gte]: thirtyDaysAgo
      }
    }
  });
  
  return {
    totalUsers,
    studentCount,
    tutorCount,
    counselorCount,
    newUsers
  };
});

// Add these to your module.exports
module.exports = {
  getProfile,
  updateProfile,
  getTutors,
  getAllUsers,
  getUserById,
  getUserByIdInternal,
  updateUserById,
  deleteUserById,
  getUserStatistics
};
