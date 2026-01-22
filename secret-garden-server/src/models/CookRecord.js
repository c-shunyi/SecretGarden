import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CookRecord = sequelize.define(
  'CookRecord',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    pairId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'pair_id'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id'
    },
    recordDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'record_date'
    }
  },
  {
    tableName: 'cook_records',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['pair_id'] },
      { fields: ['user_id'] },
      { fields: ['record_date'] },
      { fields: ['pair_id', 'record_date'] }
    ]
  }
);

export default CookRecord;
