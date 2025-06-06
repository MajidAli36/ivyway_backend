const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const CalendarIntegration = sequelize.define(
  "CalendarIntegration",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      unique: true,
    },
    provider: {
      type: DataTypes.ENUM("google", "outlook", "apple"),
      defaultValue: "google",
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tokenExpiry: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    calendarId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "calendar_integrations",
    timestamps: true,
  }
);

module.exports = CalendarIntegration;
