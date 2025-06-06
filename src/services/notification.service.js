const { Notification, User } = require("../models");
const socketService = require("./socket.service");
const emailService = require("./email.service");

/**
 * Sends an email notification
 * @param {Object} recipient - Recipient information
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 * @returns {Promise<boolean>} Success status
 */
// Replace the placeholder sendEmail function with this:
const sendEmail = async (recipient, subject, message) => {
  try {
    return await emailService.sendEmail({
      to: recipient.email,
      subject,
      text: message,
    });
  } catch (error) {
    console.error("Error sending email notification:", error);
    return false;
  }
};

/**
 * Creates an in-app notification
 * @param {string} userId - User ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} content - Notification content
 * @param {Object} metadata - Additional data
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (userId, type, title, content, metadata = {}) => {
  try {
    console.log(`Creating notification for user ${userId} of type ${type}`);
    
    // Create notification in database
    const notification = await Notification.create({
      userId,
      type,
      title,
      content,
      isRead: false,
      metadata,
    });

    // Send real-time notification via socket if user is online
    socketService.sendToUser(userId, "notification:new", {
      id: notification.id,
      type,
      title,
      content,
      metadata,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

/**
 * Sends a booking confirmation notification
 * @param {Object} booking - Booking details
 * @param {Object} student - Student details
 * @param {Object} tutor - Tutor details
 * @returns {Promise<boolean>} Success status
 */
const sendBookingConfirmation = async (booking, student, tutor) => {
  const subject = `Booking Confirmation: ${booking.title}`;
  const studentMessage = `
      Your booking with ${tutor.firstName} ${tutor.lastName} has been confirmed.
      
      Details:
      Title: ${booking.title}
      Date: ${new Date(booking.startTime).toLocaleDateString()}
      Time: ${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(
    booking.endTime
  ).toLocaleTimeString()}
      
      Join Link: ${booking.meetingLink || "To be provided"}
    `;

  const tutorMessage = `
      You have a new booking with ${student.firstName} ${student.lastName}.
      
      Details:
      Title: ${booking.title}
      Date: ${new Date(booking.startTime).toLocaleDateString()}
      Time: ${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(
    booking.endTime
  ).toLocaleTimeString()}
      
      Join Link: ${booking.meetingLink || "To be provided"}
    `;

  // Send email notifications
  await Promise.all([
    sendEmail(
      {
        email: student.email,
        name: `${student.firstName} ${student.lastName}`,
      },
      subject,
      studentMessage
    ),
    sendEmail(
      { email: tutor.email, name: `${tutor.firstName} ${tutor.lastName}` },
      subject,
      tutorMessage
    ),
  ]);

  // Create in-app notifications
  await Promise.all([
    createNotification(
      student.id,
      "booking_confirmed",
      "Booking Confirmed",
      `Your booking with ${tutor.firstName} ${tutor.lastName} has been confirmed.`,
      {
        bookingId: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        title: booking.title,
      }
    ),
    createNotification(
      tutor.id,
      "booking_created",
      "New Booking",
      `You have a new booking with ${student.firstName} ${student.lastName}.`,
      {
        bookingId: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        title: booking.title,
      }
    ),
  ]);

  return true;
};

/**
 * Sends a booking cancellation notification
 * @param {Object} booking - Booking details
 * @param {Object} student - Student details
 * @param {Object} tutor - Tutor details
 * @param {string} cancelledBy - Who cancelled the booking
 * @returns {Promise<boolean>} Success status
 */
const sendBookingCancellation = async (
  booking,
  student,
  tutor,
  cancelledBy
) => {
  const subject = `Booking Cancelled: ${booking.title}`;
  const message = `
      Your booking on ${new Date(
        booking.startTime
      ).toLocaleDateString()} at ${new Date(
    booking.startTime
  ).toLocaleTimeString()} has been cancelled by ${cancelledBy}.
      
      Details:
      Title: ${booking.title}
      Date: ${new Date(booking.startTime).toLocaleDateString()}
      Time: ${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(
    booking.endTime
  ).toLocaleTimeString()}
      
      Please contact us if you have any questions.
    `;

  // Send email notifications
  await Promise.all([
    sendEmail(
      {
        email: student.email,
        name: `${student.firstName} ${student.lastName}`,
      },
      subject,
      message
    ),
    sendEmail(
      { email: tutor.email, name: `${tutor.firstName} ${tutor.lastName}` },
      subject,
      message
    ),
  ]);

  // Create in-app notifications
  await Promise.all([
    createNotification(
      student.id,
      "booking_cancelled",
      "Booking Cancelled",
      `Your booking "${booking.title}" has been cancelled by ${cancelledBy}.`,
      {
        bookingId: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
      }
    ),
    createNotification(
      tutor.id,
      "booking_cancelled",
      "Booking Cancelled",
      `Your booking "${booking.title}" has been cancelled by ${cancelledBy}.`,
      {
        bookingId: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
      }
    ),
  ]);

  return true;
};

/**
 * Sends a message notification
 * @param {Object} message - Message object
 * @param {Object} sender - Sender user object
 * @param {Object} recipient - Recipient user object
 * @returns {Promise<boolean>} Success status
 */
/**
 * Sends a notification about a new message
 * @param {Object} recipient - Recipient user object
 * @param {Object} sender - Sender user object
 * @param {string} messageContent - Content of the message
 * @param {string} conversationId - ID of the conversation
 * @returns {Promise<Object>} Created notification
 */
const sendMessageNotification = async (recipient, sender, messageContent, conversationId) => {
  try {
    // Don't send notification if recipient is the sender
    if (recipient.id === sender.id) {
      console.log(`Skipping notification: recipient ${recipient.id} is the sender`);
      return null;
    }

    console.log(`Preparing message notification for user ${recipient.id} from ${sender.id}`);
    
    // Create a preview of the message (truncate if too long)
    const contentPreview = messageContent.length > 50 
      ? `${messageContent.substring(0, 47)}...` 
      : messageContent;
    
    // Create notification title and content
    const title = `New message from ${sender.fullName}`;
    const content = contentPreview;
    
    // IMPORTANT: Use the correct notification type that matches your model definition
    // This should match the enum in your Notification model
    const notificationType = 'message_received';
    
    console.log(`Creating message notification with type: ${notificationType}`);
    
    // Create notification with metadata
    const notification = await createNotification(
      recipient.id,
      notificationType,
      title,
      content,
      {
        senderId: sender.id,
        senderName: sender.fullName,
        conversationId: conversationId,
        messagePreview: contentPreview
      }
    );
    
    if (notification) {
      console.log(`Successfully created message notification ID: ${notification.id}`);
    } else {
      console.error(`Failed to create message notification for user ${recipient.id}`);
    }
    
    return notification;
  } catch (error) {
    console.error("Error sending message notification:", error);
    console.error(error.stack); // Add stack trace for better debugging
    return null;
  }
};

/**
 * Sends a system notification to a user
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} content - Notification content
 * @param {Object} metadata - Additional data
 * @returns {Promise<boolean>} Success status
 */
const sendSystemNotification = async (userId, title, content, metadata = {}) => {
  await createNotification(
    userId,
    "system_notification",
    title,
    content,
    metadata
  );

  return true;
};

/**
 * Gets notifications for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit, offset, unreadOnly)
 * @returns {Promise<Object>} Notifications and count
 */
const getUserNotifications = async (userId, options = {}) => {
  const { limit = 20, offset = 0, unreadOnly = false } = options;
  
  const whereClause = {
    userId,
  };
  
  // Add filter for unread notifications if requested
  if (unreadOnly) {
    whereClause.isRead = false;
  }
  
  try {
    console.log(`Fetching notifications for user ${userId} with options:`, options);
    console.log(`Where clause:`, JSON.stringify(whereClause));
    
    const { rows, count } = await Notification.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });
    
    console.log(`Found ${count} notifications for user ${userId}`);
    
    // If count is 0, let's check if the user has any notifications at all
    if (count === 0) {
      const totalCount = await Notification.count({ where: { userId } });
      console.log(`User ${userId} has ${totalCount} total notifications in the database`);
    }
    
    return { rows, count };
  } catch (error) {
    console.error("Error retrieving user notifications:", error);
    console.error(error.stack); // Add stack trace for better debugging
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<boolean>} Success status
 */
const markNotificationAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    where: { id: notificationId, userId },
  });

  if (!notification) return false;

  notification.isRead = true;
  await notification.save();
  return true;
};

/**
 * Mark all notifications as read
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of notifications marked as read
 */
const markAllNotificationsAsRead = async (userId) => {
  const result = await Notification.update(
    { isRead: true },
    { where: { userId, isRead: false } }
  );
  return result[0]; // Number of rows affected
};

/**
 * Sends a notification about a booking event
 * @param {string} userId - User ID to notify
 * @param {string} type - Notification type (booking_created, booking_confirmed, booking_cancelled)
 * @param {string} title - Notification title
 * @param {string} content - Notification content
 * @param {Object} bookingData - Booking related data
 * @returns {Promise<Object>} Created notification
 */
const sendBookingNotification = async (userId, type, title, content, bookingData) => {
  try {
    console.log(`Sending booking notification of type ${type} to user ${userId}`);
    
    // Create notification
    const notification = await createNotification(
      userId,
      type,
      title,
      content,
      bookingData
    );
    
    // Also send an email notification
    const user = await User.findByPk(userId);
    if (user && user.email) {
      await sendEmail(
        { email: user.email, name: user.fullName },
        title,
        content
      );
    }
    
    return notification;
  } catch (error) {
    console.error("Error sending booking notification:", error);
    console.error(error.stack);
    return null;
  }
};

module.exports = {
  sendEmail,
  createNotification,
  sendBookingConfirmation,
  sendBookingCancellation,
  sendMessageNotification,
  sendSystemNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  sendBookingNotification,
};
