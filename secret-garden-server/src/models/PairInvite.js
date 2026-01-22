import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PairInvite = sequelize.define(
  'PairInvite',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    inviterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'inviter_id'
    },
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'expired', 'canceled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    acceptedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'accepted_by'
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'accepted_at'
    }
  },
  {
    tableName: 'pair_invites',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['inviter_id'] },
      { fields: ['status'] },
      { fields: ['expires_at'] }
    ]
  }
);

export default PairInvite;
