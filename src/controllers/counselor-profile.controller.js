const { CounselorProfile, User } = require("../models");
const { catchAsync, AppError, notFound } = require("../utils/error-handler");
const { success } = require("../utils/response-handler");
const { getFileUrl } = require("../utils/file-upload");
const fs = require("fs").promises;
const path = require("path");
const { profileImagesDir } = require("../utils/file-upload");

/**
 * Get counselor profile by user ID
 */
const getCounselorProfileByUserId = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const profile = await CounselorProfile.findOne({
    where: { userId },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "fullName", "email"],
      },
    ],
  });

  if (!profile) {
    throw notFound("Counselor profile not found");
  }

  // Add full URL to profile image
  if (profile.profileImage) {
    profile.dataValues.profileImageUrl = getFileUrl(profile.profileImage);
  }

  res.json(success(profile, "Counselor profile retrieved successfully"));
});

/**
 * Get counselor profile for the authenticated user
 */
const getMyProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const profile = await CounselorProfile.findOne({
    where: { userId },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "fullName", "email"],
      },
    ],
  });

  if (!profile) {
    throw notFound("Counselor profile not found");
  }

  // Add full URL to profile image
  if (profile.profileImage) {
    profile.dataValues.profileImageUrl = getFileUrl(profile.profileImage);
  }

  res.json(success(profile, "Counselor profile retrieved successfully"));
});

/**
 * Create or update counselor profile
 */
const updateCounselorProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const profileData = req.body;

  // Handle file upload if present
  if (req.file) {
    profileData.profileImage = req.file.filename;
  }

  // Check if profile exists
  let profile = await CounselorProfile.findOne({ where: { userId } });

  // If updating and there's a new profile image, delete the old one
  if (profile && profile.profileImage && req.file) {
    try {
      await fs.unlink(path.join(profileImagesDir, profile.profileImage));
    } catch (error) {
      console.error("Error deleting old profile image:", error);
    }
  }

  if (profile) {
    // Update existing profile
    profile = await profile.update(profileData);
  } else {
    // Create new profile
    profile = await CounselorProfile.create({
      ...profileData,
      userId,
    });
  }

  // Add full URL to profile image
  if (profile.profileImage) {
    profile.dataValues.profileImageUrl = getFileUrl(profile.profileImage);
  }

  res.json(success(profile, "Counselor profile updated successfully"));
});

/**
 * Get all counselor profiles (for admin or public listing)
 */
// Make sure this method exists and is properly implemented
const getAllCounselorProfiles = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  console.log("Getting all counselor profiles, page:", page, "limit:", limit);

  const { count, rows: profiles } = await CounselorProfile.findAndCountAll({
    limit: parseInt(limit),
    offset: parseInt(offset),
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "fullName", "email"],
      },
    ],
  });

  console.log(`Found ${count} counselor profiles`);

  // Add full URLs to profile images
  profiles.forEach(profile => {
    if (profile.profileImage) {
      profile.dataValues.profileImageUrl = getFileUrl(profile.profileImage);
    }
  });

  const totalPages = Math.ceil(count / limit);

  res.json(
    success(
      {
        profiles,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages,
        },
      },
      "Counselor profiles retrieved successfully"
    )
  );
});

/**
 * Delete counselor profile
 */
const deleteCounselorProfile = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user.id;

  // Check if user is admin or the profile owner
  if (req.user.role !== "admin" && req.user.id !== userId) {
    throw new AppError("Unauthorized", 403);
  }

  const profile = await CounselorProfile.findOne({ where: { userId } });

  if (!profile) {
    throw notFound("Counselor profile not found");
  }

  // Delete profile image if exists
  if (profile.profileImage) {
    try {
      await fs.unlink(path.join(profileImagesDir, profile.profileImage));
    } catch (error) {
      console.error("Error deleting profile image:", error);
    }
  }

  await profile.destroy();

  res.json(success(null, "Counselor profile deleted successfully"));
});

module.exports = {
  getCounselorProfileByUserId,
  getMyProfile,
  updateCounselorProfile,
  getAllCounselorProfiles,
  deleteCounselorProfile,
};