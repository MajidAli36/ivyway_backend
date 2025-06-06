const { Booking, User, Availability } = require("../models");
const { success } = require("../utils/response-formatter");
const {
  catchAsync,
  notFound,
  badRequest,
  forbidden,
} = require("../utils/error-handler");
const { Op } = require("sequelize");

// Add this at the top of your file with other imports
const { sequelize } = require("../models");

// Make sure you have this import at the top
const notificationService = require("../services/notification.service");

/**
 * Create a new booking
 */
const createBooking = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const studentName = req.user.fullName;
  const { providerId, startTime, endTime, availabilityId, sessionType, notes } =
    req.body;

  // Validate required fields
  if (!providerId || !startTime || !endTime) {
    throw badRequest("Provider ID, start time, and end time are required");
  }

  // Find provider
  const provider = await User.findOne({
    where: {
      id: providerId,
      role: {
        [Op.in]: ["tutor", "counselor"],
      },
    },
  });

  if (!provider) {
    throw notFound("Provider not found");
  }

  // Parse date and get day of week
  const bookingStart = new Date(startTime);
  const bookingEnd = new Date(endTime);
  const dayOfWeek = bookingStart.getDay(); // 0 = Sunday, 6 = Saturday

  // Validate date/time
  if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
    throw badRequest("Invalid date format");
  }

  if (bookingEnd <= bookingStart) {
    throw badRequest("End time must be after start time");
  }

  // Replace the date validation block with this simpler, more reliable approach
  const now = new Date();

  // Convert to YYYY-MM-DD format for reliable comparison
  const nowDate = now.toISOString().split("T")[0];
  const bookingDate = bookingStart.toISOString().split("T")[0];

  // console.log("Now date:", nowDate);
  // console.log("Booking date:", bookingDate);
  // console.log("Booking in past?", bookingDate < nowDate);

  // // if (bookingDate < nowDate) {
  // //   throw badRequest("Cannot book a session for a past date");
  // // } else if (bookingDate === nowDate && bookingStart < now) {
  // //   throw badRequest(
  // //     "Cannot book a session for a time that has already passed today"
  // //   );
  // // }

  // Check if requested time falls within provider's availability
  let availability;

  if (availabilityId) {
    // If specific availability slot is provided
    availability = await Availability.findOne({
      where: {
        id: availabilityId,
        userId: providerId,
        isAvailable: true,
      },
    });

    if (!availability) {
      throw notFound(
        "The selected availability slot does not exist or is not available"
      );
    }
  } else {
    // Find matching availability by day and time
    const timeStr = bookingStart.toTimeString().substring(0, 5); // HH:MM format

    availability = await Availability.findOne({
      where: {
        userId: providerId,
        dayOfWeek,
        isAvailable: true,
        startTime: {
          [Op.lte]: timeStr,
        },
        endTime: {
          [Op.gte]: bookingEnd.toTimeString().substring(0, 5),
        },
      },
    });

    if (!availability) {
      throw badRequest("Provider is not available at the requested time");
    }
  }

  // Check for overlapping bookings
  const overlappingBooking = await Booking.findOne({
    where: {
      providerId,
      status: {
        [Op.in]: ["pending", "confirmed"],
      },
      [Op.or]: [
        // New booking starts during existing booking
        {
          startTime: { [Op.lt]: bookingEnd },
          endTime: { [Op.gt]: bookingStart },
        },
        // New booking contains existing booking
        {
          startTime: { [Op.gte]: bookingStart },
          endTime: { [Op.lte]: bookingEnd },
        },
      ],
    },
  });

  if (overlappingBooking) {
    throw badRequest("The provider already has a booking during this time");
  }

  // Create the booking
  const booking = await Booking.create({
    studentId,
    studentName,
    providerId,
    providerName: provider.fullName,
    providerRole: provider.role,
    availabilityId: availability.id,
    startTime: bookingStart,
    endTime: bookingEnd,
    dayOfWeek,
    status: "pending", // Default status
    sessionType: sessionType || "virtual",
    notes: notes || "",
  });

  res.status(201).json(success(booking, "Booking created successfully"));
});

/**
 * Get student's bookings
 */
const getStudentBookings = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { status, startDate, endDate } = req.query;

  // Build query conditions
  const whereClause = { studentId: userId };

  if (status) {
    whereClause.status = status;
  }

  if (startDate) {
    whereClause.startTime = {
      ...whereClause.startTime,
      [Op.gte]: new Date(startDate),
    };
  }

  if (endDate) {
    whereClause.endTime = {
      ...whereClause.endTime,
      [Op.lte]: new Date(endDate),
    };
  }

  // Get bookings
  const bookings = await Booking.findAll({
    where: whereClause,
    order: [["startTime", "ASC"]],
    include: [
      {
        model: User,
        as: "provider",
        attributes: ["id", "fullName", "email", "role"],
      },
    ],
  });

  res.json(success(bookings, "Bookings retrieved successfully"));
});

/**
 * Get provider's bookings
 */
const getProviderBookings = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { status, startDate, endDate } = req.query;

  // Verify user is a provider
  if (!["tutor", "counselor"].includes(req.user.role)) {
    throw forbidden("Only tutors and counselors can view their bookings");
  }

  // Build query conditions
  const whereClause = { providerId: userId };

  if (status) {
    whereClause.status = status;
  }

  if (startDate) {
    whereClause.startTime = {
      ...whereClause.startTime,
      [Op.gte]: new Date(startDate),
    };
  }

  if (endDate) {
    whereClause.endTime = {
      ...whereClause.endTime,
      [Op.lte]: new Date(endDate),
    };
  }

  // Get bookings
  const bookings = await Booking.findAll({
    where: whereClause,
    order: [["startTime", "ASC"]],
    include: [
      {
        model: User,
        as: "student",
        attributes: ["id", "fullName", "email"],
      },
    ],
  });

  res.json(success(bookings, "Bookings retrieved successfully"));
});

/**
 * Get booking by ID
 */
const getBookingById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const booking = await Booking.findByPk(id, {
    include: [
      {
        model: User,
        as: "student",
        attributes: ["id", "fullName", "email"],
      },
      {
        model: User,
        as: "provider",
        attributes: ["id", "fullName", "email", "role"],
      },
    ],
  });

  if (!booking) {
    throw notFound("Booking not found");
  }

  // Check if user is authorized to view this booking
  if (
    booking.studentId !== userId &&
    booking.providerId !== userId &&
    req.user.role !== "admin"
  ) {
    throw forbidden("You are not authorized to view this booking");
  }

  res.json(success(booking, "Booking retrieved successfully"));
});

/**
 * Cancel a booking
 */
const cancelBooking = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { cancellationReason } = req.body;

  const booking = await Booking.findByPk(id);

  if (!booking) {
    throw notFound("Booking not found");
  }

  // Check if user is authorized to cancel this booking
  const isStudent = booking.studentId === userId;
  const isProvider = booking.providerId === userId;
  const isAdmin = req.user.role === "admin";

  if (!isStudent && !isProvider && !isAdmin) {
    throw forbidden("You are not authorized to cancel this booking");
  }

  // Check if booking can be cancelled
  if (booking.status === "cancelled") {
    throw badRequest("Booking is already cancelled");
  }

  if (booking.status === "completed") {
    throw badRequest("Cannot cancel a completed booking");
  }

  // Check cancellation time restrictions (for students)
  if (isStudent && !isAdmin) {
    const now = new Date();
    const bookingStart = new Date(booking.startTime);
    const hoursDifference = (bookingStart - now) / (1000 * 60 * 60);

    // Students can only cancel 24 hours in advance
    if (hoursDifference < 24) {
      throw badRequest(
        "Bookings can only be cancelled at least 24 hours in advance"
      );
    }
  }

  // Cancel the booking
  await booking.update({
    status: "cancelled",
    cancellationReason:
      cancellationReason ||
      (isStudent ? "Cancelled by student" : "Cancelled by provider"),
  });

  res.json(success(booking, "Booking cancelled successfully"));
});

/**
 * Update booking status (providers and admins only)
 */
const updateBookingStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.id;
  console.log(userId);

  console.log("updateBookingStatusId", id);

  if (!["confirmed", "completed"].includes(status)) {
    throw badRequest(
      "Invalid status. Status must be 'confirmed' or 'completed'"
    );
  }

  const booking = await Booking.findByPk(id, {
    include: [
      {
        model: User,
        as: "student",
        attributes: ["id", "fullName", "email"],
      },
      {
        model: User,
        as: "provider",
        attributes: ["id", "fullName", "email", "role"],
      },
    ],
  });

  if (!booking) {
    throw notFound("Booking not found");
  }

  // Only providers and admins can update status
  if (booking.providerId !== userId && req.user.role !== "admin") {
    throw forbidden("Only the provider or an admin can update booking status");
  }

  if (booking.status === "cancelled") {
    throw badRequest("Cannot update a cancelled booking");
  }

  // Update status
  await booking.update({ status });

  // Send notification to the student about the booking update
  if (booking.student && booking.student.id) {
    try {
      const socketService = require("../services/socket.service");

      // Determine the notification type based on status
      let notificationType = status === "confirmed" ? "confirmed" : "completed";

      // Send the notification
      await notificationService.sendBookingNotification(
        booking.student.id,
        `booking_${notificationType}`,
        `Booking ${
          notificationType.charAt(0).toUpperCase() + notificationType.slice(1)
        }`,
        `Your booking has been ${notificationType}`,
        {
          bookingId: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          providerName: booking.provider
            ? booking.provider.fullName
            : "your provider",
        }
      );
    } catch (error) {
      console.error("Error sending notification:", error);
      // Continue even if notification fails
    }
  }

  res.json(success(booking, `Booking marked as ${status}`));
});

/**
 * Get pending session requests for a tutor
 */
const getPendingRequests = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin";
  const { tutorId } = req.query;

  // If admin is viewing a specific tutor's requests
  const providerId = isAdmin && tutorId ? tutorId : userId;

  // If admin is requesting a specific tutor's data, verify the tutor exists
  if (isAdmin && tutorId) {
    const tutor = await User.findOne({
      where: {
        id: tutorId,
        role: {
          [Op.in]: ["tutor", "counselor"],
        },
      },
    });

    if (!tutor) {
      throw notFound("Tutor not found");
    }
  }

  const pendingRequests = await Booking.findAll({
    where: {
      providerId: providerId,
      status: "pending",
    },
    include: [
      {
        model: User,
        as: "student",
        attributes: ["id", "fullName", "email"],
      },
      {
        model: Availability,
        as: "availability",
        attributes: ["id", "dayOfWeek", "startTime", "endTime"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return res.json(
    success(pendingRequests, "Pending session requests retrieved successfully")
  );
});

/**
 * Admin endpoint to view any tutor's requests
 */
const getTutorRequestsAdmin = catchAsync(async (req, res) => {
  const { tutorId } = req.params;
  const { status } = req.query;

  // Verify the tutor exists
  const tutor = await User.findOne({
    where: {
      id: tutorId,
      role: {
        [Op.in]: ["tutor", "counselor"],
      },
    },
  });

  if (!tutor) {
    throw notFound("Tutor not found");
  }

  // Build query conditions
  const whereClause = {
    providerId: tutorId,
  };

  // Add status filter if provided
  if (
    status &&
    ["pending", "confirmed", "cancelled", "completed"].includes(status)
  ) {
    whereClause.status = status;
  }

  const requests = await Booking.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: "student",
        attributes: ["id", "fullName", "email"],
      },
      {
        model: Availability,
        as: "availability",
        attributes: ["id", "dayOfWeek", "startTime", "endTime"],
      },
    ],
    order: [["startTime", "DESC"]],
  });

  return res.json(
    success(
      requests,
      `Session requests for tutor ${tutor.fullName} retrieved successfully`
    )
  );
});

// Update the getAllRequests function to handle admin case
const getAllRequests = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin";
  const { tutorId, status } = req.query;

  // If admin is viewing a specific tutor's requests
  const providerId = isAdmin && tutorId ? tutorId : userId;

  // If admin is requesting a specific tutor's data, verify the tutor exists
  if (isAdmin && tutorId) {
    const tutor = await User.findOne({
      where: {
        id: tutorId,
        role: {
          [Op.in]: ["tutor", "counselor"],
        },
      },
    });

    if (!tutor) {
      throw notFound("Tutor not found");
    }
  }

  const whereClause = {
    providerId: providerId,
  };

  // Add status filter if provided
  if (
    status &&
    ["pending", "confirmed", "cancelled", "completed"].includes(status)
  ) {
    whereClause.status = status;
  }

  const requests = await Booking.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: "student",
        attributes: ["id", "fullName", "email"],
      },
      {
        model: Availability,
        as: "availability",
        attributes: ["id", "dayOfWeek", "startTime", "endTime"],
      },
    ],
    order: [["startTime", "DESC"]],
  });

  return res.json(success(requests, "Session requests retrieved successfully"));
});

/**
 * Update session request status (confirm/cancel)
 */
const updateRequestStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, cancellationReason } = req.body;
  const tutorId = req.user.id;

  // Validate status
  if (!status || !["confirmed", "cancelled"].includes(status)) {
    throw badRequest("Status must be either 'confirmed' or 'cancelled'");
  }

  // Find the booking
  const booking = await Booking.findOne({
    where: {
      id,
      providerId: tutorId,
      status: "pending",
    },
    include: [
      {
        model: User,
        as: "student",
        attributes: ["id", "fullName", "email"],
      },
    ],
  });

  if (!booking) {
    throw notFound("Session request not found or already processed");
  }

  // Update booking status
  booking.status = status;

  // Add cancellation reason if provided and status is cancelled
  if (status === "cancelled" && cancellationReason) {
    booking.cancellationReason = cancellationReason;
  }

  await booking.save();

  // Send notification to student
  try {
    // Replace this block in updateRequestStatus function
    if (status === "confirmed") {
      // Generate meeting link if needed for virtual sessions
      if (booking.sessionType === "virtual" && !booking.meetingLink) {
        // ... existing code for meeting link ...
      }

      // Send confirmation notification to student
      await notificationService.sendBookingNotification(
        booking.student.id,
        "booking_confirmed",
        "Booking Confirmed",
        `Your booking with ${req.user.fullName} has been confirmed.`,
        {
          bookingId: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          title: booking.title || "Tutoring Session",
          tutorName: req.user.fullName,
        }
      );

      // Also notify the tutor
      await notificationService.sendBookingNotification(
        req.user.id,
        "booking_confirmed",
        "Booking Confirmed",
        `Your booking with ${booking.studentName} has been confirmed.`,
        {
          bookingId: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          title: booking.title || "Tutoring Session",
          studentName: booking.studentName,
        }
      );
    } else {
      // Send cancellation notification
      await notificationService.sendBookingCancellation(
        booking,
        booking.student,
        req.user,
        "tutor"
      );
    }
  } catch (error) {
    console.error("Notification error:", error);
    // Continue even if notification fails
  }

  return res.json(
    success(
      booking,
      `Session request ${
        status === "confirmed" ? "confirmed" : "cancelled"
      } successfully`
    )
  );
});

/**
 * Get all bookings for admin dashboard
 */
const getAllBookingsAdmin = catchAsync(async (req, res) => {
  const { status, startDate, endDate, studentId, providerId } = req.query;

  // Build query conditions
  const whereClause = {};

  if (status) {
    whereClause.status = status;
  }

  if (startDate) {
    whereClause.startTime = {
      ...whereClause.startTime,
      [Op.gte]: new Date(startDate),
    };
  }

  if (endDate) {
    whereClause.endTime = {
      ...whereClause.endTime,
      [Op.lte]: new Date(endDate),
    };
  }

  if (studentId) {
    whereClause.studentId = studentId;
  }

  if (providerId) {
    whereClause.providerId = providerId;
  }

  // Get bookings with pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const { count, rows: bookings } = await Booking.findAndCountAll({
    where: whereClause,
    order: [["startTime", "DESC"]],
    include: [
      {
        model: User,
        as: "student",
        attributes: ["id", "fullName", "email"],
      },
      {
        model: User,
        as: "provider",
        attributes: ["id", "fullName", "email", "role"],
      },
      {
        model: Availability,
        as: "availability",
        attributes: ["id", "dayOfWeek", "startTime", "endTime"],
      },
    ],
    limit,
    offset,
  });

  // Calculate total pages
  const totalPages = Math.ceil(count / limit);

  res.json(
    success(
      {
        bookings,
        pagination: {
          total: count,
          page,
          limit,
          totalPages,
        },
      },
      "Bookings retrieved successfully"
    )
  );
});

/**
 * Get booking statistics for admin dashboard
 */
const getBookingStatistics = catchAsync(async (req, res) => {
  // Get total counts by status
  const totalBookings = await Booking.count();
  const pendingBookings = await Booking.count({ where: { status: "pending" } });
  const confirmedBookings = await Booking.count({
    where: { status: "confirmed" },
  });
  const completedBookings = await Booking.count({
    where: { status: "completed" },
  });
  const cancelledBookings = await Booking.count({
    where: { status: "cancelled" },
  });

  // Get bookings for the current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const bookingsThisMonth = await Booking.count({
    where: {
      createdAt: {
        [Op.between]: [startOfMonth, endOfMonth],
      },
    },
  });

  // Get bookings for the previous month
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const bookingsLastMonth = await Booking.count({
    where: {
      createdAt: {
        [Op.between]: [startOfPrevMonth, endOfPrevMonth],
      },
    },
  });

  // Calculate month-over-month growth
  const growthRate =
    bookingsLastMonth > 0
      ? ((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth) * 100
      : 100;

  // Get top 5 tutors by booking count
  const topTutors = await Booking.findAll({
    attributes: [
      "providerId",
      "providerName",
      [sequelize.fn("COUNT", sequelize.col("id")), "bookingCount"],
    ],
    group: ["providerId", "providerName"],
    order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
    limit: 5,
  });

  res.json(
    success(
      {
        totalBookings,
        byStatus: {
          pending: pendingBookings,
          confirmed: confirmedBookings,
          completed: completedBookings,
          cancelled: cancelledBookings,
        },
        thisMonth: bookingsThisMonth,
        lastMonth: bookingsLastMonth,
        growthRate: parseFloat(growthRate.toFixed(2)),
        topTutors,
      },
      "Booking statistics retrieved successfully"
    )
  );
});

// Add or update this method in your booking controller

/**
 * Update a booking
 * @param {string} id - Booking ID
 * @param {Object} updateData - Data to update
 * @param {Object} user - User making the request (can be null for admin routes)
 * @returns {Promise<Object>} Updated booking
 */
const updateBooking = async (id, updateData, user = null) => {
  try {
    const booking = await Booking.findByPk(id);

    if (!booking) {
      throw notFound("Booking not found");
    }

    // Only check permissions if user object is provided
    if (user !== null) {
      // For non-admins, check if they're the provider or client
      if (
        user.role !== "admin" &&
        booking.providerId !== user.id &&
        booking.clientId !== user.id
      ) {
        throw forbidden("You don't have permission to update this booking");
      }
    }

    // Store the old status for notification purposes
    const oldStatus = booking.status;

    // Update the booking
    await booking.update(updateData);

    // Reload to get the updated data with associations
    const updatedBooking = await Booking.findByPk(id);

    return updatedBooking;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a booking
 * @param {string} id - Booking ID to delete
 * @returns {Promise<boolean>} Success status
 */
const deleteBooking = async (id) => {
  try {
    const booking = await Booking.findByPk(id);

    if (!booking) {
      throw notFound("Booking not found");
    }

    // Perform the deletion
    await booking.destroy();

    return true;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createBooking,
  getStudentBookings,
  getProviderBookings,
  getBookingById,
  cancelBooking,
  updateBookingStatus,
  getPendingRequests,
  getAllRequests,
  updateRequestStatus,
  getTutorRequestsAdmin,
  getAllBookingsAdmin,
  getBookingStatistics,
  updateBooking,
  deleteBooking,
};
