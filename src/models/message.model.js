const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Message = sequelize.define(
  "Message",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    conversationId: {
      type: DataTypes.INTEGER, // Make sure this matches Conversation id type
      allowNull: false,
      references: {
        model: "conversations",
        key: "id",
      },
    },
    senderId: {
      type: DataTypes.STRING, // This is correct for Firebase ID
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    contentType: {
      type: DataTypes.ENUM("text", "image", "file"),
      defaultValue: "text",
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: "Additional metadata like file URLs, etc.",
    },
    readBy: {
      type: DataTypes.ARRAY(DataTypes.STRING), // Changed from UUID to STRING array
      defaultValue: [],
      comment: "Array of user IDs who have read this message",
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether the message has been deleted",
    },
  },
  {
    tableName: "messages",
    timestamps: true,
  }
);

module.exports = Message;
