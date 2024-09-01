const Sequelize = require("sequelize");
const { Users } = require("./dbObjects.js");

const sequelize = new Sequelize("database", "username", "password", {
  host: "localhost",
  dialect: "sqlite",
  logging: false,
  storage: "database.sqlite",
});

async function addColumn(table, columnName, dataType) {
  try {
    await sequelize.getQueryInterface().addColumn(table, columnName, dataType);
    console.log(`Added ${columnName} to ${table} table`);
  } catch (error) {
    if (
      error.name === "SequelizeDatabaseError" &&
      error.message.includes("already exists")
    ) {
      console.log(`Column ${columnName} already exists in ${table} table`);
    } else {
      throw error;
    }
  }
}

async function migrate() {
  try {
    // await addColumn("users", "last_daily", {
    //   type: Sequelize.DATE,
    //   allowNull: true,
    // });
    // await addColumn("users", "last_crime", {
    //   type: Sequelize.DATE,
    //   allowNull: true,
    // });
    // await addColumn("users", "last_rob", {
    //   type: Sequelize.DATE,
    //   allowNull: true,
    // });
    // await addColumn("users", "last_work", {
    //   type: Sequelize.DATE,
    //   allowNull: true,
    // });
    await addColumn("users", "last_heisted", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Error during migration:", error);
  } finally {
    await sequelize.close();
  }
}

migrate();
