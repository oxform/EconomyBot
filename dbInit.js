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
    const printers = [
      { name: "Bronze Printer", cost: 2500, base_rate: 1 },
      { name: "Silver Printer", cost: 10000, base_rate: 3 },
      { name: "Gold Printer", cost: 25000, base_rate: 6 },
      { name: "Platinum Printer", cost: 75000, base_rate: 15 },
      { name: "Titanium Printer", cost: 125000, base_rate: 25 },
      { name: "Diamond Printer", cost: 250000, base_rate: 40 },
      { name: "Quantum Printer", cost: 500000, base_rate: 100 },
      { name: "Neutronium Printer", cost: 1000000, base_rate: 250 },
    ];

    const upgradeTypes = [
      {
        name: "Output Improver",
        base_effect: 0.3,
        effect_increase: 0.1,
        max_level: 5,
      },
      {
        name: "Speed Enhancer",
        base_effect: 0.25,
        effect_increase: 0.05,
        max_level: 5,
      },
      {
        name: "Capacity Expansion",
        base_effect: 0.4,
        effect_increase: 0.1,
        max_level: 5,
      },
    ];

    const shop = [];

    // Add printers
    for (const printer of printers) {
      shop.push(CurrencyShop.upsert(printer));
    }

    // Add printer-specific upgrades
    for (const printer of printers) {
      for (const upgradeType of upgradeTypes) {
        const upgradeName = `${printer.name} ${upgradeType.name}`;
        const upgradeData = {
          name: upgradeName,
          cost: Math.round(printer.cost * 0.15), // 20% of printer cost
          type: "upgrade",
          applies_to: printer.name,
          upgrade_type: upgradeType.name.split(" ")[0].toLowerCase(),
          max_level: upgradeType.max_level,
          base_effect: upgradeType.base_effect,
          effect_increase: upgradeType.effect_increase,
          description: `Improves the ${upgradeType.name.toLowerCase()} of your ${
            printer.name
          }.`,
        };
        shop.push(CurrencyShop.upsert(upgradeData));
      }

      // Add these upgrade items to your shop
      const heistUpgrades = [
        {
          name: "Wire Cutter",
          cost: 10000,
          type: "upgrade",
          upgrade_type: HEIST_UPGRADES.WIRE_REDUCTION,
          max_level: 3,
        },
        {
          name: "Insider Info",
          cost: 25000,
          type: "upgrade",
          upgrade_type: HEIST_UPGRADES.STEAL_INCREASE,
          max_level: 4,
        },
        {
          name: "Stealth Tech",
          cost: 50000,
          type: "upgrade",
          upgrade_type: HEIST_UPGRADES.COOLDOWN_REDUCTION,
          max_level: 3,
        },
      ];

      // Add this to your dbInit.js to create the new upgrade items
      for (const upgrade of heistUpgrades) {
        shop.push(CurrencyShop.upsert(upgrade));
      }
    }

    await Promise.all(shop);
    console.log("Database synced");

    sequelize.close();
  })
  .catch(console.error);

const HEIST_UPGRADES = {
  WIRE_REDUCTION: "wire_reduction",
  STEAL_INCREASE: "steal_increase",
  COOLDOWN_REDUCTION: "cooldown_reduction",
};
