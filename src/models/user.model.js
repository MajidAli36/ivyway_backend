const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      // This will be the Firebase UID
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    role: {
      type: DataTypes.ENUM("student", "tutor", "counselor", "admin"),
      allowNull: false,
      defaultValue: "student",
    },
  },
  {
    tableName: "users",
    timestamps: true,
  }
);

module.exports = User;
