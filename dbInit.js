const Sequelize = require("sequelize");

/*
 * Make sure you are on at least version 5 of Sequelize! Version 4 as used in this guide will pose a security threat.
 * You can read more about this issue on the [Sequelize issue tracker](https://github.com/sequelize/sequelize/issues/7310).
 */

const sequelize = new Sequelize("database", "username", "password", {
  host: "localhost",
  dialect: "sqlite",
  logging: false,
  storage: "database.sqlite",
});

const CurrencyShop = require("./models/CurrencyShop.js")(
  sequelize,
  Sequelize.DataTypes
);

require("./models/Users.js")(sequelize, Sequelize.DataTypes);
require("./models/UserItems.js")(sequelize, Sequelize.DataTypes);

const force = process.argv.includes("--force") || process.argv.includes("-f");

sequelize
  .sync({ force })
  .then(async () => {
    const shop = [
      CurrencyShop.upsert({ name: "Bronze Printer", cost: 2500 }),
      CurrencyShop.upsert({ name: "Silver Printer", cost: 7500 }),
      CurrencyShop.upsert({ name: "Gold Printer", cost: 18000 }),
      CurrencyShop.upsert({ name: "Platinum Printer", cost: 45000 }),
      CurrencyShop.upsert({ name: "Diamond Printer", cost: 125000 }),
      CurrencyShop.upsert({ name: "Quantum Printer", cost: 300000 }),
    ];

    await Promise.all(shop);
    console.log("Database synced");

    sequelize.close();
  })
  .catch(console.error);
