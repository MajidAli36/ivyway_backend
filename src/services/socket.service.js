const socketIO = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const { User, Conversation, Message } = require("../models");
const { verifyToken } = require("../utils/auth-helper");

let io;

// Map to store active user connections
const connectedUsers = new Map();

// Map to store typing status (conversationId -> Map of userId -> timestamp)
const typingUsers = new Map();

// Initialize Socket.io
const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: "*", // In production, restrict this to your frontend domain
      methods: ["GET", "POST"],
    },
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error: Token missing"));
      }

      const decoded = await verifyToken(token);
      if (!decoded) {
        return next(new Error("Authentication error: Invalid token"));
      }

      // Attach user data to socket
      socket.user = {
        id: decoded.uid,
        role: decoded.role,
      };

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.user.id}`);

    try {
      // Get full user data
      const user = await User.findOne({
        where: { id: socket.user.id },
        attributes: ["id", "fullName", "email", "role"],
      });

      if (!user) {
        socket.disconnect();
        return;
      }

      // Add user to connected users map
      connectedUsers.set(socket.user.id, socket.id);

      // Join user to their personal room
      socket.join(socket.user.id);

      // Notify others that user is online
      socket.broadcast.emit("user:online", {
        userId: socket.user.id,
        fullName: user.fullName,
      });

      // Handle joining conversation
      socket.on("conversation:join", async (conversationId) => {
        try {
          const conversation = await Conversation.findByPk(conversationId);

          if (!conversation) {
            socket.emit("error", { message: "Conversation not found" });
            return;
          }

          // Check if user is a participant
          if (
            !Array.isArray(conversation.participantIds) ||
            !conversation.participantIds.includes(socket.user.id)
          ) {
            socket.emit("error", {
              message: "Not authorized to join this conversation",
            });
            return;
          }

          socket.join(conversationId);
          console.log(
            `User ${socket.user.id} joined conversation ${conversationId}`
          );
        } catch (error) {
          console.error("Error joining conversation:", error);
          socket.emit("error", { message: "Failed to join conversation" });
        }
      });

      // Handle typing indicator
      socket.on("typing:indicator", async (data) => {
        try {
          const { conversationId, isTyping } = data;
          
          if (!conversationId) {
            socket.emit("error", { message: "Conversation ID is required" });
            return;
          }

          const conversation = await Conversation.findByPk(conversationId);
          if (!conversation) {
            socket.emit("error", { message: "Conversation not found" });
            return;
          }

          // Check if user is a participant
          if (!conversation.participantIds.includes(socket.user.id)) {
            socket.emit("error", {
              message: "Not authorized for this conversation",
            });
            return;
          }

          // Update typing status
          if (!typingUsers.has(conversationId)) {
            typingUsers.set(conversationId, new Map());
          }
          
          const conversationTypers = typingUsers.get(conversationId);
          
          if (isTyping) {
            // Set typing status with timestamp
            conversationTypers.set(socket.user.id, Date.now());
          } else {
            // Remove typing status
            conversationTypers.delete(socket.user.id);
          }

          // Broadcast typing status to all participants except sender
          socket.to(conversationId).emit("typing:indicator", {
            userId: socket.user.id,
            userName: user.fullName,
            conversationId,
            isTyping,
          });
        } catch (error) {
          console.error("Error handling typing indicator:", error);
          socket.emit("error", { message: "Failed to process typing indicator" });
        }
      });

      // Handle message deletion
      socket.on("message:delete", async (data) => {
  try {
    const { messageId } = data;
    
    if (!messageId) {
      socket.emit("error", { message: "Message ID is required" });
      return;
    }

    // Find the message
    const message = await Message.findByPk(messageId);
    if (!message) {
      socket.emit("error", { message: "Message not found" });
      return;
    }

    // Check if user is the sender
    if (message.senderId !== socket.user.id) {
      socket.emit("error", { message: "You can only delete your own messages" });
      return;
    }

    // Don't throw an error if the message is already deleted
    if (!message.isDeleted) {
      // Soft delete the message
      message.isDeleted = true;
      await message.save();
    }

    // Always broadcast deletion to all participants
    io.to(message.conversationId).emit("message:deleted", {
      messageId: message.id,
      conversationId: message.conversationId,
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    socket.emit("error", { message: "Failed to delete message" });
  }
});

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.user.id}`);
        
        // Remove user from connected users
        connectedUsers.delete(socket.user.id);
        
        // Remove user from all typing indicators
        typingUsers.forEach((conversationTypers, conversationId) => {
          if (conversationTypers.has(socket.user.id)) {
            conversationTypers.delete(socket.user.id);
            
            // Notify others that user stopped typing
            socket.to(conversationId).emit("typing:indicator", {
              userId: socket.user.id,
              userName: user.fullName,
              conversationId,
              isTyping: false,
            });
          }
        });
        
        // Notify others that user is offline
        socket.broadcast.emit("user:offline", {
          userId: socket.user.id,
        });
      });
    } catch (error) {
      console.error("Socket connection error:", error);
      socket.disconnect();
    }
  });
};

/**
 * Check if a user is online
 * @param {string} userId - User ID
 * @returns {boolean} True if user is online
 */
const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

/**
 * Send a message to a specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Data to send
 */
const sendToUser = (userId, event, data) => {
  try {
    console.log(`Attempting to send socket event "${event}" to user ${userId}`);
    
    const socketId = connectedUsers.get(userId);
    if (socketId) {
      console.log(`Found socket ID ${socketId} for user ${userId}`);
      io.to(socketId).emit(event, data);
      console.log(`Socket event "${event}" sent successfully to user ${userId}`);
      return true;
    } else {
      console.log(`No active socket connection found for user ${userId}`);
      return false;
    }
  } catch (error) {
    console.error(`Error sending socket event to user ${userId}:`, error);
    return false;
  }
};

/**
 * Send a message to all users in a conversation
 * @param {string} conversationId - ID of the conversation
 * @param {string} event - Event name
 * @param {Object} data - Data to send
 */
const sendToConversation = async (conversationId, event, data) => {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }

  try {
    // Get the conversation to find participants
    const Conversation = require('../models').Conversation;
    const conversation = await Conversation.findByPk(conversationId);
    
    if (!conversation) {
      console.warn(`Conversation ${conversationId} not found`);
      return;
    }

    // Send to each participant who is online
    for (const userId of conversation.participantIds) {
      const socketId = connectedUsers.get(userId);
      if (socketId) {
        io.to(socketId).emit(event, data);
      }
    }
  } catch (error) {
    console.error('Error sending to conversation:', error);
  }
};

// Move the getIO function definition here
/**
 * Get the socket.io instance
 * @returns {Object|null} Socket.io instance or null if not initialized
 */
const getIO = () => {
  if (!io) {
    console.warn('Socket.io not initialized');
    return null;
  }
  return io;
};

// Make sure this function is defined before the module.exports
/**
 * Get users who are currently typing in a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Array} Array of user IDs who are typing
 */
const getTypingUsers = (conversationId) => {
  if (!typingUsers.has(conversationId)) {
    return [];
  }
  
  const conversationTypers = typingUsers.get(conversationId);
  const now = Date.now();
  const typingTimeout = 5000; // 5 seconds
  
  // Filter out stale typing indicators (older than 5 seconds)
  const activeTypers = [];
  conversationTypers.forEach((timestamp, userId) => {
    if (now - timestamp < typingTimeout) {
      activeTypers.push(userId);
    } else {
      // Remove stale typing indicator
      conversationTypers.delete(userId);
    }
  });
  
  return activeTypers;
};

/**
 * Send a booking notification to a user
 * @param {string} userId - User ID to send notification to
 * @param {string} bookingId - ID of the booking
 * @param {string} type - Type of notification (confirmed, cancelled, rescheduled)
 * @param {Object} bookingData - Additional booking data
 * @returns {boolean} Success status
 */
const sendBookingNotification = (userId, bookingId, type, bookingData) => {
  try {
    console.log(`Sending booking ${type} notification to user ${userId} for booking ${bookingId}`);
    
    const eventName = `booking:${type}`;
    const data = {
      bookingId,
      type,
      timestamp: Date.now(),
      ...bookingData
    };
    
    return sendToUser(userId, eventName, data);
  } catch (error) {
    console.error(`Error sending booking notification to user ${userId}:`, error);
    return false;
  }
};

module.exports = {
  initializeSocket,
  getIO,
  isUserOnline,
  sendToUser,
  sendToConversation,
  getTypingUsers,
  sendBookingNotification, // Add this new function to exports
};
