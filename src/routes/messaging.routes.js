const express = require("express");
const router = express.Router();
const messagingController = require("../controllers/messaging.controller");
const { authenticateUser } = require("../middleware/auth.middleware");

// All routes require authentication
router.use(authenticateUser);

// Get all conversations for the current user
router.get("/conversations", messagingController.getMyConversations);

// Get or create a conversation with another user
router.post("/conversations", messagingController.getOrCreateConversation);

// Create a conversation for a booking
router.post(
  "/conversations/booking",
  messagingController.createBookingConversation
);

// Get messages for a conversation
router.get(
  "/conversations/:conversationId/messages",
  messagingController.getConversationMessages
);

// Delete a conversation (soft delete)
router.delete("/conversations/:conversationId", messagingController.deleteConversation);

// Send a message
router.post("/messages", messagingController.sendMessage);

// Delete a message
router.delete("/messages/:messageId", messagingController.deleteMessage);

// Send typing indicator
router.post("/typing-indicator", messagingController.sendTypingIndicator);

module.exports = router;
