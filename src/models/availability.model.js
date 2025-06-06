const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const User = require("./user.model");

const Availability = sequelize.define(
  "Availability",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    providerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    providerRole: {
      type: DataTypes.STRING,
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
    startTime: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    recurrence: {
      type: DataTypes.ENUM("one-time", "weekly", "biweekly", "monthly"),
      defaultValue: "weekly",
    },
  },
  {
    tableName: "availabilities",
    timestamps: true,
    hooks: {
      beforeCreate: async (availability) => {
        const user = await User.findByPk(availability.userId);
        if (user) {
          availability.providerName = user.fullName;
          availability.providerRole = user.role;
        }
      },

      beforeUpdate: async (availability) => {
        if (availability.changed("userId")) {
          const user = await User.findByPk(availability.userId);
          if (user) {
            availability.providerName = user.fullName;
            availability.providerRole = user.role;
          }
        }
      },
    },
  }
);

module.exports = Availability;
