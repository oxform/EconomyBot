module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("users", "bank_balance", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("users", "bank_balance");
  },
};
