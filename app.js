const { Op } = require("sequelize");
const {
  Client,
  Collection,
  Events,
  Formatters,
  ButtonBuilder,
  ActionRowBuilder,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");
const { Users, CurrencyShop, UserItems } = require("./dbObjects.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});
const { PermissionsBitField } = require("discord.js");
const fs = require("fs");
require("dotenv").config();
const { LETTER_COMBINATIONS } = require("./utils.js");

const bankAccounts = new Collection();

const coinflipStats = new Map();
const hoboCooldowns = new Map();
const blackjackStats = new Map();
const dailyTransferLimits = new Map();
const activeBlackjackPlayers = new Set();
const wordWagerGames = new Map();

const GAME_DURATION = 10000; // 10 seconds
const DICTIONARY_PATH = "./dictionary.txt";
let DICTIONARY;

// Load the dictionary
fs.readFile(DICTIONARY_PATH, "utf8", (err, data) => {
  if (err) {
    console.error("Error loading dictionary:", err);
    process.exit(1);
  }
  DICTIONARY = new Set(
    data.split("\n").map((word) => word.trim().toUpperCase())
  );
  console.log(`Dictionary loaded with ${DICTIONARY.size} words`);
});

// Constants for the game
const TICK_RATE = 500; // 1 second between each tick

// Store active games
const activeGames = new Map();

const DAILY_TRANSFER_LIMIT = 5000;

function updateHoboCooldown(userId) {
  const now = Date.now();
  const cooldownAmount = 15 * 60 * 1000; // 15 minutes in milliseconds

  if (hoboCooldowns.has(userId)) {
    const expirationTime = hoboCooldowns.get(userId) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000 / 60; // Convert to minutes
      return Math.round(timeLeft);
    }
  }

  hoboCooldowns.set(userId, now);
  return 0;
}

const allPrinters = [
  "Bronze Printer",
  "Silver Printer",
  "Gold Printer",
  "Platinum Printer",
  "Diamond Printer",
  "Quantum Printer",
  "Neutronium Printer",
];

async function handleDaily(message) {
  const combinedId = createCombinedId(message.author.id, message.guild.id);
  const user = await Users.findOne({ where: { user_id: combinedId } });
  const now = new Date();
  const cooldownAmount = 16 * 60 * 60 * 1000; // 16 hours in milliseconds
  const baseAmount = Math.floor(Math.random() * (500 - 100 + 1)) + 850;
  const dailyAmount = await applyIncomeBoostPassive(combinedId, baseAmount);

  if (user.last_daily && now - user.last_daily < cooldownAmount) {
    const timeLeft = (user.last_daily.getTime() + cooldownAmount - now) / 1000;
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);

    const embed = new EmbedBuilder()
      .setColor("#ff9900")
      .setTitle("Daily Reward - Not Ready")
      .setDescription(`You've already claimed your daily reward.`)
      .addFields({
        name: "Time Remaining",
        value: `${hours}h ${minutes}m`,
        inline: true,
      })
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();

    const sentMessage = await message.reply({ embeds: [embed] });

    setTimeout(() => {
      sentMessage.delete().catch(console.error);
    }, 5000);

    return;
  }

  await addBalance(combinedId, dailyAmount);
  await Users.update({ last_daily: now }, { where: { user_id: combinedId } });

  const newBalance = await getBalance(combinedId);

  const embed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("Daily Reward Claimed!")
    .setDescription(`You've received your daily reward of 🪙${dailyAmount}`)
    .addFields(
      {
        name: "New Balance",
        value: `🪙${newBalance.toLocaleString()}`,
        inline: true,
      },
      { name: "Next Claim", value: "Available in 16 hours", inline: true }
    )
    .setFooter({ text: "Azus Bot" })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

async function handleCoinflip(message, args) {
  try {
    const userId = createCombinedId(message.author.id, message.guild.id);
    let bet;

    const balance = await getBalance(userId);
    const minimumBet = 200;

    if (args[0]?.toLowerCase() === "all") {
      bet = balance;
    } else {
      bet = parseInt(args[0]);
    }

    if (isNaN(bet) || bet < minimumBet) {
      return message.reply(
        `Please specify a valid bet amount of at least 🪙${minimumBet}, or use 'all' to bet your entire balance.`
      );
    }

    if (balance < bet) {
      return message.reply(
        `You don't have enough money. Your balance: 🪙${balance}`
      );
    }

    await playCoinflip(message, userId, bet);
  } catch (error) {
    console.error("Error in handleCoinflip:", error);
    throw error; // Re-throw the error so it can be caught in the command handler
  }
}
async function updateCrimeCooldown(userId) {
  const user = await Users.findOne({ where: { user_id: userId } });
  const now = new Date();
  const cooldownAmount = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

  if (user.last_crime) {
    const expirationTime = user.last_crime.getTime() + cooldownAmount;

    if (now.getTime() < expirationTime) {
      const timeLeft = (expirationTime - now.getTime()) / 1000 / 60; // Convert to minutes
      return Math.round(timeLeft);
    }
  }

  await Users.update({ last_crime: now }, { where: { user_id: userId } });
  return 0;
}

async function updateRobCooldown(userId) {
  const user = await Users.findOne({ where: { user_id: userId } });
  const now = new Date();
  const cooldownAmount = 6 * 60 * 60 * 1000; // 3 hours in milliseconds

  if (user.last_rob) {
    const expirationTime = user.last_rob.getTime() + cooldownAmount;

    if (now.getTime() < expirationTime) {
      const timeLeft = (expirationTime - now.getTime()) / 1000 / 60 / 60; // Convert to hours
      return Math.round(timeLeft * 10) / 10; // Round to 1 decimal place
    }
  }

  await Users.update({ last_rob: now }, { where: { user_id: userId } });
  return 0;
}

async function rob(robberId, targetId) {
  const target = await getFullBalance(targetId);
  const robber = await getFullBalance(robberId);

  const robberTotal = Math.max(robber.wallet + robber.bank, 0);
  const targetTotal = Math.max(target.wallet + target.bank, 0);

  // Adjust success chance based on wealth difference
  const wealthRatio = (targetTotal + 1) / (robberTotal + 1); // Adding 1 to avoid division by zero
  const baseSuccessChance = 0.75;
  let adjustedSuccessChance = baseSuccessChance * Math.sqrt(wealthRatio);

  // Cap the success chance
  adjustedSuccessChance = Math.max(0.4, Math.min(adjustedSuccessChance, 0.95));
  console.log("Adjusted success chance:", adjustedSuccessChance);

  if (Math.random() < adjustedSuccessChance) {
    const minAmount = target.wallet * 0.15;
    const maxAmount = target.wallet * 0.4;
    let stolenAmount = Math.random() * (maxAmount - minAmount + 1) + minAmount;
    stolenAmount = Math.floor(stolenAmount);

    await addBalance(robberId, stolenAmount);
    await addBalance(targetId, -stolenAmount);
    return {
      success: true,
      amount: stolenAmount,
      message: `You successfully robbed 🪙 ${stolenAmount}!`,
    };
  } else {
    let penalty;
    if (robberTotal > targetTotal) {
      // Richer robber loses more when failing
      const penaltyRatio = Math.min(robberTotal / targetTotal, 10); // Cap at 10x
      penalty = Math.floor(robber.wallet * 0.1 * penaltyRatio);
    } else {
      // Standard penalty for poorer or equal robbers
      penalty = 0;
    }

    if (penalty > 0) {
      await addBalance(robberId, -penalty);

      return {
        success: false,
        amount: penalty,
        message: `You were caught and fined 🪙 ${penalty}!`,
      };
    }

    return {
      success: false,
      message: "You were caught but you escaped without losing any money!",
    };
  }
}

async function updateWorkCooldown(userId) {
  const user = await Users.findOne({ where: { user_id: userId } });
  const now = new Date();
  const cooldownAmount = 60 * 60 * 1000; // 1 hour in milliseconds

  if (user.last_work) {
    const expirationTime = user.last_work.getTime() + cooldownAmount;

    if (now.getTime() < expirationTime) {
      const timeLeft = (expirationTime - now.getTime()) / 1000 / 60; // Convert to minutes
      return Math.round(timeLeft);
    }
  }

  await Users.update({ last_work: now }, { where: { user_id: userId } });
  return 0;
}
async function initializeBankAccounts() {
  const storedAccounts = await Users.findAll({
    where: { bank_balance: { [Op.gt]: 0 } },
  });
  storedAccounts.forEach((account) => {
    bankAccounts.set(account.user_id, {
      balance: account.balance,
      bank_balance: account.bank_balance || 0,
      lastInterest: Date.now(),
      accumulatedInterest: 0,
    });
  });
}

const userLastChannel = new Map();

// Deposit money into bank
async function deposit(userId, amount) {
  const balance = await getBalance(userId);
  if (balance < amount) {
    throw new Error(
      `Insufficient funds. Your current wallet balance is 🪙${balance}.`
    );
  }

  let account = bankAccounts.get(userId);
  if (!account) {
    account = {
      balance: 0,
      bank_balance: 0,
      lastInterest: Date.now(),
      accumulatedInterest: 0,
    };
  }

  account.bank_balance += amount;
  await addBalance(userId, -amount);

  bankAccounts.set(userId, account);

  // Update database
  await Users.update(
    { bank_balance: account.bank_balance, balance: account.balance },
    { where: { user_id: userId } }
  );

  return {
    newBankBalance: account.bank_balance,
    newWalletBalance: account.balance,
  };
}
// Withdraw money from bank
async function withdraw(userId, amount) {
  let account = bankAccounts.get(userId);
  if (!account || account.bank_balance < amount)
    return "You don't have enough money in your bank account.";

  account.bank_balance -= amount;

  await addBalance(userId, amount);

  const newWalletBalance = await getBalance(userId);
  account.balance = newWalletBalance;
  bankAccounts.set(userId, account);

  // Update database
  await Users.update(
    { bank_balance: account.bank_balance, balance: account.balance },
    { where: { user_id: userId } }
  );

  return {
    newBankBalance: account.bank_balance,
    newWalletBalance: newWalletBalance,
  };
}

async function calculateInterest(userId) {
  const account = bankAccounts.get(userId);
  if (!account) return null;

  const fullBalance = await getFullBalance(userId);
  const userLevel = await calculateLevel(userId);

  const interestPeriodHours = 1;
  let interestRate = 0.5; // Base rate: 0.5% per hour

  if (userLevel >= 25) {
    interestRate = 1.5;
  }

  const prestigeUpgrades = await getUserPrestigeUpgradesFromId(userId);
  const interestBoostLevel = prestigeUpgrades.interest_rate || 0;
  interestRate += 5 * interestBoostLevel; // 5% increase per level

  const user = await Users.findOne({ where: { user_id: userId } });
  const now = Date.now();

  // Handle lastInterestTime more carefully
  let lastInterestTime;
  if (user.last_interest_collected instanceof Date) {
    lastInterestTime = user.last_interest_collected.getTime();
  } else if (typeof user.last_interest_collected === "number") {
    lastInterestTime = user.last_interest_collected;
  } else {
    // If it's neither a Date nor a number, set it to now
    lastInterestTime = now;
    await Users.update(
      { last_interest_collected: new Date(now) },
      { where: { user_id: userId } }
    );
  }

  const hoursPassed = (now - lastInterestTime) / (1000 * 60 * 60);
  const periodsPassed = Math.floor(hoursPassed / interestPeriodHours);

  let newInterest = 0;
  let totalAccumulatedInterest = fullBalance.accumulatedInterest || 0;

  if (periodsPassed > 0) {
    newInterest = Math.floor(
      (account.bank_balance || 0) * (interestRate / 100) * periodsPassed
    );

    totalAccumulatedInterest += newInterest;

    // Update database
    // Only update the last_interest_collected time for the completed periods
    const newLastInterestTime =
      lastInterestTime + periodsPassed * interestPeriodHours * 60 * 60 * 1000;
    await Users.update(
      {
        accumulated_interest: totalAccumulatedInterest,
        last_interest_collected: new Date(newLastInterestTime),
      },
      { where: { user_id: userId } }
    );

    // Update the lastInterestTime for the next calculation
    lastInterestTime = newLastInterestTime;
  }

  const nextInterestTime =
    lastInterestTime + interestPeriodHours * 60 * 60 * 1000;
  const minutesRemaining = Math.max(
    0,
    Math.floor((nextInterestTime - now) / (1000 * 60))
  );

  return {
    accumulatedInterest: totalAccumulatedInterest,
    interestRate: interestRate,
    nextInterestTime,
    minutesRemaining,
  };
}
async function addBalance(id, amount) {
  const user = bankAccounts.get(id);
  if (user) {
    user.balance += Math.floor(Number(amount));

    // Update database
    await Users.update(
      { balance: Math.floor(user.balance) },
      { where: { user_id: id } }
    );

    return user;
  }
  return null;
}

async function addBankBalance(id, amount) {
  const user = bankAccounts.get(id);
  if (user) {
    user.bank_balance += Math.floor(Number(amount));

    // Update database
    await Users.update(
      { bank_balance: Math.floor(user.bank_balance) },
      { where: { user_id: id } }
    );

    return user;
  }

  return null;
}

async function createUserIfNotExists(id) {
  let user = bankAccounts.get(id);
  if (!user) {
    user = await Users.create({
      user_id: id,
      balance: 0,
      bank_balance: 0,
    });

    bankAccounts.set(id, {
      balance: user.balance || 0,
      bank_balance: user.bank_balance || 0,
      lastInterest: Date.now(),
      accumulatedInterest: user.accumulated_interest,
    });
  }

  return user;
}

async function getFullBalance(userId) {
  const [user] = await Users.findOrCreate({
    where: { user_id: userId },
    defaults: {
      balance: 0,
      bank_balance: 0,
      accumulated_interest: 0,
      prestige_tokens: 0,
    },
  });

  return {
    wallet: user.balance || 0,
    bank: user.bank_balance || 0,
    accumulatedInterest: user.accumulated_interest,
    prestigeTokens: user.prestige_tokens || 0,
  };
}

async function getBalance(userId) {
  const user = bankAccounts.get(userId);
  return user ? Math.floor(user.balance) : 0;
}

async function getBankBalance(userId) {
  const user = bankAccounts.get(userId);
  return user ? user.bank_balance : 0;
}

initializeBankAccounts();

function login() {
  client
    .login(process.env.DISCORD_TOKEN)
    .then(() => console.log("Bot logged in successfully"))
    .catch((error) => {
      console.error("Failed to log in:", error);
      console.log("Attempting to reconnect in 30 seconds...");
      setTimeout(login, 30000);
    });
}

login();

let timeStarted;

client.once(Events.ClientReady, async () => {
  console.log("Ready!");
  const storedBalances = await Users.findAll();

  timeStarted = Date.now();

  for (const b of storedBalances) {
    try {
      // Extract the original Discord user ID from the combined ID
      const originalUserId = b.user_id.split("-")[0];
      const user = await client.users.fetch(originalUserId);
      bankAccounts.set(b.user_id, {
        balance: b.balance,
        bank_balance: b.bank_balance || 0,
        user_name: user.username,
      });
    } catch (error) {
      console.error(`Failed to fetch user ${b.user_id}:`, error);
      bankAccounts.set(b.user_id, {
        balance: b.balance,
        bank_balance: b.bank_balance || 0,
        user_name: "Unknown User",
      });
    }
  }

  console.log("bankAccounts", bankAccounts);
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const combinedId = createCombinedId(message.author.id, message.guild.id);
  userLastChannel.set(combinedId, message.channel);

  await createUserIfNotExists(combinedId);

  if (commandName === "inventory") {
    const target = message.mentions.users.first() || message.author;
    const user = await Users.findOne({ where: { user_id: combinedId } });
    const items = await user.getItems();

    if (!items.length) return message.reply(`${target.username} has nothing!`);

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle(`${target.username}'s Inventory`)
      .setDescription(
        items.map((t) => `${t.amount}x ${t.item.name}`).join("\n")
      )
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  } else if (commandName === "shop") {
    const items = await CurrencyShop.findAll({
      where: {
        type: {
          [Op.or]: [null, { [Op.ne]: "upgrade" }],
        },
      },
    });
    const userItems = await UserItems.findAll({
      where: { user_id: combinedId },
      include: ["item"],
    });

    const itemList = await Promise.all(
      items.map(async (i) => {
        const userOwns = userItems.find((ui) => ui.item.id === i.id);
        const isPrinter = allPrinters.includes(i.name);
        const status = isPrinter && userOwns ? " (Owned)" : "";
        return `${i.name}: 🪙 ${i.cost.toLocaleString()}${status}`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor("#ff9900")
      .setTitle("Item Shop")
      .setDescription(itemList.join("\n"))
      .setFooter({ text: "Use !buy <item> to purchase" })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }
  if (commandName === "buy") {
    const itemInput = args.join(" ").toLowerCase();
    const user = await getFullBalance(combinedId);
    const oldLevel = await calculateLevel(combinedId);
    if (!itemInput) {
      return message.reply("Please specify a printer to buy.");
    }

    // Find all printer items that match the input (partial match)
    const matchingItems = await CurrencyShop.findAll({
      where: {
        name: {
          [Op.like]: `%${itemInput}%`,
        },
        type: "printer", // Assuming printers have a type field set to "printer"
      },
    });

    const item = matchingItems[0];

    if (!item) {
      return message.reply(
        `No printers match "${itemInput}". Please check the shop for available printers.`
      );
    }

    // Check if the user already owns this type of printer
    const existingPrinter = await UserItems.findOne({
      where: { user_id: combinedId, item_id: item.id },
    });

    if (existingPrinter) {
      return message.reply(
        `You already own a ${item.name}. You can only have one of each type of printer.`
      );
    }

    if (matchingItems.length === 0) {
      const allPrinters = await CurrencyShop.findAll({
        where: { type: "printer" },
      });
      const printerList = allPrinters.map((item) => item.name).join(", ");
      return message.reply(
        `No printers match "${itemInput}". Available printers: ${printerList}`
      );
    }

    if (matchingItems.length > 1) {
      const printerNames = matchingItems.map((item) => item.name).join(", ");
      return message.reply(
        `Multiple printers match "${itemInput}": ${printerNames}. Please be more specific.`
      );
    }

    const totalBalance = user.wallet + user.bank;
    if (item.cost > totalBalance) {
      return message.reply(
        `You currently have 🪙${totalBalance.toLocaleString()} in total, but the ${
          item.name
        } costs 🪙${item.cost.toLocaleString()}!`
      );
    }

    // Deduct the cost from balance first, then bank if needed
    let remainingCost = item.cost;
    if (user.wallet >= remainingCost) {
      await addBalance(combinedId, -remainingCost);
      remainingCost = 0;
    } else {
      await addBalance(combinedId, -user.wallet);
      remainingCost -= user.wallet;
    }

    if (remainingCost > 0) {
      await addBankBalance(combinedId, -remainingCost);
    }

    await UserItems.create({
      user_id: combinedId,
      item_id: item.id,
      amount: 1,
    });

    const newBalance = await getFullBalance(combinedId);

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("Purchase Successful!")
      .setDescription(`You've bought: ${item.name}`)
      .addFields(
        {
          name: "Cost",
          value: `🪙${item.cost.toLocaleString()}`,
          inline: true,
        },
        {
          name: "New Wallet Balance",
          value: `🪙${newBalance.wallet.toLocaleString()}`,
          inline: true,
        },
        {
          name: "New Bank Balance",
          value: `🪙${newBalance.bank.toLocaleString()}`,
          inline: true,
        }
      )
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();

    const newLevel = await calculateLevel(combinedId);
    await checkUnlockedPassives(combinedId, oldLevel, newLevel);
    return message.reply({ embeds: [embed] });
  }
  if (commandName === "leaderboard" || commandName === "lb") {
    const guildId = message.guild.id;
    const topUsers = await getTopUsers(guildId, true); // Default to net worth
    const embed = createLeaderboardEmbed(
      topUsers,
      true,
      message.guild.name,
      true
    );
    const row = createLeaderboardButtons(false, true);

    return message.reply({ embeds: [embed], components: [row] });
  } // Updated work command
  else if (commandName === "work") {
    const cooldownLeft = await updateWorkCooldown(combinedId);

    if (cooldownLeft > 0) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Work Cooldown")
        .setDescription(
          `You need to wait ${cooldownLeft} minutes before working again.`
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      const sentMessage = await message.reply({ embeds: [embed] });
      setTimeout(() => {
        sentMessage.delete().catch(console.error);
      }, 5000);
      return;
    }
    const baseAmount = Math.floor(Math.random() * (350 - 100 + 1)) + 350;
    const addAmount = await applyIncomeBoostPassive(combinedId, baseAmount);
    await addBalance(combinedId, addAmount);
    const newBalance = await getBalance(combinedId);
    const embed = new EmbedBuilder()
      .setColor("#00ffff")
      .setTitle("Work Complete!")
      .setDescription(`You've earned 🪙 ${addAmount}`)
      .addFields({
        name: "New Balance",
        value: `🪙 ${newBalance.toLocaleString()}`,
        inline: true,
      })
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  } else if (commandName === "crime") {
    const cooldownLeft = await updateCrimeCooldown(combinedId);

    if (cooldownLeft > 0) {
      const hours = Math.floor(cooldownLeft / 60);
      const minutes = cooldownLeft % 60;
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Crime Cooldown")
        .setDescription(
          `You need to wait ${hours} hours and ${minutes} minutes before committing another crime.`
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      const sentMessage = await message.reply({ embeds: [embed] });
      setTimeout(() => {
        sentMessage.delete().catch(console.error);
      }, 5000);
      return;
    }
    const successRate = Math.random();
    if (successRate < 0.8) {
      // 80% chance of success
      const baseAmount = Math.floor(Math.random() * 600) + 500; // Higher risk, higher reward
      const addAmount = await applyIncomeBoostPassive(combinedId, baseAmount);
      await addBalance(combinedId, addAmount);
      const newBalance = await getBalance(combinedId);
      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("Crime Successful!")
        .setDescription(`You've stolen 🪙 ${addAmount}`)
        .addFields({
          name: "New Balance",
          value: `🪙 ${newBalance.toLocaleString()}`,
          inline: true,
        })
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    } else {
      const loseAmount = Math.floor(Math.random() * 200) + 100;
      await addBalance(combinedId, -loseAmount);
      const newBalance = await getBalance(combinedId);
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Crime Failed!")
        .setDescription(`You were caught and fined 🪙 ${loseAmount}`)
        .addFields({
          name: "New Balance",
          value: `🪙 ${newBalance.toLocaleString()}`,
          inline: true,
        })
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }
  } else if (commandName === "deposit" || commandName === "dep") {
    const walletBalance = await getBalance(combinedId);
    let amount;

    if (args[0]?.toLowerCase() === "all") {
      amount = walletBalance;
    } else {
      amount = parseInt(args[0]);
    }

    // Explicit check for negative amounts
    if (amount < 0) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Invalid Deposit Amount")
        .setDescription("You cannot deposit a negative amount.")
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (isNaN(amount) || amount === 0) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Invalid Deposit Amount")
        .setDescription(
          "Please specify a valid amount to deposit or use 'all' to deposit your entire balance."
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (amount > walletBalance) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Insufficient Funds")
        .setDescription(
          `You don't have enough money in your wallet. Your current wallet balance is 🪙${walletBalance}.`
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    try {
      const response = await deposit(combinedId, amount);

      const embed = new EmbedBuilder()
        .setColor("#1abc9c")
        .setTitle("Bank Deposit")
        .setDescription(`Successfully deposited 🪙${amount}`)
        .addFields(
          {
            name: "New Bank Balance",
            value: `🪙${response.newBankBalance}`,
            inline: true,
          },
          {
            name: "New Wallet Balance",
            value: `🪙${response.newWalletBalance}`,
            inline: true,
          }
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Deposit error:", error);
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Deposit Error")
        .setDescription(
          "An unexpected error occurred while processing your deposit. Please try again later."
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      message.reply({ embeds: [embed] });
    }
  } else if (commandName === "withdraw" || commandName === "with") {
    let amount;
    const account = await getFullBalance(combinedId);

    if (!args.length) {
      return message.reply(
        "Please specify an amount to withdraw or use 'all' to withdraw everything."
      );
    }

    if (args[0].toLowerCase() === "all") {
      amount = account.bank;
    } else {
      amount = parseInt(args[0]);
    }

    if (isNaN(amount) || amount <= 0) {
      return message.reply(
        "Please specify a valid amount to withdraw or use 'all' to withdraw everything."
      );
    }

    if (amount > account.bank) {
      return message.reply(
        `You don't have enough money in your bank. Your current bank balance is 🪙${account.bank}.`
      );
    }

    try {
      const response = await withdraw(combinedId, amount);
      const embed = new EmbedBuilder()
        .setColor("#1abc9c")
        .setTitle("Bank Withdrawal")
        .setDescription(`Successfully withdrew 🪙${amount}`)
        .addFields(
          {
            name: "New Bank Balance",
            value: `🪙${response.newBankBalance}`,
            inline: true,
          },
          {
            name: "New Wallet Balance",
            value: `🪙${response.newWalletBalance}`,
            inline: true,
          }
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      message.reply({ embeds: [embed] });
    } catch (error) {
      message.reply(`Error: ${error.message}`);
    }
  }
  if (
    commandName === "bank" ||
    commandName === "balance" ||
    commandName === "bal"
  ) {
    try {
      const targetMember = message.mentions.members.first() || message.member;
      const targetUser = message.mentions.users.first() || message.author;
      const targetCombinedId = createCombinedId(
        targetUser.id,
        message.guild.id
      );
      const account = await getFullBalance(targetCombinedId);
      const interestInfo = await calculateInterest(targetCombinedId);
      const printers = await getUserPrinters(targetCombinedId);
      const printerMoney = await calculatePrinterMoney(printers);
      const netWorth = await calculateNetWorth(targetCombinedId);
      const level = await calculateLevel(targetCombinedId);
      const prestige = account.prestigeTokens || 0;
      const prestigeUpgrades = await getUserPrestigeUpgradesFromId(
        targetCombinedId
      );
      const passives = await getPassives(level, prestigeUpgrades);

      if (account && interestInfo) {
        const embed = new EmbedBuilder()
          .setColor("#3498db")
          .setTitle(
            `🏦 ${targetMember.displayName}'s Balance • Level ${level} 🥇 ${prestige}`
          )
          .addFields(
            {
              name: "Wallet",
              value: `🪙 ${account.wallet.toLocaleString()}`,
              inline: true,
            },
            {
              name: "Bank",
              value: `🪙 ${account.bank.toLocaleString()}`,
              inline: true,
            },
            {
              name: "Total",
              value: `🪙 ${(account.bank + account.wallet).toLocaleString()}`,
              inline: true,
            },
            {
              name: "Interest Rate",
              value: `${interestInfo.interestRate}% every hour`,
              inline: true,
            },
            {
              name: "Next Interest",
              value: `${interestInfo.minutesRemaining} minutes`,
              inline: true,
            },
            {
              name: "\u200b",
              value: "\u200b",
              inline: true,
            }
          )
          .setFooter({ text: `Net Worth • 🪙${netWorth.toLocaleString()}` });

        // Add Passive Bonuses section
        const unlockedPassives = passives.filter(
          (p) => p.unlocked && p.isPrestige
        );
        if (unlockedPassives.length > 0) {
          const passivesText = unlockedPassives
            .map((p) => {
              if (p.isPrestige) {
                return `${p.description}`;
              } else {
                return `• Level ${p.level}: ${p.description}`;
              }
            })
            .join("\n");

          embed.addFields({
            name: "Prestige Bonuses",
            value: passivesText || "No passive bonuses unlocked yet.",
            inline: false,
          });
        }

        if (printerMoney.printerDetails.length > 0) {
          const printerInfo = printerMoney.printerDetails.map((printer) => {
            const icon = getPrinterIcon(printer.name);
            const name = `${icon} ${printer.name}`;

            const formatBoost = (value, boost) => {
              return boost > 0 ? `${value} (+${boost}%)` : value;
            };

            return [
              `**${name}**`,
              `Generated: 🪙 ${printer.generated.toLocaleString()} / ${formatBoost(
                printer.capacity.toLocaleString(),
                printer.capacityBoost
              )}`,
              `Rate: 💰 ${formatBoost(
                printer.outputPerCycle.toLocaleString() + "/cycle",
                printer.outputBoost
              )}`,
              `Interval: ⏳ ${formatBoost(
                formatTime(printer.interval),
                printer.speedBoost
              )}`,
              "",
            ].join("\n");
          });

          // Alternate the printerInfo array between two columns
          const firstColumn = [];
          const secondColumn = [];

          // Sort printer info based on all printers
          const sortedPrinterInfo = [];
          allPrinters.forEach((printerName) => {
            const printer = printerInfo.find((p) => p.includes(printerName));
            if (printer) {
              sortedPrinterInfo.push(printer);
            }
          });

          sortedPrinterInfo.forEach((info, index) => {
            if (index % 2 === 0) {
              firstColumn.push(info);
            } else {
              secondColumn.push(info);
            }
          });

          embed.addFields(
            {
              name: "Money Printers",
              value: firstColumn.join("\n") || "No printers available",
              inline: true,
            },
            {
              name: "\u200b",
              value: secondColumn.join("\n") || "\u200b",
              inline: true,
            }
          );

          embed.addFields(
            {
              name: "Collectable Printer Money",
              value: `🪙 ${printerMoney.totalReady.toLocaleString()}`,
              inline: false,
            },
            {
              name: "Collectable Interest Money",
              value: `🪙 ${interestInfo.accumulatedInterest.toLocaleString()}`,
              inline: false,
            }
          );
        }

        const isOwnAccount = targetCombinedId === combinedId;

        if (isOwnAccount) {
          const collectPrintersButton = new ButtonBuilder()
            .setCustomId("collect_printers")
            .setLabel("Collect Printers")
            .setStyle(ButtonStyle.Success)
            .setDisabled(printerMoney.totalReady <= 0);

          const collectButton = new ButtonBuilder()
            .setCustomId("collect_interest")
            .setLabel("Collect Interest")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(interestInfo.accumulatedInterest <= 0);

          const viewPassivesButton = new ButtonBuilder()
            .setCustomId(`view_passives_${targetCombinedId}`)
            .setLabel("View Passives")
            .setStyle(ButtonStyle.Secondary);

          const viewPrestigeButton = new ButtonBuilder()
            .setCustomId(`open_prestige_shop`)
            .setLabel("View Prestige Shop")
            .setStyle(ButtonStyle.Secondary);

          const row = new ActionRowBuilder().addComponents(
            collectPrintersButton,
            collectButton,
            viewPassivesButton,
            viewPrestigeButton
          );

          message.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true,
          });
        } else {
          message.reply({ embeds: [embed], ephemeral: true });
        }
      } else {
        message.reply(
          `An error occurred while fetching the bank account information for ${targetUser.username}. They may not have an account yet.`
        );
      }
    } catch (error) {
      console.error("Error in balance command:", error);
      message.reply("An unexpected error occurred. Please try again later.");
    }
  } else if (commandName === "rob") {
    const target = message.mentions.users.first();
    if (!target) {
      return message.reply("You need to mention a user to rob!");
    }
    const targetCombinedId = createCombinedId(target.id, message.guild.id);

    if (targetCombinedId === combinedId) {
      return message.reply("You can't rob yourself!");
    }

    const targetNetWorth = await calculateNetWorth(targetCombinedId);
    const userNetWorth = await calculateNetWorth(combinedId);

    if (targetNetWorth > 5000000 && userNetWorth < 5000000) {
      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("🛡️ Rob Attempt Blocked")
        .setDescription("This user's wealth is too great to be targeted!")
        .addFields({
          name: "Target's Net Worth",
          value: `Over 🪙5,000,000`,
          inline: true,
        })
        .setFooter({
          text: "Tip: Try targeting someone with less than 5,000,000 net worth",
        })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const cooldownLeft = await updateRobCooldown(combinedId);

    const targetBalance = await getFullBalance(targetCombinedId);

    if (cooldownLeft > 0) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Rob Cooldown")
        .setDescription(
          `You need to wait ${cooldownLeft} hours before attempting another robbery.`
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (targetBalance.wallet <= 50) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("No Money to Rob")
        .setDescription(
          `You robbed an individual with no money, you absolute prick! Go sit in the corner and think about what you've done.`
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    try {
      const result = await rob(combinedId, targetCombinedId);
      const color = result.success ? "#00ff00" : "#ff0000";
      const title = result.success ? "Successful Robbery!" : "Failed Robbery!";

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(result.message)
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();

      if (result.amount) {
        embed.addFields({
          name: result.success ? "Stolen Amount" : "Fine",
          value: `🪙 ${result.amount}`,
          inline: true,
        });
      }

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Rob error:", error);
      message.reply(
        "An error occurred while processing the robbery. Please try again later."
      );
    }
  } else if (commandName === "blackjack" || commandName === "bj") {
    const balance = await getBalance(combinedId);
    let bet;

    const MINIMUM_BET = 100;

    if (args[0]?.toLowerCase() === "all") {
      bet = balance;
    } else {
      bet = parseInt(args[0]);
    }

    if (balance < MINIMUM_BET) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Insufficient Funds")
        .setDescription(`You need at least 🪙${MINIMUM_BET} to play blackjack.`)
        .addFields({
          name: "Your Balance",
          value: `🪙 ${balance}`,
          inline: true,
        })
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (isNaN(bet) || bet < MINIMUM_BET || bet > balance) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Invalid Bet")
        .setDescription(
          `Please specify a valid bet amount (minimum 🪙${MINIMUM_BET}) or use 'all' to bet your entire balance.`
        )
        .addFields({
          name: "Your Balance",
          value: `🪙 ${balance}`,
          inline: true,
        })
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    await playBlackjack(message, bet);
  }
  if (commandName === "cf" || commandName === "coinflip") {
    if (args.length === 0) {
      return message.reply("Please specify a bet amount or 'all'.");
    }
    try {
      await handleCoinflip(message, args);
    } catch (error) {
      console.error("Error in coinflip command:", error);
      message.reply(
        "An error occurred while processing your coinflip. Please try again later."
      );
    }
  } else if (commandName === "daily") {
    await handleDaily(message);
  } else if (commandName === "hobo") {
    const balance = await getFullBalance(combinedId);
    const totalBalance = balance.wallet + balance.bank;

    if (totalBalance > 100) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Not Broke Enough")
        .setDescription("You can only use the hobo command when you're broke!")
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      const sentMessage = await message.reply({ embeds: [embed] });
      setTimeout(() => {
        sentMessage.delete().catch(console.error);
      }, 5000);
      return;
    }

    const cooldownLeft = updateHoboCooldown(combinedId);

    if (cooldownLeft > 0) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Hobo Cooldown")
        .setDescription(
          `You need to wait ${cooldownLeft} minutes before begging again.`
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      const sentMessage = await message.reply({ embeds: [embed] });
      setTimeout(() => {
        sentMessage.delete().catch(console.error);
      }, 5000);
      return;
    }

    let earnedAmount;
    let description;
    const baseAmount = Math.floor(Math.random() * (250 - 50 + 1)) + 100;
    const amountToAdd = await applyIncomeBoostPassive(combinedId, baseAmount);

    if (totalBalance < 0) {
      const debtCleared = Math.abs(totalBalance * 0.15);
      earnedAmount = Math.floor(debtCleared + amountToAdd);
      await addBalance(combinedId, earnedAmount);
      description = `A kind stranger notices your dire situation and offers to help. They clear 🪙${earnedAmount} of your debt.`;
    } else {
      await addBalance(combinedId, amountToAdd);
      description = `You begged on the streets and earned 🪙${amountToAdd}`;
    }

    // Update cooldown only after successful execution
    updateHoboCooldown(combinedId);

    const newBalance = await getBalance(combinedId);

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("Hobo Begging")
      .setDescription(description)
      .addFields({
        name: "New Balance",
        value: `🪙${newBalance.toLocaleString()}`,
        inline: true,
      })
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  } else if (commandName === "transfer") {
    const recipient = message.mentions.users.first();

    if (!recipient) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Invalid Transfer")
        .setDescription("Please use the format: !transfer @user amount")
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const recipientCombinedId = createCombinedId(
      recipient.id,
      message.guild.id
    );

    if (!args[1]) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Invalid Transfer")
        .setDescription("Please specify an amount to transfer.")
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const amountArg = args[1].toLowerCase();

    if (!recipient) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Invalid Transfer")
        .setDescription("Please use the format: !transfer @user amount")
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (recipientCombinedId === combinedId) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Invalid Transfer")
        .setDescription("You can't transfer money to yourself!")
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    try {
      let amount;
      if (amountArg === "all") {
        amount = Math.min(await getBalance(combinedId), DAILY_TRANSFER_LIMIT);
      } else {
        amount = parseInt(amountArg);
        if (isNaN(amount) || amount <= 0) {
          throw new Error(
            "Invalid amount. Please specify a valid number or 'all'."
          );
        }
      }

      const result = await transferMoney(
        combinedId,
        recipientCombinedId,
        amount
      );

      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("Transfer Successful")
        .setDescription(
          `You've transferred 🪙${amount} to ${recipient.username}`
        )
        .addFields(
          {
            name: "Your New Balance",
            value: `🪙${result.newSenderBalance.toLocaleString()}`,
            inline: true,
          },
          {
            name: `${recipient.username}'s New Balance`,
            value: `🪙${result.newReceiverBalance.toLocaleString()}`,
            inline: true,
          },
          {
            name: "Remaining Daily Transfer Limit",
            value: `🪙${result.remainingDailyLimit.toLocaleString()}`,
            inline: false,
          }
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Transfer Failed")
        .setDescription(error.message)
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }
  } else if (commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("Azus Bot Commands")
      .setDescription("Here's a list of available commands.")
      .addFields(
        {
          name: "💰 Economy",
          value: [
            "`!balance` (or `!bal`) - Check your balance",
            "`!work` - Earn money by working",
            "`!crime` - Attempt a crime for money (risky)",
            "`!daily` - Collect your daily reward",
            "`!hobo` - Beg for money when you're broke",
          ].join("\n"),
        },
        {
          name: "🏦 Banking",
          value: [
            "`!deposit <amount>` - Deposit money into your bank",
            "`!withdraw <amount>` - Withdraw money from your bank",
            "`!transfer @user <amount>` - Transfer money to another user",
          ].join("\n"),
        },
        {
          name: "🎰 Gambling",
          value: [
            "`!blackjack <bet>` (or `!bj`) - Play a game of blackjack",
            "`!coinflip <bet>` (or `!cf`) - Flip a coin and bet on the outcome",
            "`!slots <bet>` - Play the slot machine",
            "`!slotspayout` - View the payout table for slots",
          ].join("\n"),
        },
        {
          name: "🛒 Shop & Inventory",
          value: [
            "`!shop` - View the item shop",
            "`!buy <item>` - Purchase an item from the shop",
            "`!inventory` - View your inventory",
            "`!upgrade <printer>` - Upgrade your printer for more money",
          ].join("\n"),
        },
        {
          name: "🦹 Heists & Robbery",
          value: [
            "`!rob @user` - Attempt to rob another user",
            "`!heist @user` - Attempt a heist on another user's bank",
            "`!upgrade heist` - Upgrade your heist equipment",
          ].join("\n"),
        },
        {
          name: "📊 Leaderboard",
          value: "`!leaderboard` (or `!lb`) - View the richest users",
        },
        {
          name: "🕒 Cooldowns",
          value: "`!cooldowns` (or `!cd`) - Check your activity cooldowns",
        }
      )
      .setFooter({
        text: "Azus Bot • Use !help <command> for more details on a specific command",
      })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  } else if (commandName === "slots") {
    try {
      await handleSlots(message, args);
    } catch (error) {
      console.error("Error in Slots command:", error);
      message.reply(
        "An error occurred while playing slots. Please try again later."
      );
    }
  } else if (commandName === "slotspayout") {
    await handleSlotsPayout(message);
  } else if (
    (commandName === "upgrade" || commandName === "up") &&
    args[0]?.toLowerCase() === "heist"
  ) {
    await handleHeistUpgrade(message, args);
  } else if (commandName === "upgrade" || commandName === "up") {
    let printerInput = args.join(" ").toLowerCase();

    if (!printerInput) {
      return message.reply("Usage: !upgrade [printer name]");
    }

    const user = await Users.findOne({ where: { user_id: combinedId } });

    // Get all printers the user owns
    const userPrinters = await UserItems.findAll({
      where: { user_id: combinedId },
      include: [
        {
          model: CurrencyShop,
          as: "item",
          where: { type: "printer" },
        },
      ],
    });

    // Find the printer that matches the input (partial match, accounting for "Printer" at the end)
    const matchedPrinter = userPrinters.find(
      (printer) =>
        printer.item.name.toLowerCase().includes(printerInput) ||
        printer.item.name
          .toLowerCase()
          .replace(" printer", "")
          .includes(printerInput)
    );

    if (!matchedPrinter) {
      const ownedPrinters = userPrinters.map((p) => p.item.name).join(", ");
      return message.reply(
        `You don't own a printer that matches "${printerInput}". Your printers: ${ownedPrinters}`
      );
    }

    const { embed, row } = await createUpgradeEmbed(matchedPrinter, user);

    return message.reply({ embeds: [embed], components: [row] });
  } else if (commandName === "heist") {
    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      return message.reply("Please mention a user to heist.");
    }
    const targetUserCombinedId = createCombinedId(
      targetUser.id,
      message.guild.id
    );
    if (targetUserCombinedId === combinedId) {
      return message.reply("You can't heist yourself!");
    }
    await handleHeist(message, targetUser);
  } else if (commandName === "cooldowns" || commandName === "cd") {
    await handleCooldowns(message);
  } else if (commandName === "prestige") {
    await handlePrestige(message);
  }
  if (message.content.startsWith("!challenge")) {
    const args = message.content.split(" ");
    const opponent = message.mentions.users.first();
    const wager = parseInt(args[2]);

    if (opponent && !isNaN(wager)) {
      const challengerCombinedId = createCombinedId(
        message.author.id,
        message.guild.id
      );
      const opponentCombinedId = createCombinedId(
        opponent.id,
        message.guild.id
      );

      // Check if challenger has enough balance
      const challengerBalance = await getBalance(challengerCombinedId);
      if (challengerBalance < wager) {
        return message.reply(
          `You don't have enough balance to make this wager. Your current balance: 🪙${challengerBalance}`
        );
      }

      const challengeEmbed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Word Wager Challenge!")
        .setDescription(
          `${message.author} has challenged ${opponent} to a Word Wager game for 🪙${wager}!`
        )
        .addFields(
          {
            name: "How to Play",
            value:
              "You'll be shown some letters, and you need to type a word that contains those letters in order. You cannot use words that have already been played!",
          },
          { name: "Wager", value: `🪙${wager}` }
        );

      const acceptButton = new ButtonBuilder()
        .setCustomId("accept_challenge")
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success);

      const declineButton = new ButtonBuilder()
        .setCustomId("decline_challenge")
        .setLabel("Decline")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(
        acceptButton,
        declineButton
      );

      const challengeMessage = await message.channel.send({
        embeds: [challengeEmbed],
        components: [row],
      });

      const filter = (i) => i.user.id === opponent.id;
      const collector = challengeMessage.createMessageComponentCollector({
        filter,
        time: 30000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "accept_challenge") {
          // Check if opponent has enough balance
          const opponentBalance = await getBalance(opponentCombinedId);
          if (opponentBalance < wager) {
            await i.update({
              content: `${opponent}, you don't have enough balance to accept this wager. Your current balance: 🪙${opponentBalance}`,
              components: [],
            });
            return;
          }

          await i.update({
            content: "Challenge accepted! Game starting...",
            components: [],
          });
          startWordWagerGame(
            message.channel,
            message.author,
            opponent,
            wager,
            challengerCombinedId,
            opponentCombinedId
          );
        } else if (i.customId === "decline_challenge") {
          await i.update({ content: "Challenge declined.", components: [] });
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          challengeMessage.edit({
            content: "Challenge timed out.",
            components: [],
          });
        }
      });
    } else {
      message.reply("Invalid command. Usage: !challenge @User amount");
    }
  } else if (commandName === "wipe") {
    // Check if the user has administrator permissions
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply("You do not have permission to use this command.");
    }

    const embed = new EmbedBuilder()
      .setColor("#FF0000")
      .setTitle("⚠️ Server Wipe Confirmation ⚠️")
      .setDescription(
        "Are you sure you want to wipe all user data for this server? This action cannot be undone!"
      )
      .setFooter({
        text: "This will delete all user balances, inventories, and progress.",
      });

    const confirmButton = new ButtonBuilder()
      .setCustomId("confirm_wipe")
      .setLabel("Confirm Wipe")
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId("cancel_wipe")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(
      confirmButton,
      cancelButton
    );

    const reply = await message.reply({ embeds: [embed], components: [row] });

    const filter = (i) => i.user.id === message.author.id;
    const collector = reply.createMessageComponentCollector({
      filter,
      time: 30000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "confirm_wipe") {
        await wipeServerData(message.guild.id);
        const successEmbed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle("Server Wipe Successful")
          .setDescription("All user data for this server has been wiped.")
          .setFooter({ text: "The economy has been reset." });

        await i.update({ embeds: [successEmbed], components: [] });
      } else if (i.customId === "cancel_wipe") {
        const cancelEmbed = new EmbedBuilder()
          .setColor("#0099FF")
          .setTitle("Server Wipe Cancelled")
          .setDescription(
            "The server wipe has been cancelled. No data was deleted."
          );

        await i.update({ embeds: [cancelEmbed], components: [] });
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor("#FF0000")
          .setTitle("Server Wipe Cancelled")
          .setDescription(
            "The server wipe request has timed out. No data was deleted."
          );

        reply.edit({ embeds: [timeoutEmbed], components: [] });
      }
    });
  } else if (
    commandName === "prestigeshop" ||
    commandName === "ps" ||
    commandName === "prestige shop"
  ) {
    try {
      const shopDisplay = await handlePrestigeShop(message);
      await message.reply(shopDisplay);
    } catch (error) {
      console.error("Error displaying prestige shop:", error);
      await message.reply(`An error occurred: ${error.message}`);
    }
  } else if (commandName === "rocketlaunch" || commandName === "rl") {
    const balance = await getBalance(combinedId);
    let betAmount;

    if (args[0]?.toLowerCase() === "all") {
      betAmount = balance;
    } else {
      betAmount = parseInt(args[0]);
    }

    if (isNaN(betAmount) || betAmount < MIN_BET) {
      return message.reply(
        `Please specify a valid bet amount (minimum 🪙${MIN_BET}).`
      );
    }

    const userId = createCombinedId(message.author.id, message.guild.id);
    const userBalance = await getBalance(userId);

    if (userBalance < betAmount) {
      return message.reply(
        `You don't have enough coins. Your balance: 🪙${userBalance}`
      );
    }

    // Deduct the bet amount from the user's balance
    await addBalance(combinedId, -betAmount);

    // Start the game using the new startRocketLaunch function
    const gameMessage = await startRocketLaunch(combinedId, betAmount, message);

    // Get the game object and set the message
    const game = activeGames.get(combinedId);
    game.message = gameMessage;

    // Start running the game
    runRocketLaunch(combinedId);
  }
});

const suits = ["♠", "♥", "♦", "♣"];
const values = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

function createDeck() {
  const singleDeck = suits.flatMap((suit) =>
    values.map((value) => ({ suit, value }))
  );
  return [
    ...singleDeck,
    ...singleDeck,
    ...singleDeck,
    ...singleDeck,
    ...singleDeck,
    ...singleDeck,
  ]; // Creates 3 decks
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function getCardValue(card) {
  if (["J", "Q", "K"].includes(card.value)) return 10;
  if (card.value === "A") return 11;
  return parseInt(card.value);
}

function calculateHandValue(hand) {
  let hardValue = 0;
  let softValue = 0;
  let aceCount = 0;

  for (const card of hand) {
    if (["J", "Q", "K"].includes(card.value)) {
      hardValue += 10;
      softValue += 10;
    } else if (card.value === "A") {
      aceCount++;
      hardValue += 1;
      softValue += 11;
    } else {
      const cardValue = parseInt(card.value);
      hardValue += cardValue;
      softValue += cardValue;
    }
  }

  // Adjust soft value if it's over 21
  while (softValue > 21 && aceCount > 0) {
    softValue -= 10;
    aceCount--;
  }

  const isSoft = softValue <= 21 && softValue > hardValue && hardValue <= 21;

  return {
    value: isSoft ? softValue : hardValue,
    isSoft: isSoft,
  };
}

function getHandValueString(handValue) {
  if (handValue.isSoft && handValue.value < 21) {
    return `${handValue.value - 10}/${handValue.value}`;
  }
  return handValue.value.toString();
}

function dealCard(deck) {
  return deck.pop();
}

function playDealer(deck, dealerHand) {
  while (calculateHandValue(dealerHand).value < 17) {
    dealerHand.push(dealCard(deck));
  }
}

function createCardEmoji(card) {
  const suitEmojis = { "♠": "♠️", "♥": "♥️", "♦": "♦️", "♣": "♣️" };
  return `${card.value}${suitEmojis[card.suit]}`;
}

function updateWinStreak(userId, totalPayout) {
  const won = totalPayout > 0;
  const tie = totalPayout === 0;

  const userStats = blackjackStats.get(userId) || {
    winStreak: 0,
    multiplier: 1,
  };

  if (won) {
    userStats.winStreak++;
    userStats.multiplier = Math.min(1 + userStats.winStreak * 0.05, 2); // Cap at 2x
  } else if (!tie) {
    userStats.winStreak = 0;
    userStats.multiplier = 1;
  }

  blackjackStats.set(userId, userStats);
}
function createGameEmbed(
  playerHand,
  dealerHand,
  deck,
  showDealerCard,
  userStats,
  bet
) {
  const playerHandValue = calculateHandValue(playerHand);
  const dealerHandValue = showDealerCard
    ? calculateHandValue(dealerHand)
    : { value: getCardValue(dealerHand[0]), isSoft: false };

  const playerValueString = getHandValueString(playerHandValue);
  const dealerValueString = showDealerCard
    ? getHandValueString(dealerHandValue)
    : dealerHandValue.value.toString();

  return new EmbedBuilder()
    .setColor("#2C2F33")
    .setTitle("Blackjack")
    .setDescription(
      "Hit - Take another card\nStand - End the game\nDouble Down - Double your bet and take one more card\nSplit - Split your hand if you have two cards of the same value"
    )
    .addFields(
      {
        name: "Your Hand",
        value:
          playerHand.map(createCardEmoji).join(" ") + ` (${playerValueString})`,
        inline: true,
      },
      {
        name: "Dealer Hand",
        value: showDealerCard
          ? dealerHand.map(createCardEmoji).join(" ") +
            ` (${dealerValueString})`
          : `${createCardEmoji(dealerHand[0])} 🂠 (${dealerValueString})`,
        inline: true,
      },
      { name: "\u200B", value: "\u200B" },
      { name: "Your Value", value: playerValueString, inline: true },
      { name: "Dealer Value", value: dealerValueString, inline: true },
      { name: "Bet", value: `🪙${bet}`, inline: true },
      {
        name: "Win Streak",
        value: userStats.winStreak.toString(),
        inline: true,
      },
      {
        name: "Multiplier",
        value:
          userStats.multiplier === 2
            ? userStats.multiplier + "x (Max)"
            : userStats.multiplier.toFixed(2) + "x",
        inline: true,
      }
    );
}
async function createFinalEmbed(
  results,
  dealerHand,
  userStats,
  totalPayout,
  initialBet,
  userId
) {
  activeBlackjackPlayers.delete(userId);
  const allPlayersBusted = results.every((result) => result.busted);
  let dealerHandValue;
  let dealerValueString;

  if (allPlayersBusted) {
    dealerHandValue = calculateHandValue([dealerHand[0]]);
    dealerValueString = getHandValueString(dealerHandValue);
  } else {
    dealerHandValue = calculateHandValue(dealerHand);
    dealerValueString = getHandValueString(dealerHandValue);
  }
  const newBalance = await getBalance(userId);

  let title = "Blackjack Result";
  let passiveTriggered = results.some((result) =>
    result.result.includes("Loss Prevented")
  );
  let description = "";
  if (results.some((result) => result.result.includes("Loss Prevented"))) {
    title = "Blackjack: Passive Triggered!";
    description =
      "Loss Prevention: 1% chance to nullify losses from gambling games activated.";
  }

  const embed = new EmbedBuilder()
    .setColor(
      totalPayout > 0 ? "#00ff00" : totalPayout < 0 ? "#ff0000" : "#ffff00"
    )
    .setTitle(passiveTriggered ? "Blackjack: Passive Triggered!" : title)
    .addFields({
      name: "Dealer Hand",
      value: allPlayersBusted
        ? `${createCardEmoji(dealerHand[0])} 🂠 (${dealerValueString})`
        : dealerHand.map(createCardEmoji).join(" ") + ` (${dealerValueString})`,
      inline: false,
    });

  if (passiveTriggered) {
    embed.setDescription(
      "Loss Prevention: 1% chance to nullify losses from gambling games activated."
    );
  }

  results.forEach((result, index) => {
    const playerHandValue = calculateHandValue(result.hand);
    const playerValueString = getHandValueString(playerHandValue);
    const handName =
      results.length > 1 ? `Your Hand ${index + 1}` : "Your Hand";
    embed.addFields(
      {
        name: `${handName}${result.doubledDown ? " (Doubled)" : ""}`,
        value:
          result.hand.map(createCardEmoji).join(" ") +
          ` (${playerValueString})`,
        inline: true,
      },
      { name: "Result", value: result.result, inline: true }
    );
    if (results.length > 1) {
      embed.addFields({
        name: "Payout",
        value: `🪙 ${Math.abs(result.payout).toLocaleString()}`,
        inline: true,
      });
    }
  });

  embed
    .addFields(
      // {
      //   name: "Initial Bet",
      //   value: `🪙 ${initialBet.toLocaleString()}`,
      //   inline: true,
      // },
      {
        name: "Total Payout",
        value: `🪙 ${totalPayout.toLocaleString()}`,
        inline: true,
      },
      {
        name: "New Balance",
        value: `🪙 ${newBalance.toLocaleString()}`,
        inline: true,
      },
      {
        name: "Win Streak",
        value: userStats.winStreak.toString(),
        inline: true,
      },
      {
        name: "Multiplier",
        value: userStats.multiplier.toFixed(2) + "x",
        inline: true,
      }
    )
    .setFooter({ text: "Azus Bot" })
    .setTimestamp();

  return embed;
}
function createActionRow(
  playerHand,
  bet,
  doubledDown = false,
  canSplit = true
) {
  const hitButton = new ButtonBuilder()
    .setCustomId("blackjack_hit")
    .setLabel("Hit")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(doubledDown);

  const standButton = new ButtonBuilder()
    .setCustomId("blackjack_stand")
    .setLabel("Stand")
    .setStyle(ButtonStyle.Success);

  const doubleButton = new ButtonBuilder()
    .setCustomId("blackjack_double")
    .setLabel("Double Down")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(playerHand.length !== 2 || doubledDown);

  const splitButton = new ButtonBuilder()
    .setCustomId("blackjack_split")
    .setLabel("Split")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(
      playerHand.length !== 2 ||
        !canSplit ||
        !canSplitHand(playerHand[0], playerHand[1]) ||
        doubledDown
    );

  return new ActionRowBuilder().addComponents(
    hitButton,
    standButton,
    doubleButton,
    splitButton
  );
}

function canSplitHand(card1, card2) {
  return card1.value === card2.value;
}

async function playBlackjack(message, initialBet) {
  const userId = createCombinedId(message.author.id, message.guild.id);

  // Check if the user is already playing blackjack
  if (activeBlackjackPlayers.has(userId)) {
    return message.reply(
      "You're already in a blackjack game. Finish that one first!"
    );
  }

  // Add the user to the active players set
  activeBlackjackPlayers.add(userId);
  const userStats = blackjackStats.get(userId) || {
    winStreak: 0,
    multiplier: 1,
  };
  const deck = createDeck();
  shuffleDeck(deck);

  let hands = [[dealCard(deck), dealCard(deck)]];
  const dealerHand = [dealCard(deck), dealCard(deck)];
  let bets = [initialBet];
  let currentHandIndex = 0;
  let doubledDown = [false];
  let splitCount = 0;

  // Check for player blackjack
  const initialHandValue = calculateHandValue(hands[0]);
  if (initialHandValue.value === 21) {
    const blackjackPayout = await applyGamblingIncomeBoost(
      userId,
      initialBet * 1.5 * userStats.multiplier
    );
    await addBalance(userId, Math.floor(blackjackPayout));
    updateWinStreak(userId, true);
    const finalEmbed = await createFinalEmbed(
      [
        {
          hand: hands[0],
          result: "Blackjack! You win big!",
          payout: blackjackPayout,
        },
      ],
      dealerHand,
      userStats,
      blackjackPayout,
      initialBet,
      userId
    );
    return message.reply({ embeds: [finalEmbed] });
  }

  const initialEmbed = createGameEmbed(
    hands[0],
    dealerHand,
    deck,
    false,
    userStats,
    initialBet
  );
  const row = createActionRow(hands[0], initialBet);

  const gameMessage = await message.reply({
    embeds: [initialEmbed],
    components: [row],
  });

  const guildId = message.guild.id;

  const filter = (i) => {
    const interactionUserId = `${i.user.id}-${guildId}`; // Create combined ID for the interaction
    return interactionUserId === userId && i.customId.startsWith("blackjack_");
  };
  const collector = gameMessage.createMessageComponentCollector({
    filter,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    switch (i.customId) {
      case "blackjack_hit":
        hands[currentHandIndex].push(dealCard(deck));
        if (calculateHandValue(hands[currentHandIndex]).value >= 21) {
          currentHandIndex++;
        }
        break;
      case "blackjack_stand":
        currentHandIndex++;
        break;
      case "blackjack_double":
        bets[currentHandIndex] *= 2;
        hands[currentHandIndex].push(dealCard(deck));
        doubledDown[currentHandIndex] = true;
        currentHandIndex++;
        break;
      case "blackjack_split":
        const newHand = [hands[currentHandIndex].pop()];
        hands[currentHandIndex].push(dealCard(deck));
        newHand.push(dealCard(deck));
        hands.splice(currentHandIndex + 1, 0, newHand);
        bets.splice(currentHandIndex + 1, 0, initialBet);
        doubledDown.splice(currentHandIndex + 1, 0, false);
        splitCount++;
        break;
    }

    if (currentHandIndex < hands.length) {
      const newEmbed = createGameEmbed(
        hands[currentHandIndex],
        dealerHand,
        deck,
        false,
        userStats,
        bets[currentHandIndex]
      );
      const newRow = createActionRow(
        hands[currentHandIndex],
        bets[currentHandIndex],
        doubledDown[currentHandIndex],
        splitCount < 3
      );
      await i.update({ embeds: [newEmbed], components: [newRow] });
    } else {
      collector.stop("end");
    }
  });

  collector.on("end", async (collected, reason) => {
    let results = [];
    let totalPayout = 0;

    for (let i = 0; i < hands.length; i++) {
      const playerValue = calculateHandValue(hands[i]).value;
      let result;
      let payout;

      if (playerValue > 21) {
        result = "You bust! You lose!";
        payout = -bets[i];
      } else {
        // Only play the dealer's hand if the player hasn't busted
        if (calculateHandValue(dealerHand).value < 18) {
          playDealer(deck, dealerHand);
        }
        const dealerValue = calculateHandValue(dealerHand).value;

        if (playerValue === 21 && hands[i].length === 2 && !doubledDown[i]) {
          result = "Blackjack! You win!";
          payout = bets[i] * 1.5;
        } else if (dealerValue > 21) {
          result = "Dealer busts! You win!";
          payout = bets[i];
        } else if (playerValue > dealerValue) {
          result = "You win!";
          payout = bets[i];
        } else if (playerValue < dealerValue) {
          result = "You lose!";
          payout = -bets[i];
        } else {
          result = "It's a tie!";
          payout = 0;
        }
      }

      if (payout > 0) {
        // Apply income boost to winnings
        payout = await applyGamblingIncomeBoost(
          userId,
          payout * userStats.multiplier
        );
      } else if (payout < 0 && (await applyGamblingPassive(userId))) {
        payout = 0;
        result += " (Loss Prevented)";
      }

      totalPayout += payout;
      results.push({
        hand: hands[i],
        result,
        payout,
        doubledDown: doubledDown[i],
        busted: playerValue > 21,
      });
    }

    await addBalance(userId, Math.floor(totalPayout));
    updateWinStreak(userId, totalPayout);

    const finalEmbed = await createFinalEmbed(
      results,
      dealerHand,
      userStats,
      totalPayout,
      initialBet,
      userId
    );

    await gameMessage.edit({ embeds: [finalEmbed], components: [] });
  });
}

client.on("interactionCreate", async (interaction) => {
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const combinedId = createCombinedId(userId, guildId);

  if (interaction.customId.startsWith("view_passives_")) {
    const targetCombinedId = interaction.customId.split("_")[2];
    const level = await calculateLevel(targetCombinedId);
    const prestigeUpgrades = await getUserPrestigeUpgradesFromId(
      targetCombinedId
    );
    const passives = await getPassives(level, prestigeUpgrades).then((x) =>
      x.filter((x) => !x.isPrestige)
    );

    const unlockedPassives = passives.filter((p) => p.unlocked);
    const lockedPassives = passives.filter((p) => !p.unlocked);

    let passivesText = "";
    if (unlockedPassives.length > 0) {
      passivesText += "**Unlocked Passives:**\n";
      passivesText += unlockedPassives
        .map((p) => `• Level ${p.level}: ${p.description}`)
        .join("\n");
    }
    if (lockedPassives.length > 0) {
      if (unlockedPassives.length > 0) passivesText += "\n\n";
      passivesText += "**Locked Passives:**\n";
      passivesText += lockedPassives
        .map((p) => `• Level ${p.level}: ${p.description}`)
        .join("\n");
    }

    const passivesEmbed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle(`Passives - Level ${level}`)
      .setDescription(passivesText || "No passives available")
      .setFooter({ text: "Keep leveling up to unlock more passives!" })
      .setTimestamp();

    await interaction.reply({ embeds: [passivesEmbed], ephemeral: true });
  } else if (interaction.customId.startsWith("view_prestige_")) {
    const targetCombinedId = interaction.customId.split("_")[2];
    const user = await Users.findOne({ where: { user_id: targetCombinedId } });

    if (!user) {
      return interaction.reply({ content: "User not found.", ephemeral: true });
    }

    const netWorth = await calculateNetWorth(targetCombinedId);

    const prestigeLevel = user.prestige_tokens;
    const currentBenefits = PRESTIGE_BENEFITS.filter(
      (benefit) => benefit.level <= prestigeLevel
    );
    const nextBenefit = PRESTIGE_BENEFITS.find(
      (benefit) => benefit.level > prestigeLevel
    );

    let prestigeText = `You are currently at Prestige Level ${prestigeLevel}.\n\n`;

    if (currentBenefits.length > 0) {
      prestigeText += "**Current Benefits:**\n";
      prestigeText += currentBenefits
        .map((benefit) => `• ${benefit.description}`)
        .join("\n");
    }

    if (nextBenefit) {
      prestigeText += `\n\n**Next Prestige Benefit (Level ${nextBenefit.level}):**\n`;
      prestigeText += `• ${nextBenefit.description}`;
    } else {
      prestigeText += "\n\nYou've reached the maximum prestige level!";
    }

    const canPrestige = netWorth >= PRESTIGE_THRESHOLD;

    let embedColor, embedTitle, embedDescription;

    if (canPrestige) {
      embedColor = "#00FF00";
      embedTitle = "Prestige Available";
      embedDescription = "You have reached the required net worth to prestige!";
    } else {
      embedColor = "#FF0000";
      embedTitle = "Prestige Not Available";
      embedDescription = `You need a net worth of 🪙${PRESTIGE_THRESHOLD.toLocaleString()} to prestige.`;
    }

    const prestigeEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(embedTitle)
      .setDescription(embedDescription)
      .addFields(
        {
          name: "Your Net Worth",
          value: `🪙${netWorth.toLocaleString()}`,
          inline: true,
        },
        {
          name: "Required Net Worth",
          value: `🪙${PRESTIGE_THRESHOLD.toLocaleString()}`,
          inline: true,
        },
        {
          name: "Current Prestige Level",
          value: user.prestige_tokens.toString(),
          inline: true,
        }
      )
      .setFooter({
        text: canPrestige
          ? "Ready to take the next step?"
          : "Keep growing your wealth!",
      })
      .setTimestamp();

    // Add information ab

    await interaction.reply({ embeds: [prestigeEmbed], ephemeral: true });
  } else if (
    interaction.customId === "leaderboard_net_worth" ||
    interaction.customId === "leaderboard_total_cash" ||
    interaction.customId === "leaderboard_prestige"
  ) {
    const showNetWorth = interaction.customId === "leaderboard_net_worth";
    const showPrestige = interaction.customId === "leaderboard_prestige";
    const guildId = interaction.guild.id;
    let topUsers = await getTopUsers(guildId, showNetWorth || showPrestige);

    if (showPrestige) {
      topUsers = topUsers.sort((a, b) => b.prestigeTokens - a.prestigeTokens);
    }

    const embed = createLeaderboardEmbed(
      topUsers,
      showNetWorth,
      interaction.guild.name,
      showPrestige
    );
    const row = createLeaderboardButtons(showNetWorth, showPrestige);

    return await interaction.update({ embeds: [embed], components: [row] });
  }
  if (interaction.customId === "cashout") {
    const userId = createCombinedId(interaction.user.id, interaction.guild.id);
    const game = activeGames.get(userId);

    if (!game || game.crashed || game.cashed_out) {
      return interaction.reply({
        content: "No active game or the game has already ended!",
        ephemeral: true,
      });
    }

    game.cashed_out = true;
    const totalPayout = Math.floor(game.betAmount * game.multiplier);
    const profit = totalPayout - game.betAmount;

    // Apply gambling income boost to the profit
    const boostedProfit = await applyGamblingIncomeBoost(userId, profit);
    const boostedTotalPayout = game.betAmount + boostedProfit;

    await addBalance(userId, boostedTotalPayout);

    const embed = await createRocketLaunchEmbed(game, true);
    const buttons = createRocketLaunchButtons(true);
    await game.message.edit({ embeds: [embed], components: [buttons] });
    activeGames.delete(userId);

    return interaction.reply({
      content: `You cashed out and received 🪙${boostedTotalPayout.toLocaleString()}!`,
      ephemeral: true,
    });
  }
  if (interaction.customId.startsWith("heist_upgrade_")) {
    const upgradeType = interaction.customId.split("_")[2];
    await performHeistUpgrade(interaction, upgradeType);
  }
  if (interaction.customId === "collect_printers") {
    try {
      const collectedAmount = await collectPrinterMoney(combinedId);
      const newBalance = await getBalance(combinedId);
      const updatedPrinterMoney = await calculatePrinterMoney(
        await getUserPrinters(combinedId)
      );

      // Update the original balance embed
      const balanceEmbed = EmbedBuilder.from(interaction.message.embeds[0]);

      // Update relevant fields in the balance embed
      updateBalanceEmbedFields(balanceEmbed, newBalance, updatedPrinterMoney);

      // Create a new embed for the collection notification
      const collectionEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("Printer Money Collected!")
        .setDescription(
          `${
            interaction.user
          } collected 🪙 ${collectedAmount.toLocaleString()} from their printers.`
        )
        .addFields({
          name: "New Balance",
          value: `🪙 ${newBalance.toLocaleString()}`,
          inline: true,
        })
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();

      // Update the buttons
      const row = ActionRowBuilder.from(interaction.message.components[0]);
      const collectPrintersButton = row.components.find(
        (c) => c.data.custom_id === "collect_printers"
      );
      if (collectPrintersButton) {
        collectPrintersButton.setDisabled(updatedPrinterMoney.totalReady <= 0);
      }

      // Update the original message with the updated balance embed
      await interaction.update({ embeds: [balanceEmbed], components: [row] });

      // Send the collection notification as a new message
      await interaction.followUp({ embeds: [collectionEmbed] });
    } catch (error) {
      console.error("Error collecting printer money:", error);
      await interaction.reply({
        content:
          "An error occurred while collecting printer money. Please try again later.",
      });
    }
  }

  if (interaction.customId === "collect_interest") {
    try {
      const account = await getFullBalance(combinedId);
      const interestInfo = await calculateInterest(combinedId);
      const collectedInterest = interestInfo.accumulatedInterest;

      if (collectedInterest > 0) {
        await addBalance(combinedId, Math.floor(collectedInterest));
        await Users.update(
          {
            accumulated_interest: 0,
          },
          { where: { user_id: combinedId } }
        );

        const newBalance = await getBalance(combinedId);

        // Update the original balance embed
        const balanceEmbed = EmbedBuilder.from(interaction.message.embeds[0]);

        // Update relevant fields in the balance embed
        updateBalanceEmbedFields(balanceEmbed, newBalance);

        // Remove the collectable interest field
        const interestFieldIndex = balanceEmbed.data.fields.findIndex(
          (field) => field.name === "Collectable Interest Money"
        );
        if (interestFieldIndex !== -1) {
          balanceEmbed.data.fields.splice(interestFieldIndex, 1);
        }

        // Create a new embed for the collection notification
        const collectionEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("Interest Collected!")
          .setDescription(
            `${
              interaction.user
            } collected 🪙 ${collectedInterest.toLocaleString()} in interest.`
          )
          .addFields({
            name: "New Balance",
            value: `🪙 ${newBalance.toLocaleString()}`,
            inline: true,
          })
          .setFooter({ text: "Azus Bot" })
          .setTimestamp();

        // Update the buttons
        const row = ActionRowBuilder.from(interaction.message.components[0]);
        const collectInterestButton = row.components.find(
          (c) => c.data.custom_id === "collect_interest"
        );
        if (collectInterestButton) {
          collectInterestButton.setDisabled(true);
        }

        // Update the original message with the updated balance embed
        await interaction.update({ embeds: [balanceEmbed], components: [row] });

        // Send the collection notification as a new message
        await interaction.followUp({ embeds: [collectionEmbed] });
      } else {
        await interaction.reply({
          content: "No interest available to collect right now.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error collecting interest:", error);
      await interaction.reply({
        content:
          "An error occurred while collecting interest. Please try again later.",
        ephemeral: true,
      });
    }
  }
  if (
    interaction.customId.startsWith("spin_slots_") ||
    interaction.customId.startsWith("play_again_")
  ) {
    const betAmount = parseInt(interaction.customId.split("_").pop());
    await playSlotsRound(interaction, betAmount);
  }
  if (interaction.customId.startsWith("coinflip_again_")) {
    const bet = parseInt(interaction.customId.split("_")[2]);
    const userId = combinedId;
    const balance = await getBalance(userId);

    if (balance < bet) {
      return await interaction.reply({
        content: `You don't have enough money to play again. Your balance: 🪙${balance}`,
        ephemeral: true,
      });
    }

    // Disable the button that was just clicked
    const disabledButton = ButtonBuilder.from(
      interaction.component
    ).setDisabled(true);
    const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
    await interaction.update({ components: [disabledRow] });

    // Start a new game
    await playCoinflip(interaction.message, userId, bet);
  }

  if (interaction.customId.startsWith("upgrade_")) {
    const [, printerId, upgradeType] = interaction.customId.split("_");

    const user = await Users.findOne({
      where: { user_id: combinedId },
    });
    const oldLevel = await calculateLevel(combinedId);
    const printer = await UserItems.findOne({
      where: { user_id: combinedId, item_id: printerId },
      include: ["item"],
    });

    const upgradeFieldMap = {
      speed: "speed_level",
      output: "output_level",
      capacity: "capacity_level",
    };

    const upgradeField = upgradeFieldMap[upgradeType];

    if (!upgradeField) {
      return interaction.reply({
        content: `Invalid upgrade type: ${upgradeType}`,
        ephemeral: true,
      });
    }

    const currentLevel = printer.dataValues[upgradeField];

    const upgrade = await CurrencyShop.findOne({
      where: {
        type: "upgrade",
        upgrade_type: upgradeType,
        applies_to: printer.item.name,
      },
    });

    if (!upgrade) {
      return interaction.reply({
        content: `No upgrade found for ${upgradeType}`,
        ephemeral: true,
      });
    }

    const nextLevel = currentLevel + 1;
    const upgradeCost = calculateUpgradeCost(upgrade.cost, nextLevel);

    if (currentLevel >= upgrade.max_level) {
      return interaction.reply({
        content: "This upgrade is already at max level.",
        ephemeral: true,
      });
    }

    if (user.bank_balance < upgradeCost) {
      return interaction.reply({
        content: "You don't have enough money for this upgrade.",
        ephemeral: true,
      });
    }

    // Perform the upgrade
    await UserItems.update(
      {
        [upgradeField]: nextLevel,
        total_upgrade_cost: printer.total_upgrade_cost + upgradeCost,
      },
      { where: { user_id: combinedId, item_id: printerId } }
    );
    await addBankBalance(combinedId, -upgradeCost);

    // Fetch the updated printer and user data
    const updatedPrinter = await UserItems.findOne({
      where: { user_id: combinedId, item_id: printerId },
      include: ["item"],
    });
    const updatedUser = await Users.findOne({
      where: { user_id: combinedId },
    });

    // Create an updated embed and buttons
    const { embed, row } = await createUpgradeEmbed(
      updatedPrinter,
      updatedUser
    );

    const newLevel = await calculateLevel(combinedId);
    await checkUnlockedPassives(combinedId, oldLevel, newLevel);
    // Update the message with the new embed and buttons
    return await interaction.update({ embeds: [embed], components: [row] });
  } else if (interaction.customId === "open_prestige_shop") {
    const shopDisplay = await handlePrestigeShop(interaction);
    await interaction.reply(shopDisplay);
  }
  try {
    if (
      interaction.isButton() &&
      interaction.customId === "prestige_upgrades"
    ) {
      const userId = createCombinedId(
        interaction.user.id,
        interaction.guild.id
      );
      const shopItems = await getPrestigeShopItems(userId);

      const select = new StringSelectMenuBuilder()
        .setCustomId("select_prestige_upgrade")
        .setPlaceholder("Choose an upgrade to purchase")
        .addOptions(
          shopItems.map((item) => ({
            label: item.name,
            description: `Cost: ${item.cost} token(s) - Level ${item.currentLevel}/${item.maxLevel}`,
            value: item.id,
            default: false,
          }))
        );

      const row = new ActionRowBuilder().addComponents(select);

      await interaction.reply({
        content: "Select an upgrade to purchase:",
        components: [row],
        ephemeral: true,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "select_prestige_upgrade"
    ) {
      const itemId = interaction.values[0];
      const userId = createCombinedId(
        interaction.user.id,
        interaction.guild.id
      );

      const result = await purchasePrestigeItem(userId, itemId);

      // Update the interaction with the purchase result
      await interaction.update({ content: result.message, components: [] });

      // Send a new message with the updated shop display
      const shopDisplay = await handlePrestigeShop(interaction);
      await interaction.followUp(shopDisplay);
    }
  } catch (error) {
    console.error("Error in prestige shop interaction:", error);

    // Check if the interaction has already been replied to
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: `An error occurred: ${error.message}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `An error occurred: ${error.message}`,
        ephemeral: true,
      });
    }
  }
});

async function calculatePrinterMoney(printers) {
  let totalReady = 0;
  const printerDetails = [];

  for (const printer of printers) {
    const baseRate = getPrinterBaseRate(printer.item.name);
    const userLevel = await calculateLevel(printer.user_id);
    const prestigeUpgrades = await getUserPrestigeUpgradesFromId(
      printer.user_id
    );

    // Calculate interval without passive boost
    const intervalWithoutPassive = calculateSpeedUpgrade(printer.speed_level);
    const interval = applyPrinterSpeedPassive(
      intervalWithoutPassive,
      userLevel
    );

    // Calculate output without any prestige boosts
    let outputPerCycle = calculateUpgradeEffect(
      baseRate,
      printer.output_level,
      {} // Empty object to exclude prestige upgrades
    );

    // Calculate capacity
    const capacityWithoutPassive = calculateCapacity(
      baseRate,
      printer.capacity_level,
      {}
    );
    let capacity = calculateCapacity(
      baseRate,
      printer.capacity_level,
      prestigeUpgrades
    );

    capacity = applyPrinterCapacityPassive(capacity, userLevel);

    const minutesSinceLastCollection =
      (Date.now() - printer.last_collected) / (1000 * 60);
    const cycles = Math.floor(minutesSinceLastCollection / interval);

    // Apply prestige upgrades to output
    const incomeBoostLevel = prestigeUpgrades.income_boost || 0;
    const printerEfficiencyLevel = prestigeUpgrades.printer_efficiency || 0;
    const incomeBoost = 1 + 0.1 * incomeBoostLevel; // 10% increase per level
    const efficiencyBoost = 1 + 0.2 * printerEfficiencyLevel; // 20% increase per level
    const boostedOutputPerCycle =
      outputPerCycle * incomeBoost * efficiencyBoost;

    let generatedAmount = boostedOutputPerCycle * cycles * printer.amount;

    const actualGenerated = Math.min(generatedAmount, capacity);

    // Calculate boosts
    const outputBoost = Math.round(
      (boostedOutputPerCycle / outputPerCycle - 1) * 100
    );
    const capacityBoost = Math.round(
      (capacity / capacityWithoutPassive - 1) * 100
    );
    const speedBoost = Math.round(
      (intervalWithoutPassive / interval - 1) * 100
    );

    printerDetails.push({
      name: printer.item.name,
      generated: Math.floor(actualGenerated),
      capacity: capacity,
      interval: interval,
      outputPerCycle: boostedOutputPerCycle.toFixed(1),
      outputBoost: outputBoost.toFixed(1),
      capacityBoost: capacityBoost,
      speedBoost: speedBoost,
      amount: printer.amount,
    });

    totalReady += actualGenerated;
  }

  // If totalReady is a number, Math.floor it
  if (!isNaN(totalReady)) {
    totalReady = Math.floor(totalReady);
  }

  return { totalReady, printerDetails };
}
async function collectPrinterMoney(userId) {
  const printers = await getUserPrinters(userId);
  let totalGenerated = 0;
  const userLevel = await calculateLevel(userId);
  const prestigeUpgrades = await getUserPrestigeUpgradesFromId(userId);

  for (const printer of printers) {
    const baseRate = getPrinterBaseRate(printer.item.name);

    const interval = applyPrinterSpeedPassive(
      calculateSpeedUpgrade(printer.speed_level),
      userLevel
    );

    // Calculate output without prestige boosts
    let outputPerCycle = calculateUpgradeEffect(
      baseRate,
      printer.output_level,
      {} // Empty object to exclude prestige upgrades
    );

    const capacity = applyPrinterCapacityPassive(
      calculateCapacity(baseRate, printer.capacity_level, prestigeUpgrades),
      userLevel
    );

    const minutesSinceLastCollection =
      (Date.now() - printer.last_collected) / (1000 * 60);
    const cycles = Math.floor(minutesSinceLastCollection / interval);

    // Apply prestige upgrades to output
    const incomeBoostLevel = prestigeUpgrades.income_boost || 0;
    const printerEfficiencyLevel = prestigeUpgrades.printer_efficiency || 0;
    const incomeBoost = 1 + 0.1 * incomeBoostLevel; // 10% increase per level
    const efficiencyBoost = 1 + 0.2 * printerEfficiencyLevel; // 20% increase per level
    const boostedOutputPerCycle =
      outputPerCycle * incomeBoost * efficiencyBoost;

    let generatedAmount = boostedOutputPerCycle * cycles * printer.amount;

    const actualGenerated = Math.min(generatedAmount, capacity);

    totalGenerated += actualGenerated;

    await UserItems.update(
      { last_collected: Date.now() },
      { where: { user_id: userId, item_id: printer.item_id } }
    );
  }

  totalGenerated = Math.floor(totalGenerated);

  await addBalance(userId, totalGenerated);
  return totalGenerated;
}

async function transferMoney(senderId, receiverId, amount) {
  if (amount <= 0) {
    throw new Error("You cannot transfer zero or negative amounts of money.");
  }

  const sender = await Users.findOne({ where: { user_id: senderId } });
  const receiver = await Users.findOne({ where: { user_id: receiverId } });

  if (!sender || !receiver) {
    throw new Error("One or both users not found");
  }

  if (sender.balance < amount) {
    throw new Error("Insufficient funds");
  }

  // Check daily transfer limit
  const dailyTransferred = dailyTransferLimits.get(senderId) || 0;
  if (dailyTransferred + amount > DAILY_TRANSFER_LIMIT) {
    throw new Error(
      `Daily transfer limit of 🪙${DAILY_TRANSFER_LIMIT} exceeded`
    );
  }

  await Users.update(
    { balance: sender.balance - amount },
    { where: { user_id: senderId } }
  );
  await Users.update(
    { balance: receiver.balance + amount },
    { where: { user_id: receiverId } }
  );

  // Update daily transfer amount
  dailyTransferLimits.set(senderId, dailyTransferred + amount);

  // Update local cache
  const senderAccount = bankAccounts.get(senderId);
  const receiverAccount = bankAccounts.get(receiverId);
  if (senderAccount) senderAccount.balance -= amount;
  if (receiverAccount) receiverAccount.balance += amount;

  return {
    newSenderBalance: sender.balance - amount,
    newReceiverBalance: receiver.balance + amount,
    remainingDailyLimit: DAILY_TRANSFER_LIMIT - (dailyTransferred + amount),
  };
}

async function calculateNetWorth(userId) {
  const user = await Users.findOne({ where: { user_id: userId } });
  const items = await UserItems.findAll({
    where: { user_id: userId },
    include: ["item"],
  });

  const itemValue = items.reduce((total, userItem) => {
    // Include the base cost of the item
    const baseCost = userItem.item.cost * userItem.amount;

    // Include the total upgrade cost
    const upgradeCost = userItem.total_upgrade_cost;

    return total + baseCost + upgradeCost;
  }, 0);

  return user.balance + user.bank_balance + itemValue;
}

async function getTopUsers(guildId, sortByNetWorth = true) {
  const users = await Users.findAll({
    where: {
      user_id: {
        [Op.like]: `%-${guildId}`,
      },
    },
  });

  const userNetWorths = await Promise.all(
    users.map(async (user) => {
      const [userId, _] = user.user_id.split("-");
      const netWorth = await calculateNetWorth(user.user_id);
      return {
        userId,
        netWorth,
        totalCash: user.balance + user.bank_balance,
        prestigeTokens: user.prestige_tokens || 0,
      };
    })
  );

  return userNetWorths.sort((a, b) =>
    sortByNetWorth ? b.netWorth - a.netWorth : b.totalCash - a.totalCash
  );
}

function createLeaderboardEmbed(
  topUsers,
  showNetWorth,
  guildName,
  showPrestige
) {
  let title, description, footerText;

  if (showPrestige) {
    title = `${guildName} - Prestige Net Worth Leaderboard`;
    description = topUsers
      .sort((a, b) => b.prestigeTokens - a.prestigeTokens)
      .slice(0, 10)
      .map(({ userId, netWorth, prestigeTokens }, index) => {
        return `${
          index + 1
        }. <@${userId}> - 🥇${prestigeTokens} 🪙 ${netWorth.toLocaleString()}`;
      })
      .join("\n");
    footerText = `Top 10 Most Prestigious Users in ${guildName}`;
  } else {
    const metric = showNetWorth ? "Net Worth" : "Balance";
    title = `${guildName} - ${metric} Leaderboard`;
    description = topUsers
      .slice(0, 10)
      .map(({ userId, netWorth, totalCash, prestigeTokens }, index) => {
        const value = showNetWorth ? netWorth : totalCash;
        const prestigeDisplay =
          prestigeTokens > 0 ? ` 🥇${prestigeTokens}` : "";
        return `${
          index + 1
        }. <@${userId}> - 🪙 ${value.toLocaleString()}${prestigeDisplay}`;
      })
      .join("\n");
    footerText = `Top 10 ${
      showNetWorth ? "Wealthiest" : "Richest"
    } Users in ${guildName}`;
  }

  return new EmbedBuilder()
    .setColor("#ff00ff")
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: footerText })
    .setTimestamp();
}

function createLeaderboardButtons(showNetWorth, showPrestige) {
  const netWorthButton = new ButtonBuilder()
    .setCustomId("leaderboard_net_worth")
    .setLabel("Net Worth")
    .setStyle(showNetWorth ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const totalCashButton = new ButtonBuilder()
    .setCustomId("leaderboard_total_cash")
    .setLabel("Balance")
    .setStyle(
      !showNetWorth && !showPrestige
        ? ButtonStyle.Primary
        : ButtonStyle.Secondary
    );

  const prestigeButton = new ButtonBuilder()
    .setCustomId("leaderboard_prestige")
    .setLabel("Prestige Net Worth")
    .setStyle(showPrestige ? ButtonStyle.Primary : ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(
    prestigeButton,
    totalCashButton,
    netWorthButton
  );
}

const SLOT_SYMBOLS = [
  "🍒",
  "🍋",
  "🍊",
  "🍇",
  "🔔",
  "💎",
  "🍀",
  "🌟",
  "💰",
  "👑",
  "7️⃣",
];

// Multipliers
const PAYOUTS = {
  "🍒🍒🍒": 5,
  "🍋🍋🍋": 10,
  "🍇🍇🍇": 15,
  "🍀🍀🍀": 20,
  "🌟🌟🌟": 25,
  "💎💎💎": 30,
  "💰💰💰": 35,
  "👑👑👑": 50,
  "7️⃣7️⃣7️⃣": 100,
  ANY2: 1.5, // Any 2 matching symbols
};

function spinSlots() {
  return [
    SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
  ];
}

function calculateWinnings(result, betAmount) {
  const resultString = result.join("");

  if (PAYOUTS[resultString]) {
    return Math.floor(PAYOUTS[resultString] * betAmount);
  }

  if (
    result[0] === result[1] ||
    result[1] === result[2] ||
    result[0] === result[2]
  ) {
    return Math.floor(PAYOUTS["ANY2"] * betAmount);
  }

  return 0;
}

const MIN_BET = 50;

function spinSlots() {
  return [
    SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
  ];
}

function calculateWinnings(result, betAmount) {
  const resultString = result.join("");

  if (PAYOUTS[resultString]) {
    return PAYOUTS[resultString] * betAmount;
  }

  if (result[0] === result[1] && result[1] === result[2]) {
    return PAYOUTS["ANY"] * betAmount;
  }

  if (
    result[0] === result[1] ||
    result[1] === result[2] ||
    result[0] === result[2]
  ) {
    return PAYOUTS["ANY2"] * betAmount;
  }

  return 0;
}

async function handleSlots(message, args) {
  const userId = createCombinedId(message.author.id, message.guild.id);
  const userBalance = await getBalance(userId);

  if (!args.length) {
    return message.reply(
      `Please specify a bet amount or use 'all' to bet your entire balance.`
    );
  }

  let betAmount;
  if (args[0].toLowerCase() === "all") {
    betAmount = userBalance;
  } else {
    betAmount = parseInt(args[0]);
  }

  if (isNaN(betAmount) || betAmount <= 0) {
    return message.reply(`Please enter a valid bet amount or use 'all'.`);
  }

  if (betAmount < MIN_BET) {
    return message.reply(`The minimum bet is 🪙${MIN_BET}.`);
  }

  if (userBalance < betAmount) {
    return message.reply(
      `You don't have enough coins. Your balance: 🪙${userBalance}`
    );
  }

  const spinButton = new ButtonBuilder()
    .setCustomId(`spin_slots_${betAmount}`)
    .setLabel("🎰 Spin!")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(spinButton);

  const initialEmbed = new EmbedBuilder()
    .setColor("#FFA500")
    .setTitle("🎰 Slots Machine 🎰")
    .setDescription(`Bet Amount: 🪙${betAmount}\nPress the button to spin!`)
    .setFooter({ text: "Azus Bot Slots" })
    .setTimestamp();

  await message.reply({ embeds: [initialEmbed], components: [row] });
}

async function playSlotsRound(interaction, betAmount) {
  const userId = createCombinedId(interaction.user.id, interaction.guild.id);
  const userBalance = await getBalance(userId);

  if (userBalance < betAmount) {
    return await interaction.reply({
      content: `You don't have enough coins to play. Your balance: 🪙${userBalance}`,
      ephemeral: true,
    });
  }

  const result = spinSlots();
  let winnings = calculateWinnings(result, betAmount);

  let netGain = winnings - betAmount;
  let passiveTriggered = false;

  if (netGain > 0) {
    // Apply income boost to winnings
    netGain = await applyGamblingIncomeBoost(userId, netGain);
    winnings = netGain + betAmount;
  } else if (netGain < 0) {
    // Check if the gambling passive triggers
    passiveTriggered = await applyGamblingPassive(userId);
    if (passiveTriggered) {
      netGain = 0; // Nullify the loss
    }
  }

  await addBalance(userId, Math.floor(netGain));

  const newBalance = await getBalance(userId);

  const resultString = result.join(" ");

  const resultEmbed = new EmbedBuilder()
    .setColor(
      netGain > 0 ? "#00FF00" : passiveTriggered ? "#FFFF00" : "#FF0000"
    )
    .setTitle(
      passiveTriggered
        ? "🎰 Slots Result - Passive Triggered! 🎰"
        : "🎰 Slots Result 🎰"
    )
    .setDescription(
      `${resultString}\n\n${
        netGain > 0
          ? "You won!"
          : passiveTriggered
          ? "Loss prevented!"
          : "Better luck next time!"
      }`
    )
    .addFields(
      { name: "Bet", value: `🪙${betAmount}`, inline: true },
      { name: "Winnings", value: `🪙${winnings}`, inline: true },
      { name: "Net Gain/Loss", value: `🪙${netGain}`, inline: true },
      { name: "New Balance", value: `🪙${newBalance}`, inline: false }
    )
    .setFooter({ text: "Azus Bot Slots" })
    .setTimestamp();

  if (passiveTriggered) {
    resultEmbed.addFields({
      name: "Passive Ability",
      value: "Your 1% chance to nullify gambling losses activated!",
      inline: false,
    });
  }

  const playAgainButton = new ButtonBuilder()
    .setCustomId(`play_again_${betAmount}`)
    .setLabel("Play Again")
    .setStyle(ButtonStyle.Success);

  const newRow = new ActionRowBuilder().addComponents(playAgainButton);

  return await interaction.update({
    embeds: [resultEmbed],
    components: [newRow],
  });
}

async function playCoinflip(message, userId, bet) {
  let userStats = coinflipStats.get(userId) || { streak: 0, winChance: 50 };

  const win = Math.random() * 100 < userStats.winChance;
  if (win) {
    const winnings = Math.floor(bet);
    const boostedWinnings = await applyGamblingIncomeBoost(userId, winnings);
    await addBalance(userId, boostedWinnings);
    userStats.streak++;
    userStats.winChance = Math.min(userStats.winChance + 1, 75); // Cap at 75%
    coinflipStats.set(userId, userStats);

    const newBalance = await getBalance(userId);

    const winEmbed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle(`Coinflip: You Won!`)
      .setDescription(`You won 🪙${boostedWinnings}`)
      .addFields(
        {
          name: "New Balance",
          value: `🪙${newBalance.toLocaleString()}`,
          inline: true,
        },
        {
          name: "Streak",
          value: userStats.streak.toString(),
          inline: true,
        },
        {
          name: "Next Flip Win Chance",
          value: `${userStats.winChance}%`,
          inline: true,
        }
      )
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();

    const playAgainButton = new ButtonBuilder()
      .setCustomId(`coinflip_again_${bet}`)
      .setLabel("Play Again")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(playAgainButton);

    return await message.channel.send({
      embeds: [winEmbed],
      components: [row],
    });
  } else {
    const isSavedByGamblingPassive = await applyGamblingPassive(userId);

    if (isSavedByGamblingPassive) {
      // Passive triggered, no loss
      const newBalance = await getBalance(userId);
      const embed = new EmbedBuilder()
        .setColor("#FFFF00")
        .setTitle(`Coinflip: Passive Triggered!`)
        .setDescription(
          `Loss prevented: Your 1% chance to avoid gambling losses activated.`
        )
        .addFields(
          { name: "Bet Amount", value: `🪙${bet}`, inline: true },
          {
            name: "Balance",
            value: `🪙${newBalance.toLocaleString()}`,
            inline: true,
          },
          { name: "Streak", value: userStats.streak.toString(), inline: true },
          {
            name: "Next Flip Win Chance",
            value: `${userStats.winChance}%`,
            inline: true,
          }
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } else {
      await addBalance(userId, Math.floor(-bet));
      userStats = { streak: 0, winChance: 50 };
      coinflipStats.set(userId, userStats);

      const newBalance = await getBalance(userId);

      const loseEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle(`Coinflip: You Lost!`)
        .setDescription(`You lost 🪙${bet}`)
        .addFields(
          {
            name: "New Balance",
            value: `🪙${newBalance.toLocaleString()}`,
            inline: true,
          },
          { name: "Streak", value: "0", inline: true },
          { name: "Next Flip Win Chance", value: "50%", inline: true }
        )
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();

      const playAgainButton = new ButtonBuilder()
        .setCustomId(`coinflip_again_${bet}`)
        .setLabel("Play Again")
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(playAgainButton);

      return await message.channel.send({
        embeds: [loseEmbed],
        components: [row],
      });
    }
  }
}

function createPayoutEmbed() {
  const embed = new EmbedBuilder()
    .setColor("#FFA500")
    .setTitle("Slots Payouts")
    .setDescription(
      "Here are the payout multipliers for different combinations:"
    )
    .addFields(
      Object.entries(PAYOUTS).map(([combo, multiplier]) => ({
        name: combo === "ANY2" ? "Any 2 matching symbols" : combo,
        value: `${multiplier}x`,
        inline: true,
      }))
    )
    .setFooter({ text: "Multipliers are applied to your bet amount" });

  return embed;
}

async function handleSlotsPayout(message) {
  const embed = createPayoutEmbed();
  await message.reply({ embeds: [embed] });
}

function calculateUpgradeCost(baseCost, level) {
  return Math.round(baseCost * Math.pow(1.3, level - 1));
}

function getPrinterBaseRate(printerName) {
  const rates = {
    "Bronze Printer": 3,
    "Silver Printer": 7,
    "Gold Printer": 14,
    "Platinum Printer": 25,
    "Diamond Printer": 50,
    "Quantum Printer": 100,
    "Neutronium Printer": 250,
  };
  return rates[printerName] || 1;
}

function calculateUpgradeEffect(baseEffect, level, prestigeUpgrades = {}) {
  const increasePerLevel = 0.25; // 25% increase per level
  let effect = baseEffect * Math.pow(1 + increasePerLevel, level);

  // Apply prestige printer efficiency upgrade
  const printerEfficiencyLevel = prestigeUpgrades.printer_efficiency || 0;
  effect *= 1 + 0.2 * printerEfficiencyLevel; // 15% increase per level

  return effect;
}

function calculateSpeedUpgrade(level) {
  const baseInterval = 3; // Base print interval in minutes
  const maxReduction = 0.8; // Maximum reduction
  const reductionPerLevel = 0.1; // Reduction per level
  const reduction = Math.min(maxReduction, reductionPerLevel * level);
  return baseInterval * (1 - reduction);
}

function calculateCapacity(baseRate, level, prestigeUpgrades) {
  const baseCapacity = baseRate * 100;
  const multiplier = 1.5; // Exponential growth multiplier
  let capacity = baseCapacity * Math.pow(multiplier, level); // Exponential increase

  // Apply prestige printer capacity upgrade
  const printerCapacityLevel = prestigeUpgrades.printer_capacity || 0;
  capacity *= 1 + 0.5 * printerCapacityLevel; // 25% increase per level

  return Math.floor(capacity);
}

function formatTime(minutes) {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);

  if (secs === 0) {
    return `${mins}m`;
  } else {
    return `${mins}m ${secs}s`;
  }
}

async function createUpgradeEmbed(printer, user) {
  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle(`🖨️ Upgrade ${printer.item.name}`)
    .setDescription("Choose an upgrade to improve your printer:")
    .setFooter({ text: "Azus Bot • Click a button to upgrade" })
    .setTimestamp();

  const row = new ActionRowBuilder();
  const prestigeUpgrades = await getUserPrestigeUpgradesFromId(user.user_id);
  const upgradeEmojis = {
    speed: "⚡",
    output: "💰",
    capacity: "📦",
  };

  const upgrades = await CurrencyShop.findAll({
    where: {
      type: "upgrade",
      applies_to: printer.item.name,
    },
  });

  for (const upgrade of upgrades) {
    const currentLevel = printer[`${upgrade.upgrade_type}_level`];
    const nextLevel = currentLevel + 1;
    const upgradeCost = calculateUpgradeCost(upgrade.cost, nextLevel);

    const baseRate = getPrinterBaseRate(printer.item.name);
    let currentEffect, nextEffect;

    if (upgrade.upgrade_type === "speed") {
      currentEffect = formatTime(calculateSpeedUpgrade(currentLevel));
      nextEffect = formatTime(calculateSpeedUpgrade(nextLevel));
    } else if (upgrade.upgrade_type === "output") {
      currentEffect = calculateUpgradeEffect(
        baseRate,
        currentLevel,
        prestigeUpgrades
      ).toFixed(1);
      nextEffect = calculateUpgradeEffect(
        baseRate,
        nextLevel,
        prestigeUpgrades
      ).toFixed(1);
    } else if (upgrade.upgrade_type === "capacity") {
      currentEffect = calculateCapacity(
        baseRate,
        currentLevel,
        prestigeUpgrades,
        prestigeUpgrades
      );
      nextEffect = calculateCapacity(baseRate, nextLevel, prestigeUpgrades);
    }

    const emoji = upgradeEmojis[upgrade.upgrade_type];
    const upgradeName =
      upgrade.upgrade_type.charAt(0).toUpperCase() +
      upgrade.upgrade_type.slice(1);

    let upgradeStatus;
    if (currentLevel >= upgrade.max_level) {
      upgradeStatus = `✨ MAX LEVEL (${currentLevel}/${upgrade.max_level}) ✨`;
    } else if (user.bank_balance < upgradeCost) {
      upgradeStatus = `❌ Insufficient Funds (${currentLevel}/${upgrade.max_level})`;
    } else {
      upgradeStatus = `✅ Available (${currentLevel}/${upgrade.max_level})`;
    }

    embed.addFields({
      name: `${emoji} ${upgradeName} Upgrade`,
      value: [
        `\`\`\`${upgradeStatus}\`\`\``,
        `Effect: ${currentEffect}${
          currentLevel < upgrade.max_level ? ` ➜ ${nextEffect}` : ""
        }`,
        currentLevel < upgrade.max_level
          ? `Cost: 🪙 ${upgradeCost.toLocaleString()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"), // filter(Boolean) removes any empty strings
      inline: false,
    });

    const button = new ButtonBuilder()
      .setCustomId(`upgrade_${printer.item_id}_${upgrade.upgrade_type}`)
      .setLabel(`Upgrade ${upgradeName}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(
        currentLevel >= upgrade.max_level || user.bank_balance < upgradeCost
      )
      .setEmoji(emoji);

    row.addComponents(button);
  }

  embed.addFields({
    name: "Your Bank Balance",
    value: `🪙 ${user.bank_balance.toLocaleString()}`,
    inline: false,
  });

  return { embed, row };
}

async function getUserPrinters(userId) {
  const userItems = await UserItems.findAll({
    where: { user_id: userId },
    include: ["item"],
  });
  return userItems.filter((item) => allPrinters.includes(item.item.name));
}

function getPrinterIcon(printerName) {
  const icons = {
    "Bronze Printer": "🟤",
    "Silver Printer": "⚪",
    "Gold Printer": "🟡",
    "Platinum Printer": "🔷",
    "Diamond Printer": "💎",
    "Quantum Printer": "⚛️",
    "Neutronium Printer": "🌠",
  };
  return icons[printerName] || "🖨️"; // Default to a generic printer icon
}

// Main heist command handler
async function handleHeist(message, targetUser) {
  const userId = createCombinedId(message.author.id, message.guild.id);
  const user = await Users.findOne({ where: { user_id: userId } });
  const targetUserId = createCombinedId(targetUser.id, message.guild.id);
  const target = await Users.findOne({ where: { user_id: targetUserId } });

  if (!target) {
    return message.reply("The target user doesn't have an account.");
  }

  const targetNetWorth = await calculateNetWorth(targetUserId);
  const userNetWorth = await calculateNetWorth(userId);

  if (targetNetWorth > 5000000 && userNetWorth < 5000000) {
    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🛡️ Heist Blocked")
      .setDescription("This user's wealth is too great to be targeted!")
      .addFields({
        name: "Target's Net Worth",
        value: `🪙${targetNetWorth.toLocaleString()}`,
        inline: true,
      })
      .setFooter({
        text: "Tip: Try targeting someone with less than 5,000,000 net worth",
      })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  const targetLevel = await calculateLevel(targetUserId);
  const targetPrestigeUpgrades = await getUserPrestigeUpgradesFromId(
    targetUserId
  );

  const protectionPeriod = calculateHeistProtectionDuration(
    targetLevel,
    targetPrestigeUpgrades
  );

  if (
    target.last_heisted &&
    Date.now() - target.last_heisted.getTime() < protectionPeriod
  ) {
    const timeLeft =
      (target.last_heisted.getTime() + protectionPeriod - Date.now()) / 1000;
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🛡️ Heist Blocked")
      .setDescription(
        "Looks like their vault is still on high alert from the last heist attempt."
      )
      .addFields({
        name: "Security Cooldown",
        value: `${hours}h ${minutes}m remaining`,
        inline: true,
      })
      .setFooter({
        text: "Tip: Scout for other potential targets in the meantime",
      })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
  if (target.bank_balance === 0) {
    return message.reply("The target's bank is empty. Try someone else!");
  }

  const lastHeist = user.last_heist ? new Date(user.last_heist).getTime() : 0;
  const upgrades = await getUserHeistUpgrades(userId);
  const cooldown = calculateHeistCooldown(
    HEIST_COOLDOWN,
    upgrades[HEIST_UPGRADES.COOLDOWN_REDUCTION] || 0
  );

  if (Date.now() - lastHeist < cooldown) {
    const timeLeft = Math.max(0, (lastHeist + cooldown - Date.now()) / 1000);
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const formattedTime = `${hours}h ${minutes}m`;
    const embed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle("Heist Cooldown")
      .setDescription(
        `You need to wait ${formattedTime} before attempting another heist.`
      )
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();
    const sentMessage = await message.reply({ embeds: [embed] });

    // Delete the message after 5 seconds
    setTimeout(() => {
      sentMessage.delete().catch(console.error);
    }, 5000);

    return;
  }

  const wires = calculateWires(
    BASE_WIRES,
    upgrades[HEIST_UPGRADES.WIRE_REDUCTION] || 0
  );
  const stealPercentage = calculateStealPercentage(
    BASE_STEAL_PERCENTAGE,
    upgrades[HEIST_UPGRADES.STEAL_INCREASE] || 0
  );

  const correctWire = Math.floor(Math.random() * wires) + 1;
  const buttons = [];

  const wireColors = ["🔴", "🔵", "🟢", "🟡", "⚪"];
  const buttonStyles = [
    ButtonStyle.Danger,
    ButtonStyle.Primary,
    ButtonStyle.Success,
    ButtonStyle.Secondary,
    ButtonStyle.Secondary,
  ];

  for (let i = 1; i <= wires; i++) {
    const colorIndex = (i - 1) % wireColors.length;
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`heist_wire_${i}`)
        .setLabel(`Wire ${i}`)
        .setEmoji(wireColors[colorIndex])
        .setStyle(buttonStyles[colorIndex])
    );
  }

  const row = new ActionRowBuilder().addComponents(buttons);

  const attemptImageUrls = [
    "https://i.pinimg.com/originals/05/6c/c5/056cc5d673522dd2949efa4c8e531418.jpg",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS55zHUzlYX4Rr_6zx1pbkA5wbOqTsw6C74Dw&s",
    "https://i.pinimg.com/736x/20/fc/e1/20fce17ec45587eb28e5fc675f48d414.jpg",
  ];

  const failureImageUrls = [
    "https://media1.tenor.com/m/nw830_b_6LYAAAAd/sad.gif",
    "https://i.imgur.com/iL1MXLu.gif",
  ];

  const embed = new EmbedBuilder()
    .setColor("#ff0000")
    .setTitle("🚨 High-Stakes Heist 🚨")
    .setDescription(
      `You're attempting a daring heist on ${targetUser.username}'s bank vault!`
    )
    .addFields(
      { name: "🎯 Target", value: targetUser.username, inline: true },
      {
        name: "💰 Potential Loot",
        value: `${stealPercentage}% of bank`,
        inline: true,
      },
      { name: "🔧 Security Level", value: `${wires} wires`, inline: true },
      {
        name: "\u200B",
        value: "Choose a wire to cut and break into the vault:",
      }
    )
    .setImage(
      attemptImageUrls[Math.floor(Math.random() * attemptImageUrls.length)]
    )
    .setFooter({
      text: "⚠️ Choose wisely! One wrong move and the alarm will trigger!",
    })
    .setTimestamp();

  const heistMessage = await message.reply({
    embeds: [embed],
    components: [row],
  });

  const guildId = message.guild.id;

  const filter = (interaction) => {
    const interactionCombinedId = createCombinedId(
      interaction.user.id,
      guildId
    );

    return (
      interactionCombinedId === userId &&
      interaction.customId.startsWith("heist_wire_")
    );
  };
  const collector = heistMessage.createMessageComponentCollector({
    filter,
    time: 30000,
  });

  collector.on("collect", async (interaction) => {
    const chosenWire = parseInt(interaction.customId.split("_")[2]);

    await Users.update(
      { last_heist: Date.now() },
      { where: { user_id: userId } }
    );

    if (chosenWire === correctWire) {
      const stolenAmount = Math.floor(
        target.bank_balance * (stealPercentage / 100)
      );
      addBankBalance(targetUserId, -stolenAmount);
      addBalance(userId, stolenAmount);

      await Users.update(
        { last_heisted: Date.now() },
        { where: { user_id: targetUserId } }
      );

      const successEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("🎉 Heist Successful! 💰")
        .setDescription(`You've cracked the vault and escaped with the loot!`)
        .addFields(
          {
            name: "💼 Stolen Loot",
            value: `🪙 ${stolenAmount.toLocaleString()}`,
            inline: true,
          },
          {
            name: "🏦 New Balance",
            value: `🪙 ${(user.balance + stolenAmount).toLocaleString()}`,
            inline: true,
          }
        )
        .setImage("https://media.tenor.com/4PgHCbk6yAEAAAAM/rich-cash.gif") // Replace with a success-themed image URL
        .setFooter({ text: "You've pulled off the perfect heist!" })
        .setTimestamp();

      await interaction.update({ embeds: [successEmbed], components: [] });
    } else {
      const failEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("❌ Heist Failed! 🚔")
        .setDescription(
          "You cut the wrong wire! Alarms are blaring, and security is closing in!"
        )
        .addFields(
          {
            name: "😰 Outcome",
            value:
              "You barely managed to escape, but the heist was a total bust.",
          },
          {
            name: "🔍 Correct Wire",
            value: `The correct wire was ${
              wireColors[correctWire - 1]
            } (Wire ${correctWire})`,
          }
        )
        .setImage(
          failureImageUrls[Math.floor(Math.random() * failureImageUrls.length)]
        )
        .setFooter({ text: "Better luck next time, rookie!" })
        .setTimestamp();

      await interaction.update({ embeds: [failEmbed], components: [] });
    }

    collector.stop();
  });

  collector.on("end", (collected, reason) => {
    if (reason === "time") {
      const timeoutEmbed = new EmbedBuilder()
        .setColor("#ff9900")
        .setTitle("⏰ Heist Aborted!")
        .setDescription(
          "You took too long to act. The security system detected your presence!"
        )
        .addFields({
          name: "😓 Outcome",
          value: "The heist was aborted before it even began.",
        })
        .setFooter({ text: "Time is money in this business!" })
        .setTimestamp();

      heistMessage.edit({ embeds: [timeoutEmbed], components: [] });
    }
  });
}

// Heist cooldown (in milliseconds)
const HEIST_COOLDOWN = 14 * 60 * 60 * 1000;

// Base number of wires
const BASE_WIRES = 5;

// Base percentage of bank stolen
const BASE_STEAL_PERCENTAGE = 10;

// Heist upgrades
const HEIST_UPGRADES = {
  WIRE_REDUCTION: "wire_reduction",
  STEAL_INCREASE: "steal_increase",
  COOLDOWN_REDUCTION: "cooldown_reduction",
};

// Function to get user's heist upgrades
async function getUserHeistUpgrades(userId) {
  const userItems = await UserItems.findAll({
    where: { user_id: userId },
    include: [
      {
        model: CurrencyShop,
        as: "item",
        where: {
          name: Object.values(UPGRADE_NAMES),
        },
      },
    ],
  });

  return Object.values(HEIST_UPGRADES).reduce((upgrades, upgradeType) => {
    const item = userItems.find(
      (ui) => ui.item.name === UPGRADE_NAMES[upgradeType]
    );
    upgrades[upgradeType] = item ? item.amount : 0;
    return upgrades;
  }, {});
}

// Function to calculate actual number of wires based on upgrades
function calculateWires(baseWires, wireReductionLevel) {
  return Math.max(2, baseWires - wireReductionLevel);
}

// Function to calculate steal percentage based on upgrades
function calculateStealPercentage(basePercentage, stealIncreaseLevel) {
  let percentage =
    basePercentage + (stealIncreaseLevel * (20 - basePercentage)) / 3;
  percentage = Math.min(20, percentage);
  return Math.round(percentage / 2) * 2;
}

// Function to calculate cooldown based on upgrades
function calculateHeistCooldown(baseCooldown, cooldownReductionLevel) {
  return Math.max(
    30 * 60 * 1000,
    baseCooldown - cooldownReductionLevel * 30 * 60 * 4000
  );
}

async function handleHeistUpgrade(message) {
  const combinedId = createCombinedId(message.author.id, message.guild.id);
  const { embed, upgradeInfo } = await createHeistUpgradeEmbed(combinedId);
  const row = createHeistUpgradeButtons(upgradeInfo);

  return message.reply({ embeds: [embed], components: [row] });
}

function calculateHeistUpgradeCost(baseCost, level) {
  return baseCost * Math.pow(2, level - 1);
}

// Add this mapping at the top of your file with other constants
const UPGRADE_TYPE_MAP = {
  wire: HEIST_UPGRADES.WIRE_REDUCTION,
  steal: HEIST_UPGRADES.STEAL_INCREASE,
  cooldown: HEIST_UPGRADES.COOLDOWN_REDUCTION,
};

async function performHeistUpgrade(interaction, shortUpgradeType) {
  try {
    const userId = createCombinedId(interaction.user.id, interaction.guild.id);
    const user = await Users.findOne({ where: { user_id: userId } });
    const oldLevel = await calculateLevel(userId);
    if (!user) {
      return interaction.reply({
        content: "User not found. Please try again.",
        ephemeral: true,
      });
    }

    const upgradeType = UPGRADE_TYPE_MAP[shortUpgradeType];
    if (!upgradeType) {
      console.error(`Invalid upgradeType: ${shortUpgradeType}`);
      return interaction.reply({
        content: "Invalid upgrade type. Please try again.",
        ephemeral: true,
      });
    }

    const upgrades = await getUserHeistUpgrades(userId);
    const currentLevel = upgrades[upgradeType] || 0;

    const upgradeItem = await CurrencyShop.findOne({
      where: { name: UPGRADE_NAMES[upgradeType] },
    });

    if (!upgradeItem) {
      console.error(
        `Upgrade item not found for: ${UPGRADE_NAMES[upgradeType]}`
      );
      return interaction.reply({
        content: "Upgrade not found. Please contact an administrator.",
        ephemeral: true,
      });
    }

    if (currentLevel >= upgradeItem.max_level) {
      return interaction.reply({
        content: "This upgrade is already at max level.",
        ephemeral: true,
      });
    }

    const upgradeCost = calculateHeistUpgradeCost(
      upgradeItem.cost,
      currentLevel + 1
    );

    if (user.bank_balance < upgradeCost) {
      return interaction.reply({
        content: "You don't have enough money for this upgrade.",
        ephemeral: true,
      });
    }

    await addBankBalance(userId, -upgradeCost);

    const [userItem, created] = await UserItems.findOrCreate({
      where: { user_id: userId, item_id: upgradeItem.id },
      defaults: { amount: 0, total_upgrade_cost: 0 },
    });

    userItem.amount = currentLevel + 1;
    userItem.total_upgrade_cost += upgradeCost;
    await userItem.save();

    // Regenerate the entire heist upgrade embed
    const { embed, upgradeInfo } = await createHeistUpgradeEmbed(userId);
    const updatedRow = createHeistUpgradeButtons(upgradeInfo);

    const newLevel = await calculateLevel(userId);
    await checkUnlockedPassives(userId, oldLevel, newLevel);
    return await interaction.update({
      embeds: [embed],
      components: [updatedRow],
    });
  } catch (error) {
    console.error("Error in performHeistUpgrade:", error);
    return await interaction.reply({
      content:
        "An error occurred while processing your upgrade. Please try again later.",
      ephemeral: true,
    });
  }
}

const UPGRADE_NAMES = {
  [HEIST_UPGRADES.WIRE_REDUCTION]: "Wire Cutter",
  [HEIST_UPGRADES.STEAL_INCREASE]: "Insider Info",
  [HEIST_UPGRADES.COOLDOWN_REDUCTION]: "Stealth Tech",
};

const upgradeEmojis = {
  [HEIST_UPGRADES.WIRE_REDUCTION]: "✂️",
  [HEIST_UPGRADES.STEAL_INCREASE]: "🕵️",
  [HEIST_UPGRADES.COOLDOWN_REDUCTION]: "⏱️",
};

function formatTimeHours(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${hours}h`;
}

async function createHeistUpgradeEmbed(userId) {
  const user = await Users.findOne({ where: { user_id: userId } });
  const upgrades = await getUserHeistUpgrades(userId);

  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("🔒 Upgrade Heist Equipment")
    .setDescription("Choose an upgrade to improve your heist capabilities:")
    .setFooter({ text: "Azus Bot • Click a button to upgrade" })
    .setTimestamp();

  const upgradeInfo = [];

  for (const [upgradeType, upgradeName] of Object.entries(UPGRADE_NAMES)) {
    const upgrade = await CurrencyShop.findOne({
      where: { name: upgradeName },
    });
    const currentLevel = upgrades[upgradeType] || 0;
    const nextLevel = currentLevel + 1;
    const upgradeCost = calculateHeistUpgradeCost(upgrade.cost, nextLevel);

    let currentEffect, nextEffect;

    if (upgradeType === HEIST_UPGRADES.WIRE_REDUCTION) {
      currentEffect = calculateWires(5, currentLevel);
      nextEffect = calculateWires(5, nextLevel);
    } else if (upgradeType === HEIST_UPGRADES.STEAL_INCREASE) {
      currentEffect = `${calculateStealPercentage(
        BASE_STEAL_PERCENTAGE,
        currentLevel
      )}%`;
      nextEffect = `${calculateStealPercentage(
        BASE_STEAL_PERCENTAGE,
        nextLevel
      )}%`;
    } else if (upgradeType === HEIST_UPGRADES.COOLDOWN_REDUCTION) {
      currentEffect = formatTimeHours(
        calculateHeistCooldown(14 * 60 * 60 * 1000, currentLevel) / 1000
      );
      nextEffect = formatTimeHours(
        calculateHeistCooldown(14 * 60 * 60 * 1000, nextLevel) / 1000
      );
    }

    const emoji = upgradeEmojis[upgradeType];

    let upgradeStatus;
    if (currentLevel >= upgrade.max_level) {
      upgradeStatus = `✨ MAX LEVEL (${currentLevel}/${upgrade.max_level}) ✨`;
    } else if (user.bank_balance < upgradeCost) {
      upgradeStatus = `❌ Insufficient Funds (${currentLevel}/${upgrade.max_level})`;
    } else {
      upgradeStatus = `✅ Available (${currentLevel}/${upgrade.max_level})`;
    }

    embed.addFields({
      name: `${emoji} ${upgradeName} Upgrade`,
      value: [
        `\`\`\`${upgradeStatus}\`\`\``,
        `Effect: ${currentEffect}${
          currentLevel < upgrade.max_level ? ` ➜ ${nextEffect}` : ""
        }`,
        currentLevel < upgrade.max_level
          ? `Cost: 🪙 ${upgradeCost.toLocaleString()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      inline: false,
    });

    upgradeInfo.push({
      type: upgradeType,
      name: upgradeName,
      currentLevel,
      maxLevel: upgrade.max_level,
      cost: upgradeCost,
      canAfford: user.bank_balance >= upgradeCost,
    });
  }

  embed.addFields({
    name: "Your Balance",
    value: `🪙 ${user.bank_balance.toLocaleString()}`,
    inline: false,
  });

  return { embed, upgradeInfo };
}

function createHeistUpgradeButtons(upgradeInfo) {
  const row = new ActionRowBuilder();

  for (const upgrade of upgradeInfo) {
    const button = new ButtonBuilder()
      .setCustomId(`heist_upgrade_${upgrade.type}`)
      .setLabel(`Upgrade ${upgrade.name}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji(upgradeEmojis[upgrade.type])
      .setDisabled(
        upgrade.currentLevel >= upgrade.maxLevel || !upgrade.canAfford
      );

    row.addComponents(button);
  }

  return row;
}

async function handleCooldowns(message) {
  const combinedId = createCombinedId(message.author.id, message.guild.id);
  const user = await Users.findOne({ where: { user_id: combinedId } });

  const upgrades = await getUserHeistUpgrades(combinedId);
  const heistCooldown = calculateHeistCooldown(
    HEIST_COOLDOWN,
    upgrades[HEIST_UPGRADES.COOLDOWN_REDUCTION] || 0
  );

  const now = Date.now();
  const cooldowns = {
    work: user.last_work
      ? Math.max(0, 60 * 60 * 1000 - (now - user.last_work.getTime()))
      : 0,
    crime: user.last_crime
      ? Math.max(0, 3 * 60 * 60 * 1000 - (now - user.last_crime.getTime()))
      : 0,
    daily: user.last_daily
      ? Math.max(0, 16 * 60 * 60 * 1000 - (now - user.last_daily.getTime()))
      : 0,
    rob: user.last_rob
      ? Math.max(0, 6 * 60 * 60 * 1000 - (now - user.last_rob.getTime()))
      : 0,
    heist: user.last_heist
      ? Math.max(0, heistCooldown - (now - user.last_heist.getTime()))
      : 0,
  };

  // Calculate heist protection
  const protectionPeriod = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
  const protectionTimeLeft = user.last_heisted
    ? Math.max(0, protectionPeriod - (now - user.last_heisted.getTime()))
    : 0;

  const formatTime = (ms) => {
    if (ms === 0) return "Ready!";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  };

  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("🕒 Your Cooldowns")
    .setDescription("Here are your current cooldowns:")
    .addFields(
      { name: "💼 Work", value: formatTime(cooldowns.work), inline: true },
      { name: "🦹 Crime", value: formatTime(cooldowns.crime), inline: true },
      { name: "📅 Daily", value: formatTime(cooldowns.daily), inline: true },
      { name: "💰 Rob", value: formatTime(cooldowns.rob), inline: true },
      { name: "🏦 Heist", value: formatTime(cooldowns.heist), inline: true },
      {
        name: "🛡️ Heist Protection",
        value:
          protectionTimeLeft > 0 ? formatTime(protectionTimeLeft) : "Inactive",
        inline: true,
      }
    )
    .setFooter({ text: "Azus Bot • Cooldowns update in real-time" })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

function createCombinedId(userId, guildId) {
  return `${userId}-${guildId}`;
}

function resetDailyTransferLimits() {
  dailyTransferLimits.clear();
}

const PRESTIGE_THRESHOLD = 5000000; // 5 million

// Update this function to handle the prestige process
async function handlePrestige(message) {
  const userId = createCombinedId(message.author.id, message.guild.id);
  const netWorth = await calculateNetWorth(userId);
  const user = await Users.findOne({ where: { user_id: userId } });

  if (!user) {
    return message.reply(
      "You don't have an account yet. Start playing to create one!"
    );
  }

  if (netWorth < PRESTIGE_THRESHOLD) {
    const embed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle("Prestige Not Available")
      .setDescription(
        `You need a net worth of 🪙${PRESTIGE_THRESHOLD.toLocaleString()} to prestige.`
      )
      .addFields(
        {
          name: "Your Net Worth",
          value: `🪙${netWorth.toLocaleString()}`,
          inline: true,
        },
        {
          name: "Required Net Worth",
          value: `🪙${PRESTIGE_THRESHOLD.toLocaleString()}`,
          inline: true,
        }
      )
      .setFooter({ text: "Keep growing your wealth!" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  const confirmEmbed = new EmbedBuilder()
    .setColor("#ffa500")
    .setTitle("Confirm Prestige")
    .setDescription(
      "Are you sure you want to prestige? This will reset all your progress but award you a prestige token."
    )
    .addFields(
      {
        name: "Current Net Worth",
        value: `🪙${netWorth.toLocaleString()}`,
        inline: true,
      },
      {
        name: "Current Prestige Tokens",
        value: user.prestige_tokens.toString(),
        inline: true,
      },
      {
        name: "New Prestige Tokens",
        value: (user.prestige_tokens + 1).toString(),
        inline: true,
      }
    )
    .setFooter({ text: "This action cannot be undone!" })
    .setTimestamp();

  const confirmButton = new ButtonBuilder()
    .setCustomId("confirm_prestige")
    .setLabel("Confirm Prestige")
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId("cancel_prestige")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

  const reply = await message.reply({
    embeds: [confirmEmbed],
    components: [row],
  });

  const filter = (i) => i.user.id === message.author.id;
  const collector = reply.createMessageComponentCollector({
    filter,
    time: 30000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "confirm_prestige") {
      await performPrestige(userId);
      const successEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("Prestige Successful!")
        .setDescription("You have successfully prestiged!")
        .addFields(
          {
            name: "New Prestige Tokens",
            value: (user.prestige_tokens + 1).toString(),
            inline: true,
          },
          { name: "New Net Worth", value: "🪙0", inline: true }
        )
        .setFooter({ text: "Your journey begins anew!" })
        .setTimestamp();

      await i.update({ embeds: [successEmbed], components: [] });
    } else if (i.customId === "cancel_prestige") {
      const cancelEmbed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Prestige Cancelled")
        .setDescription(
          "You have decided not to prestige. Your progress remains unchanged."
        )
        .setFooter({ text: "You can prestige anytime you're ready!" })
        .setTimestamp();

      await i.update({ embeds: [cancelEmbed], components: [] });
    }
  });

  collector.on("end", (collected) => {
    if (collected.size === 0) {
      const timeoutEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Prestige Cancelled")
        .setDescription(
          "You did not respond in time. Your progress remains unchanged."
        )
        .setFooter({ text: "You can try to prestige again anytime!" })
        .setTimestamp();

      reply.edit({ embeds: [timeoutEmbed], components: [] });
    }
  });
}

async function performPrestige(userId) {
  try {
    const [updatedRowsCount, updatedRows] = await Users.update(
      {
        prestige_tokens: Users.sequelize.literal("prestige_tokens + 1"),
        balance: 0,
        bank_balance: 0,
        last_daily: null,
        accumulated_interest: 0,
        last_crime: null,
        last_rob: null,
        last_work: null,
        last_heist: null,
        last_heisted: null,
      },
      {
        where: { user_id: userId },
        returning: true,
      }
    );

    if (updatedRowsCount === 0) {
      throw new Error("User not found or update failed");
    }

    // Delete all user items
    await UserItems.destroy({ where: { user_id: userId } });

    // Clear local caches
    bankAccounts.delete(userId);
    coinflipStats.delete(userId);
    hoboCooldowns.delete(userId);
    blackjackStats.delete(userId);
    dailyTransferLimits.delete(userId);

    console.log(`Prestige successful for user ${userId}`);
  } catch (error) {
    console.error(`Error during prestige for user ${userId}:`, error);
    throw error;
  }
}

const ALL_PASSIVES = [
  {
    level: 5,
    description:
      "Increase income from work, crime, daily and hobo commands by 25%",
  },
  {
    level: 10,
    description: "1% chance to nullify losses from gambling games",
  },
  {
    level: 25,
    description: "Increase interest base rate from 0.5% to 1.5%",
  },
  {
    level: 50,
    description: "Printers have 10% more capacity",
  },
  {
    level: 100,
    description: "Printers produce money 10% quicker",
  },
  {
    level: 250,
    description: "Heist Protection Shield 8 > 12 hours",
  },
];
async function applyIncomeBoostPassive(userId, amount) {
  const level = await calculateLevel(userId);
  const prestigeUpgrades = await getUserPrestigeUpgradesFromId(userId);
  let boost = 1;

  if (level >= 5) {
    boost *= 1.25; // 25% increase from level 5 passive
  }

  // Apply prestige income boost
  const incomeBoostLevel = prestigeUpgrades.income_boost || 0;
  boost *= 1 + 0.1 * incomeBoostLevel; // 5% increase per level

  return Math.floor(amount * boost);
}

async function getPassives(level, prestigeUpgrades) {
  let passives = ALL_PASSIVES.map((passive) => ({
    ...passive,
    unlocked: level >= passive.level,
    isPrestige: false,
  }));

  // Define all prestige upgrades
  const allPrestigeUpgrades = [
    {
      id: "income_boost",
      emoji: "💰",
      description: "Increase all income sources by 10%",
    },
    {
      id: "interest_rate",
      emoji: "📈",
      description: "Increase interest rate by 5%",
    },
    {
      id: "printer_efficiency",
      emoji: "⚡",
      description: "Increase printer output by 20%",
    },
    {
      id: "printer_capacity",
      emoji: "📦",
      description: "Increase printer capacity by 50%",
    },
    {
      id: "gambling_passive",
      emoji: "🎲",
      description: "additional chance to nullify gambling losses",
    },
    {
      id: "heist_protection",
      emoji: "🛡️",
      description: "additional hours of heist protection",
    },
  ];

  // Add all prestige upgrades to passives
  allPrestigeUpgrades.forEach((upgrade) => {
    const level = prestigeUpgrades[upgrade.id] || 0;
    let description = upgrade.description;

    if (upgrade.id === "gambling_passive") {
      description = `${level}% ${description}`;
    } else if (upgrade.id === "heist_protection") {
      description = `${level * 8} ${description}`;
    }

    passives.push({
      level: 0,
      description: `${upgrade.emoji} ${description}`,
      unlocked: level > 0,
      isPrestige: true,
    });
  });

  // ensure prestige is at top of list, then sort by level
  return passives.sort((a, b) => {
    if (a.isPrestige === b.isPrestige) {
      return b.level + a.level;
    }
    return a.isPrestige ? -1 : 1;
  });
}
async function calculateLevel(userId) {
  const items = await UserItems.findAll({
    where: { user_id: userId },
    include: ["item"],
  });

  const itemValue = items.reduce((total, userItem) => {
    const baseCost = userItem.item.cost * userItem.amount;
    const upgradeCost = userItem.total_upgrade_cost;
    return total + baseCost + upgradeCost;
  }, 0);

  return Math.floor(itemValue / 10000) + 1; // Every 10,000 is 1 level, starting from level 1
}

const PRESTIGE_BENEFITS = [
  { level: 1, description: "Coming soon!" },
  { level: 2, description: "Coming soon!" },
  { level: 3, description: "Coming soon!" },
  { level: 4, description: "Coming soon!" },
  { level: 5, description: "Coming soon!" },
];

async function hasGamblingPassive(userId) {
  const level = await calculateLevel(userId);
  return level >= 10; // Assuming this passive unlocks at level 5
}

// Add this function to apply the gambling passive
async function applyGamblingPassive(userId) {
  const level = await calculateLevel(userId);
  const prestigeUpgrades = await getUserPrestigeUpgradesFromId(userId);
  let passiveChance = 0;

  if (level >= 10) {
    passiveChance = 0.01; // 1% chance from level 10 passive
  }

  // Apply prestige gambling passive upgrade
  const gamblingPassiveLevel = prestigeUpgrades.gambling_passive || 0;
  passiveChance += 0.01 * gamblingPassiveLevel; // Additional 1% chance per level

  return Math.random() < passiveChance;
}

const INITIAL_GAME_DURATION = 10000; // 10 seconds
const TIME_DECREASE_PER_TURN = 500; // 0.5 seconds
const MIN_GAME_DURATION = 3500;
const MAX_ATTEMPTS = 3;
const MIN_WORD_LENGTH = 3;

function getRandomLetters() {
  return LETTER_COMBINATIONS[
    Math.floor(Math.random() * LETTER_COMBINATIONS.length)
  ];
}

async function startWordWagerGame(
  channel,
  player1,
  player2,
  wager,
  player1Id,
  player2Id
) {
  const gameId = `${channel.id}-${Date.now()}`;
  const gameState = {
    players: [player1, player2],
    playerIds: [player1Id, player2Id],
    lives: [1, 1],
    currentPlayerIndex: 0,
    currentLetters: getRandomLetters(),
    wager: wager,
    usedWords: new Set(),
    attempts: 0,
    currentGameDuration: INITIAL_GAME_DURATION,
  };

  wordWagerGames.set(gameId, gameState);

  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("Word Wager Game Started!")
    .setDescription(`${gameState.players[0]}, it's your turn.`)
    .addFields(
      { name: "Letters", value: gameState.currentLetters, inline: true },
      { name: "Wager", value: `🪙${wager}`, inline: true },
      {
        name: "Time Limit",
        value: `${gameState.currentGameDuration / 1000} seconds`,
        inline: true,
      }
    )
    .setFooter({
      text: `Type a word (min ${MIN_WORD_LENGTH} letters) containing these letters in order.`,
    });

  await channel.send({ embeds: [embed] });
  await playWordWagerTurn(channel, gameId);
}
async function playWordWagerTurn(channel, gameId) {
  const gameState = wordWagerGames.get(gameId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  const filter = (m) => m.author.id === currentPlayer.id;

  const collector = channel.createMessageCollector({
    filter,
    time: gameState.currentGameDuration,
  });

  collector.on("collect", async (message) => {
    const response = message.content.trim().toUpperCase();

    if (isValidWord(response, gameState.currentLetters, gameState.usedWords)) {
      collector.stop("valid");
      gameState.usedWords.add(response);
      await channel.send(`Valid word: ${response}! Moving to the next player.`);
      gameState.currentPlayerIndex = 1 - gameState.currentPlayerIndex;
      gameState.currentLetters = getRandomLetters();
      gameState.attempts = 0;

      // Decrease the time limit for the next turn
      gameState.currentGameDuration = Math.max(
        gameState.currentGameDuration - TIME_DECREASE_PER_TURN,
        MIN_GAME_DURATION
      );

      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("Next Turn")
        .setDescription(
          `${gameState.players[gameState.currentPlayerIndex]}, it's your turn.`
        )
        .addFields(
          { name: "Letters", value: gameState.currentLetters, inline: true },
          {
            name: "Time Limit",
            value: `${gameState.currentGameDuration / 1000} seconds`,
            inline: true,
          }
        )
        .setFooter({
          text: `Type a word (min ${MIN_WORD_LENGTH} letters) containing these letters in order.`,
        });

      await channel.send({ embeds: [embed] });
      await playWordWagerTurn(channel, gameId);
    } else {
      gameState.attempts++;
      if (gameState.attempts >= MAX_ATTEMPTS) {
        collector.stop("max_attempts");
      } else {
        let errorMessage = `Invalid word. `;
        if (response.length < MIN_WORD_LENGTH) {
          errorMessage += `Words must be at least ${MIN_WORD_LENGTH} letters long. `;
        } else if (gameState.usedWords.has(response)) {
          errorMessage += `That word has already been used! `;
        } else {
          errorMessage += `You have ${
            MAX_ATTEMPTS - gameState.attempts
          } attempts left.`;
        }
        await channel.send(errorMessage);
      }
    }
  });

  collector.on("end", async (collected, reason) => {
    if (reason === "valid") return;

    await channel.send(`Time's up or max attempts reached! You lose a life.`);
    gameState.lives[gameState.currentPlayerIndex]--;
    if (gameState.lives[gameState.currentPlayerIndex] === 0) {
      endWordWagerGame(channel, gameId);
    } else {
      gameState.currentPlayerIndex = 1 - gameState.currentPlayerIndex;
      gameState.currentLetters = getRandomLetters();
      gameState.attempts = 0;

      const embed = new EmbedBuilder()
        .setColor("#ff9900")
        .setTitle("Life Lost - Next Turn")
        .setDescription(
          `${gameState.players[gameState.currentPlayerIndex]}, it's your turn.`
        )
        .addFields(
          { name: "Letters", value: gameState.currentLetters, inline: true },
          {
            name: "Time Limit",
            value: `${gameState.currentGameDuration / 1000} seconds`,
            inline: true,
          }
          // {
          //   name: "Lives",
          //   value: `${gameState.players[0]}: ${gameState.lives[0]} | ${gameState.players[1]}: ${gameState.lives[1]}`,
          //   inline: true,
          // }
        )
        .setFooter({
          text: `Type a word (min ${MIN_WORD_LENGTH} letters) containing these letters in order.`,
        });

      await channel.send({ embeds: [embed] });
      await playWordWagerTurn(channel, gameId);
    }
  });
}

function isValidWord(word, letters, usedWords) {
  if (word.length < MIN_WORD_LENGTH) return false;
  if (usedWords.has(word)) return false;
  if (!DICTIONARY.has(word)) return false;

  let letterIndex = 0;
  for (let char of word) {
    if (char === letters[letterIndex]) {
      letterIndex++;
      if (letterIndex === letters.length) return true;
    }
  }
  return false;
}

async function endWordWagerGame(channel, gameId) {
  const gameState = wordWagerGames.get(gameId);
  const winnerIndex = gameState.lives[0] > 0 ? 0 : 1;
  const loserIndex = 1 - winnerIndex;
  const winner = gameState.players[winnerIndex];
  const loser = gameState.players[loserIndex];

  // Transfer the wager
  await addBalance(gameState.playerIds[winnerIndex], gameState.wager);
  await addBalance(gameState.playerIds[loserIndex], -gameState.wager);

  const winnerNewBalance = await getBalance(gameState.playerIds[winnerIndex]);
  const loserNewBalance = await getBalance(gameState.playerIds[loserIndex]);

  const endGameEmbed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("Word Wager Game Over!")
    .setDescription(
      `${winner} wins and gets 🪙${gameState.wager} from ${loser}!`
    )
    .addFields(
      {
        name: `${winner.username}'s New Balance`,
        value: `🪙${winnerNewBalance}`,
        inline: true,
      },
      {
        name: `${loser.username}'s New Balance`,
        value: `🪙${loserNewBalance}`,
        inline: true,
      }
    )
    .setFooter({ text: "Thanks for playing Word Wager!" })
    .setTimestamp();

  await channel.send({ embeds: [endGameEmbed] });

  wordWagerGames.delete(gameId);
}

async function wipeServerData(guildId) {
  try {
    // Delete all user data for the specific guild
    await Users.destroy({
      where: {
        user_id: {
          [Op.like]: `%-${guildId}`,
        },
      },
    });

    // Delete all user items for the specific guild
    await UserItems.destroy({
      where: {
        user_id: {
          [Op.like]: `%-${guildId}`,
        },
      },
    });

    // Clear local caches for the specific guild
    for (const [userId, userData] of bankAccounts.entries()) {
      if (userId.endsWith(`-${guildId}`)) {
        bankAccounts.delete(userId);
        coinflipStats.delete(userId);
        hoboCooldowns.delete(userId);
        blackjackStats.delete(userId);
        dailyTransferLimits.delete(userId);
      }
    }

    console.log(`Server wipe successful for guild ${guildId}`);
  } catch (error) {
    console.error(`Error during server wipe for guild ${guildId}:`, error);
    throw error;
  }
}

function applyPrinterCapacityPassive(capacity, level) {
  if (level >= 50) {
    return Math.floor(capacity * 1.1); // 10% increase
  }
  return capacity;
}

function applyPrinterSpeedPassive(interval, level) {
  if (level >= 100) {
    return interval * 0.9; // 10% quicker
  }
  return interval;
}

const PRESTIGE_SHOP_ITEMS = [
  {
    id: "income_boost",
    name: "Income Boost",
    description:
      "Permanently increase all income sources by 10% (including gambling)",
    cost: 1,
    maxLevel: 1,
  },
  {
    id: "interest_rate",
    name: "Interest Rate Boost",
    description: "Permanently increase interest rate by 5%",
    cost: 1,
    maxLevel: 1,
  },
  {
    id: "printer_efficiency",
    name: "Printer Efficiency",
    description: "Permanently increase printer output by 20%",
    cost: 1,
    maxLevel: 1,
  },
  {
    id: "printer_capacity",
    name: "Printer Capacity",
    description: "Permanently increase printer capacity by 50%",
    cost: 1,
    maxLevel: 1,
  },
  {
    id: "gambling_passive",
    name: "Gambling Passive",
    description: "Gain an additional 1% chance to nullify gambling losses",
    cost: 1,
    maxLevel: 1,
  },
  {
    id: "heist_protection",
    name: "Heist Protection",
    description: "Gain an additional 8 hours on your heist protection shield",
    cost: 1,
    maxLevel: 1,
  },
];

function calculateHeistProtectionDuration(targetLevel, prestigeUpgrades) {
  let protectionPeriod =
    targetLevel >= 250 ? 12 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;

  // Apply prestige heist protection upgrade
  const heistProtectionLevel = prestigeUpgrades.heist_protection || 0;
  protectionPeriod += 8 * 60 * 60 * 1000 * heistProtectionLevel; // Additional 4 hours per level

  return protectionPeriod;
}

async function getUserPrestigeUpgradesFromId(userId) {
  const user = await Users.findOne({ where: { user_id: userId } });
  if (!user) throw new Error("User not found");
  let userUpgrades = user.prestige_upgrades;
  if (typeof userUpgrades === "string") {
    try {
      userUpgrades = JSON.parse(userUpgrades);
    } catch (e) {
      console.error("Error parsing prestige_upgrades:", e);
      userUpgrades = {};
    }
  }
  return userUpgrades;
}

// Function to get prestige shop items with user's current levels
async function getPrestigeShopItems(userId) {
  const userUpgrades = await getUserPrestigeUpgradesFromId(userId);
  const user = await Users.findOne({ where: { user_id: userId } });

  return PRESTIGE_SHOP_ITEMS.map((item) => {
    const currentLevel = userUpgrades[item.id] || 0;
    console.log("user upgrades", userUpgrades);
    console.log("item", item);
    const isMaxLevel = currentLevel >= item.maxLevel;
    let statusDisplay;

    if (isMaxLevel) {
      statusDisplay = `✨ MAX LEVEL (${currentLevel}/${item.maxLevel}) ✨`;
    } else if (user.prestige_tokens > user.prestige_tokens_used) {
      statusDisplay = `✅ Available (${currentLevel}/${item.maxLevel})`;
    } else {
      statusDisplay = `❌ Unavailable (${currentLevel}/${item.maxLevel})`;
    }

    return {
      ...item,
      currentLevel,
      canPurchase:
        !isMaxLevel && user.prestige_tokens > user.prestige_tokens_used,
      statusDisplay,
    };
  });
}

async function purchasePrestigeItem(userId, itemId) {
  const user = await Users.findOne({ where: { user_id: userId } });
  if (!user) throw new Error("User not found");

  const item = PRESTIGE_SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) throw new Error("Item not found");

  let userUpgrades = await getUserPrestigeUpgradesFromId(userId);
  if (typeof userUpgrades === "string") {
    try {
      userUpgrades = JSON.parse(userUpgrades);
    } catch (e) {
      console.error("Error parsing prestige_upgrades:", e);
      userUpgrades = {};
    }
  }

  const currentLevel = userUpgrades[itemId] || 0;

  if (currentLevel >= item.maxLevel) {
    throw new Error("Item is already at max level");
  }

  if (user.prestige_tokens - user.prestige_tokens_used < item.cost) {
    throw new Error("Not enough unused prestige tokens");
  }

  // Update user's upgrades and tokens
  userUpgrades[itemId] = currentLevel + 1;
  await Users.update(
    {
      prestige_upgrades: JSON.stringify(userUpgrades),
      prestige_tokens_used: user.prestige_tokens_used + item.cost,
    },
    { where: { user_id: userId } }
  );

  return {
    message: `Successfully purchased ${item.name}`,
    newLevel: currentLevel + 1,
  };
}

async function handlePrestigeShop(context) {
  const isInteraction = context.isButton || context.isStringSelectMenu;
  const userId = createCombinedId(
    isInteraction ? context.user.id : context.author.id,
    isInteraction ? context.guild.id : context.guild.id
  );

  const user = await Users.findOne({ where: { user_id: userId } });

  if (!user) {
    throw new Error("User not found. Please try again.");
  }

  const shopItems = await getPrestigeShopItems(userId);

  const embed = new EmbedBuilder()
    .setColor("#800080")
    .setTitle("🌟 Prestige Shop")
    .setDescription("Spend your prestige tokens on permanent upgrades!")
    .addFields(
      {
        name: "Available Tokens",
        value: `${user.prestige_tokens - user.prestige_tokens_used}`,
        inline: true,
      },
      { name: "Total Tokens", value: `${user.prestige_tokens}`, inline: true }
    );

  shopItems.forEach((item) => {
    embed.addFields({
      name: `${item.name} (Level ${item.currentLevel}/${item.maxLevel})`,
      value: `${item.description}\n\`\`\`${item.statusDisplay}\`\`\``,
    });
  });

  const viewButton = new ButtonBuilder()
    .setCustomId("prestige_upgrades")
    .setLabel("View/Buy Upgrades")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(viewButton);

  return { embeds: [embed], components: [row] };
}

function getUpgradeEmoji(upgradeId) {
  const emojiMap = {
    income_boost: "💰",
    interest_rate: "📈",
    printer_efficiency: "⚡",
    printer_capacity: "📦",
    gambling_passive: "🎲",
    heist_protection: "🛡️",
  };
  return emojiMap[upgradeId] || "🌟";
}

async function applyGamblingIncomeBoost(userId, amount) {
  const prestigeUpgrades = await getUserPrestigeUpgradesFromId(userId);
  const incomeBoostLevel = prestigeUpgrades.income_boost || 0;
  const boost = 1 + 0.1 * incomeBoostLevel; // 5% increase per level

  return Math.floor(amount * boost);
}

function updateBalanceEmbedFields(
  embed,
  newBalance,
  updatedPrinterMoney = null
) {
  // Update the wallet balance
  const walletField = embed.data.fields.find(
    (field) => field.name === "Wallet"
  );
  if (walletField) {
    walletField.value = `🪙 ${newBalance.toLocaleString()}`;
  }

  // Update the total balance
  const totalField = embed.data.fields.find((field) => field.name === "Total");
  if (totalField) {
    const bankBalance =
      embed.data.fields
        .find((field) => field.name === "Bank")
        ?.value.replace(/[^0-9]/g, "") || 0;
    totalField.value = `🪙 ${(
      newBalance + parseInt(bankBalance)
    ).toLocaleString()}`;
  }

  // Update printer information if provided
  if (updatedPrinterMoney && updatedPrinterMoney.printerDetails.length > 0) {
    const printerFields = embed.data.fields.filter(
      (field) => field.name === "Money Printers" || field.name === "\u200b"
    );

    if (printerFields.length === 2) {
      const formattedPrinterInfo = formatPrinterInfo(
        updatedPrinterMoney.printerDetails
      );
      const printerInfoLines = formattedPrinterInfo.split("\n");

      // Split the printer info into two columns
      const midPoint = Math.ceil(printerInfoLines.length / 2);
      const firstColumnInfo = printerInfoLines.slice(0, midPoint).join("\n");
      const secondColumnInfo = printerInfoLines.slice(midPoint).join("\n");

      printerFields[0].value = firstColumnInfo || "No printers available";
      printerFields[1].value = secondColumnInfo || "\u200b";
    }

    // Update collectable printer money
    const collectableField = embed.data.fields.find(
      (field) => field.name === "Collectable Printer Money"
    );
    if (collectableField) {
      collectableField.value = `🪙 ${Math.floor(
        updatedPrinterMoney.totalReady
      )}`;
    }
  }
}

function formatPrinterInfo(printerDetails) {
  return printerDetails
    .map((printer) => {
      const icon = getPrinterIcon(printer.name);
      const name = `${icon} ${printer.name}`;

      const formatBoost = (value, boost) => {
        return boost > 0 ? `${value} (+${boost}%)` : value;
      };

      return [
        `**${name}**`,
        `Generated: 🪙 ${printer.generated.toLocaleString()} / ${formatBoost(
          printer.capacity.toLocaleString(),
          printer.capacityBoost
        )}`,
        `Rate: 💰 ${formatBoost(
          printer.outputPerCycle.toLocaleString() + "/cycle",
          printer.outputBoost
        )}`,
        `Interval: ⏳ ${formatBoost(
          formatTime(printer.interval),
          printer.speedBoost
        )}`,
        "", // Add an empty line for spacing between printers
      ].join("\n");
    })
    .join("\n");
}

async function createRocketLaunchEmbed(game, isCashedOut = false) {
  const embed = new EmbedBuilder()
    .setColor(
      isCashedOut || game.cashed_out
        ? "#00ff00"
        : game.crashed
        ? "#ff0000"
        : "#0099ff"
    )
    .setTitle("🚀 Rocket Launch")
    .addFields(
      { name: "Bet Amount", value: `🪙${game.betAmount}`, inline: true },
      {
        name: "Multiplier",
        value: `${game.multiplier.toFixed(2)}x`,
        inline: true,
      }
    );

  if (game.crashed) {
    embed.setDescription("💥 Rocket crashed!").addFields(
      { name: "Result", value: "You lost your bet.", inline: false },
      {
        name: "Crash Point",
        value: `${game.crashPoint.toFixed(2)}x`,
        inline: true,
      }
    );
  } else if (isCashedOut || game.cashed_out) {
    const totalPayout = Math.floor(game.betAmount * game.multiplier);
    const profit = totalPayout - game.betAmount;
    const boostedProfit = await applyGamblingIncomeBoost(game.userId, profit);
    embed.setDescription("🎉 Successfully cashed out!").addFields(
      { name: "Profit", value: `🪙${boostedProfit}`, inline: true },
      {
        name: "Crash Point",
        value: `${game.crashPoint.toFixed(2)}x`,
        inline: true,
      }
    );
  } else {
    const potentialPayout = Math.floor(game.betAmount * game.multiplier);
    embed
      .setDescription("Rocket is launching! 🚀")
      .addFields({
        name: "Potential Payout",
        value: `🪙${potentialPayout}`,
        inline: true,
      })
      .setFooter({ text: "Cash out before the rocket crashes!" });
  }

  return embed;
}

function createRocketLaunchButtons(disabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cashout")
      .setLabel("Cash Out")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

async function runRocketLaunch(userId) {
  const game = activeGames.get(userId);
  if (!game || game.crashed || game.cashed_out) return;

  game.multiplier += 0.1; // Increase by 0.1x each tick

  if (game.multiplier >= game.crashPoint) {
    game.crashed = true;
    const embed = await createRocketLaunchEmbed(game);
    const buttons = createRocketLaunchButtons(true);
    await game.message.edit({ embeds: [embed], components: [buttons] });

    // Apply loss prevention passive
    const isLossPrevented = await applyGamblingPassive(userId);
    if (isLossPrevented) {
      // If loss is prevented, refund the bet amount
      await addBalance(userId, game.betAmount);
      const preventionEmbed = new EmbedBuilder()
        .setColor("#FFFF00")
        .setTitle("🎲 Loss Prevention Activated!")
        .setDescription("Your gambling passive has prevented this loss!")
        .addFields(
          {
            name: "Bet Amount Saved",
            value: `🪙${game.betAmount}`,
            inline: true,
          },
          {
            name: "Crash Point",
            value: `${game.crashPoint.toFixed(2)}x`,
            inline: true,
          }
        );
      await game.message.reply({ embeds: [preventionEmbed] });
    }

    activeGames.delete(userId);
    return;
  }

  const embed = await createRocketLaunchEmbed(game);
  await game.message.edit({ embeds: [embed] });

  setTimeout(() => runRocketLaunch(userId), TICK_RATE);
}

async function startRocketLaunch(userId, betAmount, message) {
  const crashPoint = calculateCrashPoint();
  const game = {
    userId,
    betAmount,
    multiplier: 1,
    crashed: false,
    cashed_out: false,
    message: null,
    crashPoint: crashPoint,
  };

  activeGames.set(userId, game);

  const embed = await createRocketLaunchEmbed(game);
  const buttons = createRocketLaunchButtons(false);

  return message.reply({ embeds: [embed], components: [buttons] });
}
function calculateCrashPoint() {
  const r = Math.random();
  let crashPoint = 100 / (100 * r);

  // Round to the nearest 0.1
  crashPoint = Math.round(crashPoint * 10) / 10;

  // Limit the maximum crash point to 100x for practicality
  return Math.min(Math.max(1, crashPoint), 100);
}

async function checkUnlockedPassives(userId, oldLevel, newLevel) {
  const newlyUnlockedPassives = ALL_PASSIVES.filter(
    (passive) => passive.level > oldLevel && passive.level <= newLevel
  );

  if (newlyUnlockedPassives.length > 0) {
    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("🎉 New Passive(s) Unlocked!")
      .setDescription(
        `Congratulations! You've reached level ${newLevel} and unlocked new passive(s):`
      )
      .addFields(
        newlyUnlockedPassives.map((passive) => ({
          name: `Level ${passive.level} Passive`,
          value: passive.description,
        }))
      )
      .setFooter({ text: "Keep leveling up to unlock more passives!" })
      .setTimestamp();

    const channel = await getAppropriateChannel(userId);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  }
}

async function getAppropriateChannel(userId) {
  return userLastChannel.get(userId) || null;
}
