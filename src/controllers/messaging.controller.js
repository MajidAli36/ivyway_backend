const { User, Conversation, Message, Booking } = require("../models");
const { success } = require("../utils/response-formatter");
const {
  catchAsync,
  notFound,
  badRequest,
  forbidden,
} = require("../utils/error-handler");
const { Op, Sequelize } = require("sequelize"); // Add Sequelize import
const socketService = require("../services/socket.service");
const notificationService = require("../services/notification.service");

/**
 * Get all conversations for the current user
 */
const getMyConversations = catchAsync(async (req, res) => {
  const userId = req.user.id;

  // Fix: Ensure we're using the correct array query syntax and filter out deleted conversations
  const conversations = await Conversation.findAll({
    where: {
      participantIds: {
        [Op.contains]: [userId],
      },
      // Don't show conversations that have been deleted by this user
      [Op.or]: [
        Sequelize.literal(`metadata IS NULL`),
        Sequelize.literal(`metadata->>'deletedFor' IS NULL`),
        Sequelize.literal(
          `NOT (metadata->'deletedFor' @> '"${userId}"'::jsonb)`
        ),
      ],
    },
    order: [["lastMessageAt", "DESC"]],
    include: [
      {
        model: Message,
        as: "messages",
        limit: 1,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: User,
            as: "sender",
            attributes: ["id", "fullName", "role"],
          },
        ],
      },
    ],
  });

  // Get participant details for each conversation
  const conversationsWithDetails = await Promise.all(
    conversations.map(async (conversation) => {
      const participantIds = conversation.participantIds.filter(
        (id) => id !== userId
      );

      const participants = await User.findAll({
        where: {
          id: {
            [Op.in]: participantIds,
          },
        },
        attributes: ["id", "fullName", "email", "role"],
      });

      // Fix the unread count query in getMyConversations function (around line 50)
      const unreadCount = await Message.count({
        where: {
          conversationId: conversation.id,
          senderId: {
            [Op.ne]: userId,
          },
          [Op.and]: [
            Sequelize.literal(
              `NOT ("readBy" @> ARRAY['${userId}']::varchar[])`
            ),
          ],
          isDeleted: false, // Don't count deleted messages
        },
      });

      // Check if participants are online
      const participantsWithStatus = participants.map((participant) => ({
        ...participant.toJSON(),
        isOnline: socketService.isUserOnline(participant.id),
      }));

      return {
        ...conversation.toJSON(),
        participants: participantsWithStatus,
        unreadCount,
      };
    })
  );

  res.json(
    success(conversationsWithDetails, "Conversations retrieved successfully")
  );
});

/**
 * Get or create a conversation with another user
 */
const getOrCreateConversation = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { participantId } = req.body;

  if (!participantId) {
    throw badRequest("Participant ID is required");
  }

  // Check if participant exists
  const participant = await User.findByPk(participantId);
  if (!participant) {
    throw notFound("Participant not found");
  }

  // Update the conversation query
  let conversation = await Conversation.findOne({
    where: {
      type: "direct",
      participantIds: {
        [Op.contains]: [userId, participantId],
      },
      [Op.and]: [Sequelize.literal(`array_length("participantIds", 1) = 2`)],
    },
  });

  // If no conversation exists, create one
  if (!conversation) {
    conversation = await Conversation.create({
      type: "direct",
      participantIds: [userId, participantId],
      lastMessageAt: new Date(),
      metadata: {
        deletedFor: [],
      },
    });
  }

  // Get participant details
  const participantDetails = await User.findOne({
    where: {
      id: participantId,
    },
    attributes: ["id", "fullName", "email", "role"],
  });

  // Return conversation with participant details
  const result = {
    ...conversation.toJSON(),
    participant: {
      ...participantDetails.toJSON(),
      isOnline: socketService.isUserOnline(participantId),
    },
  };

  res.json(success(result, "Conversation retrieved successfully"));
});

/**
 * Create a conversation for a booking
 */
const createBookingConversation = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { bookingId } = req.body;

  if (!bookingId) {
    throw badRequest("Booking ID is required");
  }

  // Find the booking
  const booking = await Booking.findByPk(bookingId, {
    include: [
      {
        model: User,
        as: "student",
        attributes: ["id", "fullName"],
      },
      {
        model: User,
        as: "provider",
        attributes: ["id", "fullName"],
      },
    ],
  });

  if (!booking) {
    throw notFound("Booking not found");
  }

  // Check if user is part of the booking
  if (booking.studentId !== userId && booking.providerId !== userId) {
    throw forbidden(
      "You are not authorized to create a conversation for this booking"
    );
  }

  // First, check if a conversation already exists between these two users
  // regardless of booking ID
  let conversation = await Conversation.findOne({
    where: {
      type: "direct",
      participantIds: {
        [Op.contains]: [booking.studentId, booking.providerId],
      },
      [Op.and]: [
        // Remove the ::uuid[] cast since we're using strings
        Sequelize.literal(`array_length("participantIds", 1) = 2`),
        {
          [Op.or]: [
            Sequelize.literal(`metadata IS NULL`),
            Sequelize.literal(`metadata->>'deletedFor' IS NULL`),
            Sequelize.literal(`NOT (metadata->'deletedFor' @> '"${userId}"')`),
          ],
        },
      ],
    },
  });

  // If no active conversation exists, check if there's a deleted one we can restore
  if (!conversation) {
    const deletedConversation = await Conversation.findOne({
      where: {
        type: "direct",
        participantIds: {
          [Op.contains]: [booking.studentId, booking.providerId],
        },
        [Op.and]: [
          Sequelize.literal(`array_length("participantIds", 1) = 2`),
          Sequelize.literal(`metadata->'deletedFor' @> '"${userId}"'`),
        ],
      },
    });

    if (deletedConversation) {
      // Restore the deleted conversation by removing user from deletedFor array
      const metadata = deletedConversation.metadata || {};
      const updatedDeletedFor = (metadata.deletedFor || []).filter(
        (id) => id !== userId
      );

      await deletedConversation.update({
        metadata: {
          ...metadata,
          deletedFor: updatedDeletedFor,
        },
        lastMessageAt: new Date(), // Update last message time to bring it to top
      });

      conversation = deletedConversation;
    }
  }

  // If no conversation exists (neither active nor deleted), create a new one
  if (!conversation) {
    conversation = await Conversation.create({
      type: "direct",
      participantIds: [booking.studentId, booking.providerId],
      title: `${booking.student.fullName} & ${booking.provider.fullName}`,
      lastMessageAt: new Date(),
      metadata: {
        bookings: [
          {
            bookingId,
            bookingStartTime: booking.startTime,
            bookingEndTime: booking.endTime,
          },
        ],
        deletedFor: [], // Initialize empty deletedFor array
      },
    });

    // Create a system message about the booking
    const systemMessage = await Message.create({
      conversationId: conversation.id,
      senderId: booking.providerId, // Use provider as sender for system message
      content: `New session scheduled on ${new Date(
        booking.startTime
      ).toLocaleDateString()} at ${new Date(
        booking.startTime
      ).toLocaleTimeString()}`,
      contentType: "text",
      metadata: {
        isSystemMessage: true,
        bookingId: bookingId,
      },
      readBy: [booking.providerId], // Mark as read by provider
    });

    // Send notification to the other participant about the new booking conversation
    const otherUserId =
      userId === booking.studentId ? booking.providerId : booking.studentId;
    const otherUser =
      userId === booking.studentId ? booking.provider : booking.student;
    const currentUser = await User.findByPk(userId, {
      attributes: ["id", "fullName", "role"],
    });

    // Send notification about the new booking conversation
    await notificationService.sendSystemNotification(
      otherUserId,
      "New Booking Conversation",
      `${currentUser.fullName} has started a conversation about your booking.`,
      {
        conversationId: conversation.id,
        bookingId: bookingId,
        bookingStartTime: booking.startTime,
        bookingEndTime: booking.endTime,
      }
    );
  } else {
    // Conversation exists, update it to include this booking if not already included
    const metadata = conversation.metadata || {};
    const bookings = metadata.bookings || [];

    // Check if this booking is already in the bookings array
    const bookingExists = bookings.some((b) => b.bookingId === bookingId);

    if (!bookingExists) {
      // Add the new booking to the bookings array
      bookings.push({
        bookingId,
        bookingStartTime: booking.startTime,
        bookingEndTime: booking.endTime,
      });

      // Update the conversation metadata
      await conversation.update({
        metadata: {
          ...metadata,
          bookings,
        },
        lastMessageAt: new Date(), // Update last message time to bring it to top
      });

      // Create a system message about the new booking
      await Message.create({
        conversationId: conversation.id,
        senderId: booking.providerId, // Use provider as sender for system message
        content: `New session scheduled on ${new Date(
          booking.startTime
        ).toLocaleDateString()} at ${new Date(
          booking.startTime
        ).toLocaleTimeString()}`,
        contentType: "text",
        metadata: {
          isSystemMessage: true,
          bookingId: bookingId,
        },
        readBy: [booking.providerId], // Mark as read by provider
      });
    }
  }

  // Get participant details
  const otherUserId =
    userId === booking.studentId ? booking.providerId : booking.studentId;
  const otherUser =
    userId === booking.studentId ? booking.provider : booking.student;

  // Return conversation with participant details
  const result = {
    ...conversation.toJSON(),
    participant: {
      ...otherUser.toJSON(),
      isOnline: socketService.isUserOnline(otherUserId),
    },
    booking: {
      id: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
    },
  };

  res.json(success(result, "Conversation retrieved successfully"));
});

/**
 * Get messages for a conversation
 */
const getConversationMessages = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { conversationId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  // Find the conversation
  const conversation = await Conversation.findByPk(conversationId);

  if (!conversation) {
    throw notFound("Conversation not found");
  }

  // Check if user is a participant
  if (!conversation.participantIds.includes(userId)) {
    throw forbidden("You are not authorized to view this conversation");
  }

  // Calculate pagination
  const offset = (page - 1) * limit;

  // Get messages with pagination - include deleted messages but mark them as deleted
  const messages = await Message.findAll({
    where: {
      conversationId,
    },
    order: [["createdAt", "DESC"]],
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: User,
        as: "sender",
        attributes: ["id", "fullName", "role"],
      },
    ],
  });

  // Mark messages as read (only non-deleted messages)
  const messagesToUpdate = messages.filter(
    (message) =>
      message.senderId !== userId &&
      !message.readBy.includes(userId) &&
      !message.isDeleted
  );

  if (messagesToUpdate.length > 0) {
    await Promise.all(
      messagesToUpdate.map((message) => {
        message.readBy = [...message.readBy, userId];
        return message.save();
      })
    );
  }

  // Get total count for pagination (include deleted messages for consistent pagination)
  const totalCount = await Message.count({
    where: {
      conversationId,
    },
  });

  res.json(
    success(
      {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      "Messages retrieved successfully"
    )
  );
});

/**
 * Send a message
 */
const sendMessage = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const {
    conversationId,
    content,
    contentType = "text",
    metadata = {},
  } = req.body;

  if (!conversationId || !content) {
    throw badRequest("Conversation ID and content are required");
  }

  // Find the conversation
  const conversation = await Conversation.findByPk(conversationId);

  if (!conversation) {
    throw notFound("Conversation not found");
  }

  // Check if user is a participant
  if (!conversation.participantIds.includes(userId)) {
    throw forbidden(
      "You are not authorized to send messages to this conversation"
    );
  }

  // Create the message
  const message = await Message.create({
    conversationId,
    senderId: userId,
    content,
    contentType,
    metadata,
    readBy: [userId], // Sender has read the message
  });

  // Update conversation's lastMessageAt
  await conversation.update({ lastMessageAt: new Date() });

  // Get sender info for response
  const sender = await User.findByPk(userId, {
    attributes: ["id", "fullName", "role"],
  });

  const messageWithSender = {
    ...message.toJSON(),
    sender: sender.toJSON(),
  };

  // Send notifications to other participants
  const otherParticipants = conversation.participantIds.filter(
    (id) => id !== userId
  );

  if (otherParticipants.length > 0) {
    // Get recipient users
    const recipients = await User.findAll({
      where: {
        id: {
          [Op.in]: otherParticipants,
        },
      },
      attributes: ["id", "fullName", "email", "role"],
    });

    // Send notification to each recipient
    for (const recipient of recipients) {
      await notificationService.sendMessageNotification(
        recipient,
        sender,
        content,
        conversationId
      );
    }
  }

  // Send socket event to conversation participants
  socketService.sendToConversation(
    conversationId,
    "message:new",
    messageWithSender
  );

  res.status(201).json(success(messageWithSender, "Message sent successfully"));
});

/**
 * Delete a message
 */
const deleteMessage = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { messageId } = req.params;

  // Find the message
  const message = await Message.findByPk(messageId);

  if (!message) {
    throw notFound("Message not found");
  }

  // Check if user is the sender of the message
  if (message.senderId !== userId) {
    throw forbidden("You can only delete your own messages");
  }

  // If the message is already deleted, return success without error
  // This prevents errors when multiple delete requests happen for the same message
  if (message.isDeleted) {
    return res.json(success(null, "Message deleted successfully"));
  }

  // Soft delete the message (mark as deleted)
  message.isDeleted = true;
  await message.save();

  // Notify conversation participants about the deleted message
  const socketService = require("../services/socket.service");
  socketService.sendToConversation(message.conversationId, "message:deleted", {
    messageId: message.id,
    conversationId: message.conversationId,
  });

  res.json(success(null, "Message deleted successfully"));
});

/**
 * Send typing indicator
 */
const sendTypingIndicator = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { conversationId, isTyping } = req.body;

  if (!conversationId || isTyping === undefined) {
    throw badRequest("Conversation ID and typing status are required");
  }

  // Find the conversation
  const conversation = await Conversation.findByPk(conversationId);

  if (!conversation) {
    throw notFound("Conversation not found");
  }

  // Check if user is a participant
  if (!conversation.participantIds.includes(userId)) {
    throw forbidden("You are not a participant in this conversation");
  }

  // Get user info
  const user = await User.findByPk(userId, {
    attributes: ["id", "fullName", "role"],
  });

  // Send typing indicator to all participants via socket
  const socketService = require("../services/socket.service");
  socketService.sendToConversation(conversationId, "typing:indicator", {
    userId: user.id,
    userName: user.fullName,
    conversationId,
    isTyping,
  });

  res.json(success(null, "Typing indicator sent successfully"));
});

/**
 * Add a reaction to a message
 */
const addReaction = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { messageId } = req.params;
  const { reaction } = req.body;

  // Validate reaction
  const validReactions = ["like", "love", "laugh", "wow", "sad", "angry"];
  if (!validReactions.includes(reaction)) {
    throw badRequest(
      `Invalid reaction. Must be one of: ${validReactions.join(", ")}`
    );
  }

  // Find the message
  const message = await Message.findByPk(messageId);
  if (!message) {
    throw notFound("Message not found");
  }

  // Check if user is part of the conversation
  const conversation = await Conversation.findByPk(message.conversationId);
  if (!conversation) {
    throw notFound("Conversation not found");
  }

  // Verify user is a participant
  const isParticipant = conversation.participantIds.includes(userId);
  if (!isParticipant) {
    throw forbidden("You are not a participant in this conversation");
  }

  // Update reactions
  const reactions = message.reactions || {};

  // Initialize reaction array if it doesn't exist
  if (!reactions[reaction]) {
    reactions[reaction] = [];
  }

  // Add user to reaction if not already there, otherwise remove (toggle)
  const userIndex = reactions[reaction].indexOf(userId);
  if (userIndex === -1) {
    reactions[reaction].push(userId);
  } else {
    reactions[reaction].splice(userIndex, 1);

    // Remove empty reaction arrays
    if (reactions[reaction].length === 0) {
      delete reactions[reaction];
    }
  }

  // Save updated message
  message.reactions = reactions;
  await message.save();

  // Notify other participants via socket
  const socketService = require("../services/socket.service");
  socketService.sendToConversation(message.conversationId, "message:reaction", {
    messageId: message.id,
    userId,
    reaction,
    userName: req.user.fullName,
  });

  return res.json(success(message, "Reaction updated successfully"));
});

/**
 * Delete a conversation (hard delete)
 */
const deleteConversation = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { conversationId } = req.params;

  // Find the conversation
  const conversation = await Conversation.findByPk(conversationId);

  if (!conversation) {
    throw notFound("Conversation not found");
  }

  // Check if user is a participant
  if (!conversation.participantIds.includes(userId)) {
    throw forbidden("You are not a participant in this conversation");
  }

  // Delete all messages in this conversation
  await Message.destroy({
    where: {
      conversationId,
    },
  });

  // Delete the conversation itself
  await conversation.destroy();

  res.json(success({}, "Conversation and all messages deleted successfully"));
});

// Add to module.exports
module.exports = {
  getMyConversations,
  getOrCreateConversation,
  createBookingConversation,
  getConversationMessages,
  sendMessage,
  deleteMessage,
  sendTypingIndicator,
  addReaction,
  deleteConversation, // Add the new function to exports
};
