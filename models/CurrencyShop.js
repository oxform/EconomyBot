module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "currency_shop",
    {
      name: {
        type: DataTypes.STRING,
        unique: true,
      },
      cost: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM("printer", "upgrade"),
        allowNull: false,
        defaultValue: "printer",
      },
      applies_to: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      upgrade_type: {
        type: DataTypes.ENUM("speed", "output", "capacity"),
        allowNull: true,
      },
      base_effect: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      effect_increase: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      max_level: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      timestamps: false,
    }
  );
};
