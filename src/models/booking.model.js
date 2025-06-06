const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Booking = sequelize.define(
  "Booking",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    studentId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    providerId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    availabilityId: {
      type: DataTypes.INTEGER, // Changed from UUID to INTEGER to match Availability model
      allowNull: true,
      references: {
        model: "availabilities",
        key: "id",
      },
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    dayOfWeek: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 6,
      },
    },
    status: {
      type: DataTypes.ENUM("pending", "confirmed", "cancelled", "completed"),
      defaultValue: "pending",
    },
    cancellationReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sessionType: {
      type: DataTypes.ENUM("virtual", "in-person"),
      defaultValue: "virtual",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    studentName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    providerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    providerRole: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "bookings",
    timestamps: true,
  }
);

module.exports = Booking;
