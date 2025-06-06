const notificationService = require("../services/notification.service");
const { success } = require("../utils/response-formatter");
const { catchAsync, notFound, forbidden } = require("../utils/error-handler");

/**
 * Get current user's notifications
 */
const getMyNotifications = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { limit, offset, unreadOnly } = req.query;

  const options = {
    limit: limit ? parseInt(limit) : 20,
    offset: offset ? parseInt(offset) : 0,
    unreadOnly: unreadOnly === "true",
  };

  const { rows: notifications, count } = await notificationService.getUserNotifications(
    userId,
    options
  );

  res.json(
    success(
      {
        notifications,
        pagination: {
          total: count,
          limit: options.limit,
          offset: options.offset,
        },
      },
      "Notifications retrieved successfully"
    )
  );
});

/**
 * Mark a notification as read
 */
const markAsRead = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { notificationId } = req.params;

  const result = await notificationService.markNotificationAsRead(
    notificationId,
    userId
  );

  if (!result) {
    throw notFound("Notification not found");
  }

  res.json(success({}, "Notification marked as read"));
});

/**
 * Mark all notifications as read
 */
const markAllAsRead = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const count = await notificationService.markAllNotificationsAsRead(userId);

  res.json(
    success({ count }, `${count} notifications marked as read`)
  );
});

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};