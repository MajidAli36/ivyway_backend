const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const User = require("./user.model");

const TutorProfile = sequelize.define(
  "TutorProfile",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    // Personal Info
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Academic Info
    education: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    degree: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    certifications: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    graduationYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // Tutor Info
    subjects: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    experience: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Experience in years",
    },
  },
  {
    tableName: "tutor_profiles",
    timestamps: true,
  }
);

// Change the alias from "user" to "tutorUser" to avoid conflicts
TutorProfile.belongsTo(User, { foreignKey: "userId", as: "tutorUser" });

module.exports = TutorProfile;
