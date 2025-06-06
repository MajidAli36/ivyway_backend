const User = require("./user.model");
const Availability = require("./availability.model");
const Booking = require("./booking.model");
const TutorProfile = require("./tutor-profile.model");
const Conversation = require("./conversation.model");
const Message = require("./message.model");
const Notification = require("./notification.model");
const CounselorProfile = require("./counselor-profile.model");
const WaitlistUser = require("./waitlist.model");

// User associations
User.hasMany(Availability, { foreignKey: "userId", as: "availabilities" });
User.hasMany(Booking, { foreignKey: "studentId", as: "studentBookings" });
User.hasMany(Booking, { foreignKey: "providerId", as: "providerBookings" });
User.hasOne(TutorProfile, { foreignKey: "userId", as: "tutorProfile" });
User.hasOne(CounselorProfile, { foreignKey: "userId", as: "counselorProfile" });
User.hasMany(Message, { foreignKey: "senderId", as: "sentMessages" });

// TutorProfile associations
TutorProfile.belongsTo(User, { foreignKey: "userId", as: "user" });

// CounselorProfile associations
CounselorProfile.belongsTo(User, { foreignKey: "userId", as: "user" });

// Availability associations
Availability.belongsTo(User, { foreignKey: "userId", as: "provider" });
Availability.hasMany(Booking, { foreignKey: "availabilityId", as: "bookings" });

// Booking associations
Booking.belongsTo(User, { foreignKey: "studentId", as: "student" });
Booking.belongsTo(User, { foreignKey: "providerId", as: "provider" });
Booking.belongsTo(Availability, {
  foreignKey: "availabilityId",
  as: "availability",
});

// Conversation associations
Conversation.hasMany(Message, {
  foreignKey: "conversationId",
  as: "messages",
});

// Message associations
Message.belongsTo(Conversation, {
  foreignKey: "conversationId",
  as: "conversation",
});
Message.belongsTo(User, {
  foreignKey: "senderId",
  as: "sender",
});

module.exports = {
  User,
  Availability,
  Booking,
  TutorProfile,
  Conversation,
  Message,
  Notification,
  CounselorProfile,
  WaitlistUser,
};
