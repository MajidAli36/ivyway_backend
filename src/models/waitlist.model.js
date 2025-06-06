const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WaitlistUser = sequelize.define(
  "WaitlistUser",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "full_name",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "phone_number",
      validate: {
        // Basic phone validation (can be customized)
        is: /^(\+\d{1,3}[- ]?)?\d{10,14}$/,
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "coming-soon-page",
    },
  },
  {
    tableName: "waitlist_users",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
    ],
  }
);

module.exports = WaitlistUser;
