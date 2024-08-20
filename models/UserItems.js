module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "user_item",
    {
      user_id: DataTypes.STRING,
      item_id: DataTypes.INTEGER,
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        default: 0,
      },
      last_collected: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: false,
    }
  );
};
