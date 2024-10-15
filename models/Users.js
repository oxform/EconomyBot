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
      prestige_tokens: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      prestige_tokens_used: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      prestige_upgrades: {
        type: DataTypes.TEXT,
        defaultValue: "{}",
        allowNull: false,
        get() {
          return JSON.parse(this.getDataValue("prestige_upgrades"));
        },
        set(value) {
          this.setDataValue("prestige_upgrades", JSON.stringify(value));
        },
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
