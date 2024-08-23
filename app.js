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

const bankAccounts = new Collection();
const workCooldowns = new Collection();
const interestCooldowns = new Collection();
const crimeCooldowns = new Collection();
const robCooldowns = new Map();
const coinflipStats = new Map();
const dailyCooldowns = new Map();
const hoboCooldowns = new Map();
const blackjackStats = new Map();

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
  "Titanium Printer",
  "Diamond Printer",
  "Quantum Printer",
  "Neutronium Printer",
];

async function handleDaily(message) {
  const userId = message.author.id;
  const now = Date.now();
  const cooldownAmount = 16 * 60 * 60 * 1000; // 16 hours in milliseconds
  const dailyAmount = Math.floor(Math.random() * (400 - 100 + 1)) + 700;

  if (dailyCooldowns.has(userId)) {
    const expirationTime = dailyCooldowns.get(userId) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
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

      // Delete the message after 5 seconds
      setTimeout(() => {
        sentMessage.delete().catch(console.error);
      }, 5000);

      return;
    }
  }

  await addBalance(userId, dailyAmount);
  dailyCooldowns.set(userId, now);

  const newBalance = await getBalance(userId);

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
    const userId = message.author.id;
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
function updateCrimeCooldown(userId) {
  const now = Date.now();
  const cooldownAmount = 3 * 60 * 60 * 1000;

  if (crimeCooldowns.has(userId)) {
    const expirationTime = crimeCooldowns.get(userId) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000 / 60; // Convert to minutes
      return Math.round(timeLeft);
    }
  }

  crimeCooldowns.set(userId, now);
  return 0;
}

function updateRobCooldown(userId) {
  const now = Date.now();
  const cooldownAmount = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

  if (robCooldowns.has(userId)) {
    const expirationTime = robCooldowns.get(userId) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000 / 60 / 60; // Convert to hours
      return Math.round(timeLeft * 10) / 10; // Round to 1 decimal place
    }
  }

  robCooldowns.set(userId, now);
  return 0;
}

async function rob(robberId, targetId) {
  const target = await getFullBalance(targetId);
  const robber = await getFullBalance(robberId);

  if (target.wallet < 50) {
    return {
      success: false,
      message: "The target doesn't have enough money to rob.",
    };
  }

  const successChance = 0.9;
  if (Math.random() < successChance) {
    const minAmount = target.wallet * 0.25;
    const maxAmount = target.wallet * 0.6;
    const stolenAmount =
      Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
    await addBalance(robberId, stolenAmount);
    await addBalance(targetId, -stolenAmount);
    return {
      success: true,
      amount: stolenAmount,
      message: `You successfully robbed 🪙 ${stolenAmount}!`,
    };
  } else {
    const penalty = Math.floor(robber.wallet * 0.1); // Lose 10% of your wallet if caught
    await addBalance(robberId, -penalty);
    return {
      success: false,
      amount: penalty,
      message: `You were caught and fined 🪙 ${penalty}!`,
    };
  }
}

function updateWorkCooldown(userId) {
  const now = Date.now();
  const cooldownAmount = 60 * 60 * 1000; // 1 hour in milliseconds

  if (workCooldowns.has(userId)) {
    const expirationTime = workCooldowns.get(userId) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000 / 60; // Convert to minutes
      return Math.round(timeLeft);
    }
  }

  workCooldowns.set(userId, now);
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

  const now = Date.now();
  const interestPeriodHours = 1;
  const interestRate = 0.5; // 0.5% per hour

  let lastInterestTime = interestCooldowns.get(userId) || account.lastInterest;

  if (!lastInterestTime) {
    lastInterestTime = timeStarted;
    interestCooldowns.set(userId, lastInterestTime);
  }

  const hoursPassed = (now - lastInterestTime) / (1000 * 60 * 60);
  const periodsPassed = Math.floor(hoursPassed / interestPeriodHours);

  let newInterest = 0;
  let totalAccumulatedInterest = fullBalance.accumulatedInterest || 0;

  if (periodsPassed > 0) {
    newInterest = Math.floor(
      (account.bank_balance || 0) * (interestRate / 100) * periodsPassed
    );

    // Update last interest time
    lastInterestTime =
      now - (hoursPassed % interestPeriodHours) * 60 * 60 * 1000;
    interestCooldowns.set(userId, lastInterestTime);

    totalAccumulatedInterest += newInterest;

    // Update database
    await Users.update(
      { accumulated_interest: totalAccumulatedInterest },
      { where: { user_id: userId } }
    );
  }

  const nextInterestTime =
    lastInterestTime + interestPeriodHours * 60 * 60 * 1000;
  const minutesRemaining = Math.max(
    0,
    Math.ceil((nextInterestTime - now) / (1000 * 60))
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
    user.balance += Number(amount);

    // Update database
    await Users.update({ balance: user.balance }, { where: { user_id: id } });

    return user;
  }

  const newUser = await Users.create({
    user_id: id,
    balance: amount,
    bank_balance: 0,
  });
  bankAccounts.set(id, newUser);
  return newUser;
}

async function addBankBalance(id, amount) {
  const user = bankAccounts.get(id);
  if (user) {
    user.bank_balance += Number(amount);

    // Update database
    await Users.update(
      { bank_balance: user.bank_balance },
      { where: { user_id: id } }
    );

    return user;
  }

  const newUser = await Users.create({
    user_id: id,
    balance: 0,
    bank_balance: amount,
  });
  bankAccounts.set(id, newUser);
  return newUser;
}

async function getFullBalance(userId) {
  const [user] = await Users.findOrCreate({
    where: { user_id: userId },
    defaults: {
      balance: 0,
      bank_balance: 0,
      accumulated_interest: 0,
    },
  });

  // Initialize bank account if it doesn't exist
  if (!bankAccounts.has(userId)) {
    bankAccounts.set(userId, {
      balance: user.balance || 0,
      bank_balance: user.bank_balance || 0,
      lastInterest: Date.now(),
      accumulatedInterest: user.accumulated_interest,
    });
  }

  return {
    wallet: user.balance || 0,
    bank: user.bank_balance || 0,
    accumulatedInterest: user.accumulated_interest,
  };
}

async function getBalance(userId) {
  const user = bankAccounts.get(userId);
  return user ? user.balance : 0;
}

async function getBankBalance(userId) {
  const user = bankAccounts.get(userId);
  return user ? user.bank_balance : 0;
}

initializeBankAccounts();

client.login(
  "MTI3MzkzMTM0MjQ2MzIzODIxOA.GPcdim.KWlQvIrTJLtob2hm6Zl6yE8_PMFJuDpkO_7LLs"
);

let timeStarted;

client.once(Events.ClientReady, async () => {
  console.log("Ready!");
  const storedBalances = await Users.findAll();

  timeStarted = Date.now();

  for (const b of storedBalances) {
    try {
      const user = await client.users.fetch(b.user_id);
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

  if (commandName === "inventory") {
    const target = message.mentions.users.first() || message.author;
    const user = await Users.findOne({ where: { user_id: target.id } });
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
      where: { user_id: message.author.id },
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
  } else if (commandName === "buy") {
    const itemName = args.join(" ");
    const user = await getFullBalance(message.author.id);
    if (!itemName) {
      return message.reply("Please specify an item to buy.");
    }

    const item = await CurrencyShop.findOne({
      where: { name: { [Op.like]: itemName } },
    });
    if (!item) {
      return message.reply("That item doesn't exist.");
    }

    if (item.cost > user.bank) {
      return message.reply(
        `You currently have 🪙${user.bank_balance}, but the ${item.name} costs 🪙${item.cost}!`
      );
    }

    // Check if the item is a printer
    const isPrinter = allPrinters.includes(item.name);

    if (isPrinter) {
      // Check if the user already owns this type of printer
      const existingPrinter = await UserItems.findOne({
        where: { user_id: message.author.id, item_id: item.id },
      });

      if (existingPrinter) {
        return message.reply(
          `You already own a ${item.name}. You can only have one of each type of printer.`
        );
      }
    }

    await addBankBalance(message.author.id, -item.cost);

    const userItem = await UserItems.findOne({
      where: { user_id: message.author.id, item_id: item.id },
    });

    if (userItem) {
      await userItem.increment("amount");
    } else {
      await UserItems.create({
        user_id: message.author.id,
        item_id: item.id,
        amount: 1,
      });
    }

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("Purchase Successful!")
      .setDescription(`You've bought: ${item.name}`)
      .addFields(
        { name: "Cost", value: `🪙${item.cost}`, inline: true },
        {
          name: "New Bank Balance",
          value: `🪙${(user.bank - item.cost).toLocaleString()}`,
          inline: true,
        }
      )
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
  if (commandName === "leaderboard" || commandName === "lb") {
    const topUsers = await getTopUsers(true); // Default to net worth
    const embed = createLeaderboardEmbed(topUsers, true);
    const row = createLeaderboardButtons(true);

    return message.reply({ embeds: [embed], components: [row] });
  } // Updated work command
  else if (commandName === "work") {
    const cooldownLeft = updateWorkCooldown(message.author.id);

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
    const addAmount = Math.floor(Math.random() * (300 - 100 + 1)) + 250;
    await addBalance(message.author.id, addAmount);
    const newBalance = await getBalance(message.author.id);
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
    const cooldownLeft = updateCrimeCooldown(message.author.id);

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
      const addAmount = Math.floor(Math.random() * 600) + 450; // Higher risk, higher reward
      await addBalance(message.author.id, addAmount);
      const newBalance = await getBalance(message.author.id);
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
      await addBalance(message.author.id, -loseAmount);
      const newBalance = await getBalance(message.author.id);
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
    const walletBalance = await getBalance(message.author.id);
    const amount =
      args[0]?.toLowerCase() === "all" ? walletBalance : parseInt(args[0]);

    if (args[0]?.toLowerCase() !== "all" && (isNaN(amount) || amount <= 0)) {
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
      const response = await deposit(message.author.id, amount);

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
    const account = await getFullBalance(message.author.id);

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
      const response = await withdraw(message.author.id, amount);
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
      const targetUser = message.mentions.users.first() || message.author;
      const account = await getFullBalance(targetUser.id);
      const interestInfo = await calculateInterest(targetUser.id);
      const printers = await getUserPrinters(targetUser.id);
      const printerMoney = await calculatePrinterMoney(printers);

      if (account && interestInfo) {
        const embed = new EmbedBuilder()
          .setColor("#3498db")
          .setTitle(`🏦 Balance - ${targetUser.username}`)
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
            }
          )
          .setFooter({ text: "Azus Bot • Use buttons below to collect" })
          .setTimestamp();

        if (
          account.accumulatedInterest > 0 ||
          interestInfo.accumulatedInterest > 0
        ) {
          embed.addFields({
            name: "Collectable Interest",
            value: `🪙 ${interestInfo.accumulatedInterest.toLocaleString()}`,
            inline: true,
          });
        }

        if (printers.length > 0) {
          const printerInfo = printerMoney.printerDetails
            .map((p) => {
              const name = `${p.name}`;
              const generated = `🪙 ${p.generated.toLocaleString()} / ${p.capacity.toLocaleString()}`;
              const rate = `💰 ${p.outputPerCycle.toLocaleString()}/cycle`;
              const interval = `⏱️ ${formatTime(p.interval)}`;

              return [
                `__**${name}**__`,
                `Generated: ${generated}`,
                `Rate: ${rate}`,
                `Interval: ${interval}`,
                "", // Add an empty line for spacing between printers
              ].join("\n");
            })
            .join("\n");

          embed.addFields({
            name: "Money Printers",
            value: printerInfo || "No printers available",
            inline: false,
          });

          embed.addFields({
            name: "Total Ready to Collect",
            value: `🪙 ${Math.floor(printerMoney.totalReady)}`,
            inline: false,
          });
        }

        const isOwnAccount = targetUser.id === message.author.id;

        if (isOwnAccount) {
          const collectButton = new ButtonBuilder()
            .setCustomId("collect_interest")
            .setLabel("Collect Interest")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(interestInfo.accumulatedInterest <= 0);

          const collectPrintersButton = new ButtonBuilder()
            .setCustomId("collect_printers")
            .setLabel("Collect Printers")
            .setStyle(ButtonStyle.Success)
            .setDisabled(printerMoney.totalReady <= 0);

          const row = new ActionRowBuilder().addComponents(
            collectButton,
            collectPrintersButton
          );

          message.reply({ embeds: [embed], components: [row] });
        } else {
          message.reply({ embeds: [embed] });
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

    if (target.id === message.author.id) {
      return message.reply("You can't rob yourself!");
    }

    const cooldownLeft = updateRobCooldown(message.author.id);

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

    try {
      const result = await rob(message.author.id, target.id);
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
    const balance = await getBalance(message.author.id);
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
    const balance = await getFullBalance(message.author.id);

    if (balance.wallet + balance.bank > 100) {
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

    const cooldownLeft = updateHoboCooldown(message.author.id);

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

    const earnedAmount = Math.floor(Math.random() * (150 - 50 + 1)) + 50;
    await addBalance(message.author.id, earnedAmount);

    // Update cooldown only after successful execution
    updateHoboCooldown(message.author.id);

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("Hobo Begging")
      .setDescription(`You begged on the streets and earned 🪙${earnedAmount}`)
      .addFields({
        name: "New Balance",
        value: `🪙${earnedAmount.toLocaleString()}`,
        inline: true,
      })
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  } else if (commandName === "transfer") {
    const recipient = message.mentions.users.first();
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

    if (recipient.id === message.author.id) {
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
        amount = await getBalance(message.author.id);
      } else {
        amount = parseInt(amountArg);
        if (isNaN(amount) || amount <= 0) {
          throw new Error(
            "Invalid amount. Please specify a valid number or 'all'."
          );
        }
      }

      const result = await transferMoney(
        message.author.id,
        recipient.id,
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
      .setDescription("Here's a list of available commands:")
      .addFields(
        {
          name: "!balance (or !bal)",
          value: "Check your balance",
          inline: true,
        },
        { name: "!work", value: "Earn money by working", inline: true },
        {
          name: "!crime",
          value: "Attempt a crime for money (risky)",
          inline: true,
        },
        {
          name: "!deposit <amount>",
          value: "Deposit money into your bank",
          inline: true,
        },
        {
          name: "!withdraw <amount>",
          value: "Withdraw money from your bank",
          inline: true,
        },
        {
          name: "!transfer @user <amount>",
          value: "Transfer money to another user",
          inline: true,
        },
        {
          name: "!rob @user",
          value: "Attempt to rob another user",
          inline: true,
        },
        { name: "!shop", value: "View the item shop", inline: true },
        {
          name: "!buy <item>",
          value: "Purchase an item from the shop",
          inline: true,
        },
        {
          name: "!upgrade <printer>",
          value: "Upgrade your printer for more money",
          inline: true,
        },
        { name: "!inventory", value: "View your inventory", inline: true },
        {
          name: "!leaderboard (or !lb)",
          value: "View the richest users",
          inline: true,
        },
        {
          name: "!blackjack <bet> (or !bj)",
          value: "Play a game of blackjack",
          inline: true,
        },
        {
          name: "!coinflip <bet> (or !cf)",
          value: "Flip a coin and bet on the outcome",
          inline: true,
        },
        { name: "!daily", value: "Collect your daily reward", inline: true },
        {
          name: "!hobo",
          value: "Beg for money when you're broke",
          inline: true,
        },
        { name: "!slots <bet>", value: "Play the slot machine", inline: true },
        {
          name: "!slotspayout",
          value: "View the payout table for slots",
          inline: true,
        }
      )
      .setFooter({ text: "Azus Bot" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
  if (commandName === "slots") {
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
  }
  if (commandName === "upgrade") {
    let printerName = args.join(" ");
    printerName = args
      .map((arg) => arg.charAt(0).toUpperCase() + arg.slice(1))
      .join(" ");

    if (!printerName) {
      return message.reply("Usage: !upgrade [printer name]");
    }

    const user = await Users.findOne({ where: { user_id: message.author.id } });
    const printer = await UserItems.findOne({
      where: { user_id: message.author.id },
      include: [
        {
          model: CurrencyShop,
          as: "item",
          where: { name: printerName, type: "printer" },
        },
      ],
    });

    if (!printer) {
      return message.reply("You don't own that printer or it doesn't exist.");
    }

    const { embed, row } = await createUpgradeEmbed(printer, user);

    return message.reply({ embeds: [embed], components: [row] });
  }
});

// Add this interaction handler for the Collect Interest button

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
  return suits.flatMap((suit) => values.map((value) => ({ suit, value })));
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
  let value = hand.reduce((total, card) => total + getCardValue(card), 0);
  const aces = hand.filter((card) => card.value === "A").length;
  for (let i = 0; i < aces; i++) {
    if (value > 21) value -= 10;
  }
  return value;
}

function dealCard(deck) {
  return deck.pop();
}

function playDealer(deck, dealerHand) {
  while (calculateHandValue(dealerHand) < 18) {
    dealerHand.push(dealCard(deck));
  }
}

function createCardEmoji(card) {
  const suitEmojis = { "♠": "♠️", "♥": "♥️", "♦": "♦️", "♣": "♣️" };
  return `${card.value}${suitEmojis[card.suit]}`;
}

function updateWinStreak(userId, won) {
  const userStats = blackjackStats.get(userId) || {
    winStreak: 0,
    multiplier: 1,
  };
  if (won) {
    userStats.winStreak++;
    userStats.multiplier = Math.min(1 + userStats.winStreak * 0.1, 2); // Cap at 2x
  } else {
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
  const playerValue = calculateHandValue(playerHand);
  const dealerValue = showDealerCard
    ? calculateHandValue(dealerHand)
    : getCardValue(dealerHand[0]);

  return new EmbedBuilder()
    .setColor("#2C2F33")
    .setTitle("Blackjack")
    .setDescription(
      "Hit - Take another card\nStand - End the game\nDouble Down - Double your bet and take one more card\nSplit - Split your hand if you have two cards of the same value"
    )
    .addFields(
      {
        name: "Your Hand",
        value: playerHand.map(createCardEmoji).join(" ") + ` (${playerValue})`,
        inline: true,
      },
      {
        name: "Dealer Hand",
        value: showDealerCard
          ? dealerHand.map(createCardEmoji).join(" ") + ` (${dealerValue})`
          : `${createCardEmoji(dealerHand[0])} 🂠 (${dealerValue})`,
        inline: true,
      },
      { name: "\u200B", value: "\u200B" },
      { name: "Your Value", value: playerValue.toString(), inline: true },
      { name: "Dealer Value", value: dealerValue.toString(), inline: true },
      { name: "Bet", value: `🪙${bet}`, inline: true },
      {
        name: "Win Streak",
        value: userStats.winStreak.toString(),
        inline: true,
      },
      {
        name: "Multiplier",
        value: userStats.multiplier.toFixed(1) + "x",
        inline: true,
      }
    );
}

function createSplitEmbed(hands, dealerHand, userStats, bets) {
  const embed = new EmbedBuilder()
    .setColor("#2C2F33")
    .setTitle("Blackjack - Split Hands")
    .setDescription("You've split your hand. Play each hand separately.");

  hands.forEach((hand, index) => {
    const handValue = calculateHandValue(hand);
    embed.addFields({
      name: `Hand ${index + 1}`,
      value: hand.map(createCardEmoji).join(" ") + ` (${handValue})`,
      inline: true,
    });
  });

  const dealerValue = getCardValue(dealerHand[0]);
  embed.addFields(
    {
      name: "Dealer Hand",
      value: `${createCardEmoji(dealerHand[0])} 🂠 (${dealerValue})`,
      inline: false,
    },
    {
      name: "Bets",
      value: bets.map((bet) => `🪙${bet}`).join(", "),
      inline: true,
    },
    {
      name: "Win Streak",
      value: userStats.winStreak.toString(),
      inline: true,
    },
    {
      name: "Multiplier",
      value: userStats.multiplier.toFixed(1) + "x",
      inline: true,
    }
  );

  return embed;
}

async function createFinalEmbed(
  results,
  dealerHand,
  userStats,
  totalPayout,
  initialBet,
  userId
) {
  const allPlayersBusted = results.every((result) => result.busted);
  const dealerValue = allPlayersBusted
    ? getCardValue(dealerHand[0])
    : calculateHandValue(dealerHand);
  const newBalance = await getBalance(userId);

  const embed = new EmbedBuilder()
    .setColor(
      totalPayout > 0 ? "#00ff00" : totalPayout < 0 ? "#ff0000" : "#ffff00"
    )
    .setTitle("Blackjack Result")
    .addFields({
      name: "Dealer Hand",
      value: allPlayersBusted
        ? `${createCardEmoji(dealerHand[0])} 🂠 (${dealerValue})`
        : dealerHand.map(createCardEmoji).join(" ") + ` (${dealerValue})`,
      inline: false,
    });

  results.forEach((result, index) => {
    const playerValue = calculateHandValue(result.hand);
    const handName =
      results.length > 1 ? `Your Hand ${index + 1}` : "Your Hand";
    embed.addFields(
      {
        name: `${handName}${result.doubledDown ? " (Doubled)" : ""}`,
        value: result.hand.map(createCardEmoji).join(" ") + ` (${playerValue})`,
        inline: true,
      },
      { name: "Result", value: result.result, inline: true },
      {
        name: "Payout",
        value: `🪙 ${Math.abs(result.payout).toLocaleString()}`,
        inline: true,
      }
    );
  });

  embed
    .addFields(
      {
        name: "Initial Bet",
        value: `🪙 ${initialBet.toLocaleString()}`,
        inline: true,
      },
      {
        name: "Total Payout",
        value: `🪙 ${Math.abs(totalPayout).toLocaleString()}`,
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
        value: userStats.multiplier.toFixed(1) + "x",
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

function canSplit(card1, card2) {
  return card1.value === card2.value;
}

async function playBlackjack(message, initialBet) {
  const userId = message.author.id;
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
  if (calculateHandValue(hands[0]) === 21) {
    const blackjackPayout = Math.floor(initialBet * 2.5 * userStats.multiplier);
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

  const filter = (i) =>
    i.user.id === userId && i.customId.startsWith("blackjack_");
  const collector = gameMessage.createMessageComponentCollector({
    filter,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    switch (i.customId) {
      case "blackjack_hit":
        hands[currentHandIndex].push(dealCard(deck));
        if (calculateHandValue(hands[currentHandIndex]) >= 21) {
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
        if (splitCount >= 3) {
          await i.reply({
            content: "You can only split up to 3 times.",
            ephemeral: true,
          });
          return;
        }
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
      const playerValue = calculateHandValue(hands[i]);
      let result;
      let payout;

      if (playerValue > 21) {
        result = "You bust! You lose!";
        payout = -bets[i];
      } else {
        // Only play the dealer's hand if the player hasn't busted
        if (i === hands.length - 1) {
          playDealer(deck, dealerHand);
        }
        const dealerValue = calculateHandValue(dealerHand);

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
        payout *= userStats.multiplier;
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
    updateWinStreak(userId, totalPayout > 0);

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

// Add this to your interaction handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (
    interaction.customId === "leaderboard_net_worth" ||
    interaction.customId === "leaderboard_total_cash"
  ) {
    const showNetWorth = interaction.customId === "leaderboard_net_worth";
    const topUsers = await getTopUsers(showNetWorth);
    const embed = createLeaderboardEmbed(topUsers, showNetWorth);
    const row = createLeaderboardButtons(showNetWorth);

    await interaction.update({ embeds: [embed], components: [row] });
  }

  if (interaction.customId === "collect_printers") {
    try {
      const userId = interaction.user.id;
      const collectedAmount = await collectPrinterMoney(userId);
      const newBalance = await getBalance(userId);

      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("Printer Money Collected!")
        .setDescription(
          `You've collected 🪙 ${collectedAmount} from your printers.`
        )
        .addFields({
          name: "New Balance",
          value: `🪙 ${newBalance.toLocaleString()}`,
          inline: true,
        })
        .setFooter({ text: "Azus Bot" })
        .setTimestamp();

      await interaction.update({ embeds: [embed], components: [] });
    } catch (error) {
      console.error("Error collecting printer money:", error);
      await interaction.reply({
        content:
          "An error occurred while collecting printer money. Please try again later.",
        ephemeral: true,
      });
    }
  }

  if (interaction.customId === "collect_interest") {
    try {
      const userId = interaction.user.id;
      const account = bankAccounts.get(userId);
      const getBalance = await getFullBalance(userId);
      const collectedInterest = getBalance.accumulatedInterest;

      if (collectedInterest) {
        // Add interest to wallet
        await addBalance(userId, collectedInterest);

        // Update database
        await Users.update(
          {
            accumulated_interest: 0,
          },
          { where: { user_id: userId } }
        );

        const embed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("Interest Collected!")
          .setDescription(
            `You've collected 🪙 ${collectedInterest} in interest.`
          )
          .addFields(
            {
              name: "New Bank Balance",
              value: `🪙 ${account.balance}`,
              inline: true,
            }
            // {
            //   name: "Next Interest Available",
            //   value: "in 1 hour",
            //   inline: true,
            // }
          )
          .setFooter({ text: "Azus Bot" })
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
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
    const userId = interaction.user.id;
    const balance = await getBalance(userId);

    if (balance < bet) {
      await interaction.reply({
        content: `You don't have enough money to play again. Your balance: 🪙${balance}`,
        ephemeral: true,
      });
      return;
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
      where: { user_id: interaction.user.id },
    });
    const printer = await UserItems.findOne({
      where: { user_id: interaction.user.id, item_id: printerId },
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
      { where: { user_id: interaction.user.id, item_id: printerId } }
    );
    await addBankBalance(interaction.user.id, -upgradeCost);

    // Fetch the updated printer and user data
    const updatedPrinter = await UserItems.findOne({
      where: { user_id: interaction.user.id, item_id: printerId },
      include: ["item"],
    });
    const updatedUser = await Users.findOne({
      where: { user_id: interaction.user.id },
    });

    // Create an updated embed and buttons
    const { embed, row } = await createUpgradeEmbed(
      updatedPrinter,
      updatedUser
    );

    // Update the message with the new embed and buttons
    await interaction.update({ embeds: [embed], components: [row] });
  }
});

async function calculatePrinterMoney(printers) {
  let totalReady = 0;
  const printerDetails = [];

  for (const printer of printers) {
    const baseRate = getPrinterBaseRate(printer.item.name);
    const baseInterval = 2.5; // Base print interval in minutes

    const interval = calculateSpeedUpgrade(baseInterval, printer.speed_level);
    let outputBoost = calculateUpgradeEffect(
      baseRate,
      0.225,
      printer.output_level
    );
    const capacity = calculateCapacity(baseRate, printer.capacity_level);

    const minutesSinceLastCollection =
      (Date.now() - printer.last_collected) / (1000 * 60);
    const cycles = Math.floor(minutesSinceLastCollection / interval);

    const generatedAmount = outputBoost * cycles * printer.amount;
    const actualGenerated = Math.min(generatedAmount, capacity);

    outputBoost =
      outputBoost % 1 !== 0 ? outputBoost.toFixed(1) : outputBoost.toFixed(0);

    totalReady += actualGenerated;
    printerDetails.push({
      name: printer.item.name,
      generated: Math.floor(actualGenerated),
      capacity: capacity,
      interval: interval,
      outputPerCycle: outputBoost,
      amount: printer.amount,
    });
  }

  return { totalReady, printerDetails };
}
async function collectPrinterMoney(userId) {
  const printers = await getUserPrinters(userId);
  let totalGenerated = 0;

  for (const printer of printers) {
    const baseRate = getPrinterBaseRate(printer.item.name);
    const baseInterval = 2.5; // Base print interval in minutes

    const interval = calculateSpeedUpgrade(baseInterval, printer.speed_level);
    const outputBoost = calculateUpgradeEffect(
      baseRate,
      0.225,
      printer.output_level
    );
    const capacity = calculateCapacity(baseRate, printer.capacity_level);

    const minutesSinceLastCollection =
      (Date.now() - printer.last_collected) / (1000 * 60);
    const cycles = Math.floor(minutesSinceLastCollection / interval);

    const generatedAmount = outputBoost * cycles * printer.amount;
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
  const sender = await Users.findOne({ where: { user_id: senderId } });
  const receiver = await Users.findOne({ where: { user_id: receiverId } });

  if (!sender || !receiver) {
    throw new Error("One or both users not found");
  }

  if (sender.balance < amount) {
    throw new Error("Insufficient funds");
  }

  await Users.update(
    { balance: sender.balance - amount },
    { where: { user_id: senderId } }
  );
  await Users.update(
    { balance: receiver.balance + amount },
    { where: { user_id: receiverId } }
  );

  // Update local cache
  const senderAccount = bankAccounts.get(senderId);
  const receiverAccount = bankAccounts.get(receiverId);
  if (senderAccount) senderAccount.balance -= amount;
  if (receiverAccount) receiverAccount.balance += amount;

  return {
    newSenderBalance: sender.balance - amount,
    newReceiverBalance: receiver.balance + amount,
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

async function getTopUsers(sortByNetWorth = true) {
  const users = await Users.findAll();
  const userNetWorths = await Promise.all(
    users.map(async (user) => {
      const netWorth = await calculateNetWorth(user.user_id);
      return {
        userId: user.user_id,
        netWorth,
        totalCash: user.balance + user.bank_balance,
      };
    })
  );

  return userNetWorths
    .sort((a, b) =>
      sortByNetWorth ? b.netWorth - a.netWorth : b.totalCash - a.totalCash
    )
    .slice(0, 10);
}

function createLeaderboardEmbed(topUsers, showNetWorth) {
  return new EmbedBuilder()
    .setColor("#ff00ff")
    .setTitle(showNetWorth ? "Net Worth Leaderboard" : "Balance Leaderboard")
    .setDescription(
      topUsers
        .map(({ userId, netWorth, totalCash }, index) => {
          const value = showNetWorth ? netWorth : totalCash;
          return `${index + 1}. <@${userId}> - 🪙 ${value.toLocaleString()}`;
        })
        .join("\n")
    )
    .setFooter({
      text: `Top 10 ${showNetWorth ? "Wealthiest" : "Richest"} Users`,
    })
    .setTimestamp();
}

function createLeaderboardButtons(showNetWorth) {
  const netWorthButton = new ButtonBuilder()
    .setCustomId("leaderboard_net_worth")
    .setLabel("Net Worth")
    .setStyle(showNetWorth ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const totalCashButton = new ButtonBuilder()
    .setCustomId("leaderboard_total_cash")
    .setLabel("Balance")
    .setStyle(showNetWorth ? ButtonStyle.Secondary : ButtonStyle.Primary);

  return new ActionRowBuilder().addComponents(netWorthButton, totalCashButton);
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
  "🍊🍊🍊": 15,
  "🍇🍇🍇": 20,
  "🔔🔔🔔": 25,
  "💎💎💎": 30,
  "🍀🍀🍀": 40,
  "🌟🌟🌟": 50,
  "💰💰💰": 60,
  "👑👑👑": 75,
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
  const userId = message.author.id;
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
  const userId = interaction.user.id;
  const userBalance = await getBalance(userId);

  if (userBalance < betAmount) {
    await interaction.reply({
      content: `You don't have enough coins to play. Your balance: 🪙${userBalance}`,
      ephemeral: true,
    });
    return;
  }

  await addBalance(userId, -betAmount);

  const result = spinSlots();
  const winnings = calculateWinnings(result, betAmount);
  await addBalance(userId, winnings);

  const newBalance = await getBalance(userId);

  const resultString = result.join(" ");
  const netGain = winnings - betAmount;

  const resultEmbed = new EmbedBuilder()
    .setColor(winnings > 0 ? "#00FF00" : "#FF0000")
    .setTitle("🎰 Slots Result 🎰")
    .setDescription(
      `${resultString}\n\n${
        winnings > 0 ? "You won!" : "Better luck next time!"
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

  const playAgainButton = new ButtonBuilder()
    .setCustomId(`play_again_${betAmount}`)
    .setLabel("Play Again")
    .setStyle(ButtonStyle.Success);

  const newRow = new ActionRowBuilder().addComponents(playAgainButton);

  await interaction.update({ embeds: [resultEmbed], components: [newRow] });
}

async function playCoinflip(message, userId, bet) {
  let userStats = coinflipStats.get(userId) || { streak: 0, winChance: 50 };

  const win = Math.random() * 100 < userStats.winChance;

  if (win) {
    await addBalance(userId, bet);
    userStats.streak++;
    userStats.winChance = Math.min(userStats.winChance + 1, 75); // Cap at 75%
    coinflipStats.set(userId, userStats);

    const newBalance = await getBalance(userId);

    const winEmbed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle(`Coinflip: You Won!`)
      .setDescription(`You won 🪙${bet}`)
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
    await addBalance(userId, -bet);
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
    "Bronze Printer": 1,
    "Silver Printer": 3,
    "Gold Printer": 6,
    "Platinum Printer": 15,
    "Titanium Printer": 25,
    "Diamond Printer": 40,
    "Quantum Printer": 100,
    "Neutronium Printer": 250,
  };
  return rates[printerName] || 1;
}

function calculateUpgradeEffect(baseEffect, increasePerLevel, level) {
  if (level === 0) return baseEffect;
  return baseEffect * Math.pow(1 + increasePerLevel, level);
}

function calculateSpeedUpgrade(baseInterval, level) {
  const maxReduction = 0.8; // Maximum 75% reduction
  const reductionPerLevel = 0.16; // 5% reduction per level
  const reduction = Math.min(maxReduction, reductionPerLevel * level);
  return baseInterval * (1 - reduction);
}

function calculateCapacity(baseRate, level) {
  const baseCapacity = baseRate * 100;
  const multiplier = 1.5; // Exponential growth multiplier
  const increase = baseCapacity * Math.pow(multiplier, level); // Exponential increase
  return Math.floor(increase);
}

function formatTime(minutes) {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins}m ${secs}s`;
}

async function createUpgradeEmbed(printer, user) {
  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle(`🖨️ Upgrade ${printer.item.name}`)
    .setDescription("Choose an upgrade to improve your printer:")
    .setFooter({ text: "Azus Bot • Click a button to upgrade" })
    .setTimestamp();

  const row = new ActionRowBuilder();

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
      const baseInterval = 2.5;
      currentEffect = formatTime(
        calculateSpeedUpgrade(baseInterval, currentLevel)
      );
      nextEffect = formatTime(calculateSpeedUpgrade(baseInterval, nextLevel));
    } else if (upgrade.upgrade_type === "output") {
      currentEffect = calculateUpgradeEffect(
        baseRate,
        0.225,
        currentLevel
      ).toFixed(1);
      nextEffect = calculateUpgradeEffect(baseRate, 0.225, nextLevel).toFixed(
        1
      );
    } else if (upgrade.upgrade_type === "capacity") {
      currentEffect = calculateCapacity(baseRate, currentLevel);
      nextEffect = calculateCapacity(baseRate, nextLevel);
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
