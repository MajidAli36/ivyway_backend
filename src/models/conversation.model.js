const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Conversation = sequelize.define(
  "Conversation",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    participantIds: {
      type: DataTypes.ARRAY(DataTypes.STRING), // Changed from UUID to STRING for Firebase IDs
      allowNull: false,
      comment: "Array of user IDs participating in this conversation",
      validate: {
        notEmpty: true, // Ensure the array is not empty
      },
    },
    type: {
      type: DataTypes.ENUM("direct", "group"),
      defaultValue: "direct",
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Title for group conversations",
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: "Additional metadata like related booking ID, etc.",
    },
  },
  {
    tableName: "conversations",
    timestamps: true,
  }
);

module.exports = Conversation;
