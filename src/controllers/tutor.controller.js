const { User, TutorProfile } = require("../models");
const { success, paginated } = require("../utils/response-formatter");
const {
  catchAsync,
  notFound,
  badRequest,
  forbidden,
} = require("../utils/error-handler");
const { Op } = require("sequelize");
const { getFileUrl } = require("../utils/file-upload");

/**
 * Get all tutors with optional filtering
 */
const getAllTutors = catchAsync(async (req, res) => {
  const { subject, minExperience, page = 1, limit = 12 } = req.query;

  // Build filter conditions
  const whereConditions = {
    role: "tutor",
  };

  const profileWhereConditions = {};

  // Filter by subject if provided
  if (subject) {
    profileWhereConditions.subjects = {
      [Op.contains]: [subject],
    };
  }

  // Filter by experience if provided
  if (minExperience) {
    profileWhereConditions.experience = {
      [Op.gte]: parseInt(minExperience),
    };
  }

  // Calculate pagination
  const offset = (page - 1) * limit;

  // Get tutors with their profiles
  const { count, rows: tutors } = await User.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: TutorProfile,
        as: "tutorProfile",
        where: Object.keys(profileWhereConditions).length
          ? profileWhereConditions
          : undefined,
      },
    ],
    attributes: { exclude: ["firebaseId"] },
    limit: parseInt(limit),
    offset,
    order: [["fullName", "ASC"]],
  });

  return res.json(
    paginated(
      tutors,
      parseInt(page),
      parseInt(limit),
      count,
      "Tutors retrieved successfully"
    )
  );
});

/**
 * Get tutor by ID
 */
const getTutorById = catchAsync(async (req, res) => {
  const { id } = req.params; // This will now be Firebase UID

  const tutor = await User.findOne({
    where: {
      id, // Using Firebase UID directly
      role: "tutor",
    },
    include: [
      {
        model: TutorProfile,
        as: "tutorProfile",
      },
    ],
    attributes: { exclude: ["password"] }, // Remove firebaseId from exclude since it's now the primary key
  });

  if (!tutor) {
    throw notFound("Tutor not found");
  }

  if (tutor?.tutorProfile?.profileImage) {
    tutor.tutorProfile.dataValues.profileImageUrl = getFileUrl(
      tutor.tutorProfile.profileImage
    );
  }

  return res.json(success(tutor, "Tutor retrieved successfully"));
});

/**
 * Create or update tutor profile
 */
const createUpdateTutorProfile = catchAsync(async (req, res) => {
  // Get userId from params (for admin updates) or from authenticated user
  const userId = req.params.id || req.user.id;

  if (!userId) {
    throw badRequest("User ID is required");
  }

  // Validate user exists and is a tutor
  const user = await User.findOne({
    where: {
      id: userId,
      role: "tutor",
    },
  });

  if (!user) {
    throw notFound("User not found or is not a tutor");
  }

  // Check authorization - allow both the tutor themselves and admins
  // if (req.user.id !== userId && req.user.role !== "admin") {
  //   throw forbidden("Not authorized to modify this profile");
  // }

  // Validate required fields
  const {
    location,
    phoneNumber,
    bio,
    education,
    degree,
    certifications = [],
    graduationYear = null,
    experience = 0,
    subjects = [],
  } = req.body;

  // Validate required fields
  if (!location || !phoneNumber || !bio || !education || !degree) {
    throw badRequest("Missing required fields");
  }

  try {
    // Process arrays and validate data...
    // ... (rest of the existing validation code)

    // Find existing profile
    let tutorProfile = await TutorProfile.findOne({
      where: { userId },
    });

    const profileData = {
      location,
      phoneNumber,
      bio,
      education,
      degree,
      certifications: Array.isArray(certifications) ? certifications : [],
      graduationYear,
      subjects: Array.isArray(subjects) ? subjects : [],
      experience: parseInt(experience) || 0,
    };

    if (req.file?.filename) {
      profileData.profileImage = req.file.filename;
    }

    if (tutorProfile) {
      // Update existing profile
      tutorProfile = await tutorProfile.update(profileData);
    } else {
      // Create new profile
      tutorProfile = await TutorProfile.create({
        userId,
        ...profileData,
      });
    }

    // Fetch updated data
    const updatedTutor = await User.findOne({
      where: { id: userId },
      include: [
        {
          model: TutorProfile,
          as: "tutorProfile",
        },
      ],
      attributes: { exclude: ["firebaseId"] },
    });

    if (updatedTutor?.tutorProfile?.profileImage) {
      updatedTutor.tutorProfile.dataValues.profileImageUrl = getFileUrl(
        updatedTutor.tutorProfile.profileImage
      );
    }

    return res.json(
      success(updatedTutor, "Tutor profile updated successfully")
    );
  } catch (error) {
    console.error("Error updating tutor profile:", error);
    throw error;
  }
});

/**
 * Delete tutor profile
 */
const deleteTutorProfile = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Check if user exists and is a tutor
  const user = await User.findOne({
    where: {
      id,
      role: "tutor",
    },
  });

  if (!user) {
    throw notFound("Tutor not found");
  }

  // Only admin can delete profiles
  if (req.user.role !== "admin") {
    throw forbidden("Only administrators can delete tutor profiles");
  }

  // Find and delete the profile
  const tutorProfile = await TutorProfile.findOne({ where: { userId: id } });

  if (!tutorProfile) {
    throw notFound("Tutor profile not found");
  }

  await tutorProfile.destroy();

  return res.json(success(null, "Tutor profile deleted successfully"));
});

/**
 * Get tutors by subject
 */
const getTutorsBySubject = catchAsync(async (req, res) => {
  const { subject } = req.params;

  if (!subject) {
    throw badRequest("Subject is required");
  }

  const tutors = await User.findAll({
    where: { role: "tutor" },
    include: [
      {
        model: TutorProfile,
        as: "tutorProfile",
        where: {
          subjects: {
            [Op.contains]: [subject],
          },
        },
      },
    ],
    attributes: { exclude: ["firebaseId"] },
  });

  return res.json(
    success(tutors, `Tutors for ${subject} retrieved successfully`)
  );
});

/**
 * Get current tutor's profile
 */
const getMyTutorProfile = catchAsync(async (req, res) => {
  if (req.user.role !== "tutor") {
    throw forbidden("Only tutors can access this endpoint");
  }

  const tutor = await User.findOne({
    where: {
      id: req.user.id, // This will now be Firebase UID
    },
    include: [
      {
        model: TutorProfile,
        as: "tutorProfile",
        required: false, // Make this optional to handle new tutors
      },
    ],
    attributes: { exclude: ["password"] },
  });

  if (!tutor) {
    throw notFound("Tutor not found");
  }

  if (tutor?.tutorProfile?.profileImage) {
    tutor.tutorProfile.dataValues.profileImageUrl = getFileUrl(
      tutor.tutorProfile.profileImage
    );
  }

  return res.json(success(tutor, "Tutor profile retrieved successfully"));
});

module.exports = {
  getAllTutors,
  getTutorById,
  createUpdateTutorProfile,
  deleteTutorProfile,
  getTutorsBySubject,
  getMyTutorProfile,
};
