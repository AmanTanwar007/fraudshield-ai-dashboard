'use strict';

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    name: {
      type:      DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type:      DataTypes.STRING(255),
      allowNull: false,
      unique:    true,
      validate:  { isEmail: true },
    },
    password: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type:         DataTypes.ENUM('admin', 'analyst', 'viewer'),
      defaultValue: 'analyst',
    },
    isActive: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
    },
    loginCount: {
      type:         DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName:  'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        user.password = await bcrypt.hash(user.password, 12);
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
    },
  });

  User.prototype.verifyPassword = async function (candidate) {
    return bcrypt.compare(candidate, this.password);
  };

  User.prototype.toSafeJSON = function () {
    const obj = this.toJSON();
    delete obj.password;
    return obj;
  };

  return User;
};
