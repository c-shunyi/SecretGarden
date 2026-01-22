import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Pair = sequelize.define(
  'Pair',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userAId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_a_id'
    },
    userBId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_b_id'
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'ended'),
      allowNull: false,
      defaultValue: 'active'
    },
    boundAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'bound_at'
    }
  },
  {
    tableName: 'pairs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_a_id'] },
      { fields: ['user_b_id'] },
      { fields: ['status'] },
      { fields: ['user_a_id', 'user_b_id'], unique: true }
    ]
  }
);

export default Pair;
