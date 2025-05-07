const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const DataManager = require('./src/utils/dataManager');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// Load config
client.config = require('./config.json');

// Initialize collections
client.commands = new Collection();
client.tickets = new Collection();
client.cooldowns = new Collection();

// Load commands
const foldersPath = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// Load events
const eventsPath = path.join(__dirname, 'src/events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Initialize data storage
(async () => {
    await DataManager.initialize();
    client.tickets = await DataManager.loadTickets();
})();

// Save ticket data periodically and on changes
setInterval(() => {
    DataManager.saveTickets(client.tickets);
}, 300000); // Save every 5 minutes

// Save data on process termination
process.on('SIGINT', async () => {
    console.log('Saving data before shutdown...');
    await DataManager.saveTickets(client.tickets);
    process.exit();
});

process.on('SIGTERM', async () => {
    console.log('Saving data before shutdown...');
    await DataManager.saveTickets(client.tickets);
    process.exit();
});

// Ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Loaded ${client.commands.size} commands`);
    console.log(`Managing ${client.tickets.size} active tickets`);
});

// Handle ticket updates
client.on('ticketUpdate', () => {
    DataManager.saveTickets(client.tickets);
});

// Login
client.login(client.config.token);