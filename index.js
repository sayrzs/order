const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const DataManager = require('./src/utils/dataManager');
const VerificationRoutine = require('./src/utils/verificationRoutine');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    // Enable error handling for API requests
    failIfNotExists: false,
    retryLimit: 3
});

// Load config
client.config = require('./config.json');

// Initialize collections
client.commands = new Collection();
client.tickets = new Collection();
client.cooldowns = new Collection();
client.archivedTickets = new Collection();

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

// Initialize data storage and start maintenance routines
(async () => {
    await DataManager.initialize();
    client.tickets = await DataManager.loadTickets();
    client.archivedTickets = await DataManager.loadArchivedTickets();
    
    // Start maintenance routines after bot is ready
    client.once('ready', () => {
        // Start verification routine
        VerificationRoutine.startVerificationInterval(client);
        
        // Start cleanup interval
        DataManager.startCleanupInterval(client);
        
        // Run initial verification
        VerificationRoutine.verifyAllTickets(client).then(isValid => {
            if (!isValid) {
                console.warn('Initial ticket verification found issues. Check logs for details.');
            }
        });

        console.log(`Logged in as ${client.user.tag}`);
        console.log(`Loaded ${client.commands.size} commands`);
        console.log(`Managing ${client.tickets.size} active tickets`);
        console.log(`Archived tickets: ${client.archivedTickets.size}`);
    });
})();

// Save data periodically
const saveInterval = setInterval(async () => {
    await DataManager.saveTickets(client.tickets);
    await DataManager.saveArchivedTickets(client.archivedTickets);
}, 300000); // Save every 5 minutes

// Handle channel deletions
client.on('channelDelete', async (channel) => {
    const ticket = client.tickets.get(channel.id);
    if (ticket) {
        // Move ticket to archive
        client.archivedTickets.set(ticket.id, {
            ...ticket,
            archivedAt: new Date(),
            channelDeleted: true
        });
        client.tickets.delete(channel.id);
        client.emit('ticketUpdate');
    }
});

// Handle process termination
async function shutdown() {
    console.log('Shutting down...');
    
    // Clear intervals
    clearInterval(saveInterval);
    
    // Save data
    console.log('Saving data...');
    await DataManager.saveTickets(client.tickets);
    await DataManager.saveArchivedTickets(client.archivedTickets);
    
    // Run final verification
    console.log('Running final verification...');
    await VerificationRoutine.verifyAllTickets(client);
    
    console.log('Shutdown complete');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle errors and rejections
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle ticket updates
client.on('ticketUpdate', () => {
    DataManager.saveTickets(client.tickets);
});

// Login what do you think is this??
client.login(client.config.token);