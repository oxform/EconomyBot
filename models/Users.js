module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "users",
    {
      user_id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      balance: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      bank_balance: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      accumulated_interest: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      last_daily: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_crime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_rob: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_work: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_heist: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_heisted: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: false,
    }
  );
};
