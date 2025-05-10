const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, REST, Routes, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { loadTicketData, saveTicketData, createTicket, closeTicket } = require('./ticketHandler');
const { generateLeaderboard } = require('./leaderboard');

// --- Configuration Loading ---
let config;
try {
    config = require('./config.json');
} catch (error) {
    console.error("Error loading config.json:", error);
    process.exit(1); // Exit if config is not found or invalid
}

const { token, guildId, staffRoleIds, ticketCategoryParentId, archiveCategoryParentId, ticketLogChannelId, panelChannelId, panelEmbed, ticketOpenButton, initialTicketMessage, ticketCloseMessage, ticketNamePrefix } = config;

// --- Bot Client Initialization ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // Required to get member information
        GatewayIntentBits.MessageContent, // If you need to read message content (be mindful of privileged intents)
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
});

client.commands = new Collection();

// --- Ticket Statistics (Simple In-Memory) ---
let ticketCounter = 0; // Counts total tickets ever created in this session
let openTickets = new Set(); // Stores IDs of currently open ticket channels

// Add multi-language support
const languages = {
  en: {
    ticketCreated: 'Ticket created successfully! Ticket ID: ',
    ticketClosed: 'Ticket closed successfully! Ticket ID: ',
    ticketLimit: 'You have reached the ticket limit (2).',
    leaderboardGenerated: 'Leaderboard generated!'
  },
  ar: {
    ticketCreated: 'تم إنشاء التذكرة بنجاح! معرف التذكرة: ',
    ticketClosed: 'تم إغلاق التذكرة بنجاح! معرف التذكرة: ',
    ticketLimit: 'لقد وصلت إلى الحد الأقصى للتذاكر (2).',
    leaderboardGenerated: 'تم إنشاء لوحة المتصدرين!'
  }
};

// Default language
let defaultLanguage = 'en';

// --- Helper Functions ---

/**
 * Logs messages to the designated ticket log channel.
 * @param {string} message The message to log.
 * @param {string} level The log level (e.g., INFO, ERROR, WARN).
 */
async function logTicketEvent(message, level = 'INFO') {
    console.log(`[${level}] ${message}`);
    const logChannel = await client.channels.cache.get(ticketLogChannelId);
    if (logChannel && logChannel.isTextBased()) {
        const embed = new EmbedBuilder()
            .setColor(level === 'ERROR' ? '#FF0000' : (level === 'WARN' ? '#FFA500' : '#00FF00'))
            .setTitle(`Ticket Log - ${level}`)
            .setDescription(message)
            .setTimestamp();
        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`Failed to send log to channel ${ticketLogChannelId}:`, error);
        }
    } else {
        console.warn(`Ticket log channel (${ticketLogChannelId}) not found or not a text channel.`);
    }
}

/**
 * Checks if a member has a staff role.
 * @param {import('discord.js').GuildMember} member The member to check.
 * @returns {boolean} True if the member has a staff role, false otherwise.
 */
function isStaff(member) {
    if (!member || !member.roles) return false;
    return staffRoleIds.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Generates a unique ticket ID (simple increment for now).
 * In a production bot, you might want a more robust system (e.g., database sequence).
 */
async function getNextTicketId() {
    // For a more persistent and reliable counter, consider using a database.
    // This simple counter will reset if the bot restarts.
    // For now, we'll use the number of channels in the ticket category as a rough estimate,
    // or a global counter that increments.
    try {
        const category = client.channels.cache.get(ticketCategoryParentId);
        if (category && category.type === ChannelType.GuildCategory) {
            return category.children.cache.size + 1; // Simple count, may not be perfectly sequential if channels are deleted manually
        }
    } catch (error) {
        console.error("Error getting ticket category for ID generation:", error);
    }
    ticketCounter++; // Fallback to in-memory counter
    return ticketCounter;
}

// --- Event Handlers ---

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Bot is ready and operating in guild: ${guildId}`);
    logTicketEvent(`Bot started and connected. Operating in guild ID: ${guildId}.`, 'INFO');

    // --- Command Registration (Slash Commands) ---
    const commands = [
        {
            name: 'panel',
            description: 'Displays the ticket creation panel in the configured panel channel.',
        },
        {
            name: 'add-user',
            description: 'Adds a user to the current ticket channel.',
            options: [
                {
                    name: 'user',
                    type: 6, // USER type
                    description: 'The user to add to this ticket.',
                    required: true,
                },
            ],
        },
        {
            name: 'remove-user',
            description: 'Removes a user from the current ticket channel.',
            options: [
                {
                    name: 'user',
                    type: 6, // USER type
                    description: 'The user to remove from this ticket.',
                    required: true,
                },
            ],
        },
        {
            name: 'close-ticket',
            description: 'Closes the current ticket channel.',
            options: [
                {
                    name: 'reason',
                    type: 3, // STRING type
                    description: 'The reason for closing the ticket.',
                    required: false,
                }
            ]
        },
        {
            name: 'ticket-stats',
            description: 'Displays basic ticket statistics.',
        },
        {
            name: 'create-ticket',
            description: 'Creates a new ticket.',
            options: [
                {
                    name: 'category',
                    type: 3, // STRING type
                    description: 'The category of the ticket.',
                    required: true,
                }
            ]
        },
        {
            name: 'leaderboard',
            description: 'Generates the leaderboard.',
        },
        {
            name: 'set-language',
            description: 'Sets the bot language.',
            options: [
                {
                    name: 'language',
                    type: 3, // STRING type
                    description: 'The language to set (en or ar).',
                    required: true,
                }
            ]
        },
        {
            name: 'open-ticket-menu',
            description: 'Displays the ticket category selection menu.',
        }
    ];

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildId),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error("Error reloading application commands:", error);
        logTicketEvent(`Error reloading application commands: ${error.message}`, 'ERROR');
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return; // Interactions only in guilds

    // --- Button Interaction (Ticket Creation) ---
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket_button') {
            await interaction.deferReply({ ephemeral: true }); // Acknowledge the interaction quickly

            const user = interaction.user;
            const guild = interaction.guild;
            ticketCounter++; // Increment total tickets
            openTickets.add(`ticket-${user.id}-${ticketCounter}`); // Add to open tickets (use a more unique ID later)

            const ticketId = await getNextTicketId();
            const channelName = `${ticketNamePrefix}${String(ticketId).padStart(4, '0')}-${user.username.substring(0, 10)}`;

            try {
                const ticketChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: ticketCategoryParentId,
                    permissionOverwrites: [
                        {
                            id: guild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
                        },
                        // Add permissions for each staff role
                        ...staffRoleIds.map(roleId => ({
                            id: roleId,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels],
                        })),
                    ],
                });

                openTickets.add(ticketChannel.id); // Store channel ID for tracking open tickets

                const welcomeEmbed = new EmbedBuilder()
                    .setColor(panelEmbed.color || '#0099ff')
                    .setTitle(`Ticket #${String(ticketId).padStart(4, '0')}`)
                    .setDescription(initialTicketMessage.replace('{user}', user.toString()))
                    .addFields({ name: 'Opened by', value: user.tag, inline: true })
                    .setTimestamp();

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_ticket_btn_${ticketChannel.id}`)
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(closeButton);

                await ticketChannel.send({ embeds: [welcomeEmbed], components: [row] });
                await interaction.editReply({ content: `Ticket created! You can find it here: ${ticketChannel}`, ephemeral: true });

                logTicketEvent(`Ticket #${String(ticketId).padStart(4, '0')} (${ticketChannel.name}) created by ${user.tag} (${user.id}). Channel: ${ticketChannel.id}`, 'INFO');

            } catch (error) {
                console.error("Error creating ticket channel:", error);
                logTicketEvent(`Error creating ticket channel for ${user.tag}: ${error.message}`, 'ERROR');
                await interaction.editReply({ content: 'Sorry, I encountered an error while trying to create your ticket. Please contact an administrator.', ephemeral: true });
                ticketCounter--; // Decrement if creation failed
            }
        } else if (interaction.customId.startsWith('close_ticket_btn_')) {
            if (!isStaff(interaction.member)) {
                return interaction.reply({ content: 'You do not have permission to close this ticket using the button. Use the `/close-ticket` command if you are staff.', ephemeral: true });
            }

            const ticketChannelId = interaction.customId.split('_')[3];
            const ticketChannel = interaction.guild.channels.cache.get(ticketChannelId);

            if (!ticketChannel) {
                return interaction.reply({ content: 'Ticket channel not found. It might have already been closed.', ephemeral: true });
            }

            // Defer update to prevent "interaction failed"
            await interaction.deferUpdate();

            // --- Close Ticket Logic (from button) ---
            const reason = `Closed via button by ${interaction.user.tag}`;
            logTicketEvent(`Ticket ${ticketChannel.name} is being closed by ${interaction.user.tag}. Reason: ${reason}`, 'INFO');

            // Optional: Send a closing message
            const closeEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Ticket Closed')
                .setDescription(ticketCloseMessage.replace('{staff_user}', interaction.user.toString()))
                .addFields({ name: 'Reason', value: reason || 'No reason provided.' })
                .setTimestamp();
            try {
                await ticketChannel.send({ embeds: [closeEmbed] });
            } catch (e) { console.warn("Could not send close message to ticket channel, likely already deleting.") }

            // Optional: Move to archive category instead of deleting
            if (archiveCategoryParentId) {
                try {
                    await ticketChannel.setParent(archiveCategoryParentId, { lockPermissions: true }); // Lock permissions when moving
                    await ticketChannel.setName(ticketChannel.name.replace(ticketNamePrefix, `closed-${ticketNamePrefix}`));
                    logTicketEvent(`Ticket ${ticketChannel.name} moved to archive category.`, 'INFO');
                    await interaction.followUp({ content: `Ticket ${ticketChannel.name} has been archived.`, ephemeral: true });
                } catch (err) {
                    console.error("Error archiving ticket:", err);
                    logTicketEvent(`Error archiving ticket ${ticketChannel.name}: ${err.message}`, 'ERROR');
                    // Fallback to delete if archiving fails
                    await ticketChannel.delete(`Ticket closed by ${interaction.user.tag}. Reason: ${reason}`);
                    await interaction.followUp({ content: `Ticket ${ticketChannel.name} has been closed and deleted. (Archiving failed)`, ephemeral: true });
                }
            } else {
                // Delete the channel after a short delay
                await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay
                await ticketChannel.delete(`Ticket closed by ${interaction.user.tag}. Reason: ${reason}`);
                await interaction.followUp({ content: `Ticket ${ticketChannel.name} has been closed and deleted.`, ephemeral: true });
            }
            openTickets.delete(ticketChannel.id);
        }
    }

    // --- Slash Command Handling ---
    if (interaction.isCommand()) {
        const { commandName, user, options } = interaction;

        // --- /panel command ---
        if (commandName === 'panel') {
            if (!isStaff(interaction.member)) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
            if (interaction.channelId !== panelChannelId) {
                return interaction.reply({ content: `This command can only be used in the designated panel channel (<#${panelChannelId}>).`, ephemeral: true });
            }

            const panelMessageEmbed = new EmbedBuilder()
                .setTitle(panelEmbed.title)
                .setDescription(panelEmbed.description)
                .setColor(panelEmbed.color || '#0099ff')
                .setFooter({ text: panelEmbed.footer || `Powered by ${client.user.username}` });

            const openButton = new ButtonBuilder()
                .setCustomId('open_ticket_button')
                .setLabel(ticketOpenButton.label)
                .setStyle(ButtonStyle[ticketOpenButton.style] || ButtonStyle.Primary);

            if (ticketOpenButton.emoji) {
                openButton.setEmoji(ticketOpenButton.emoji);
            }

            const row = new ActionRowBuilder().addComponents(openButton);

            try {
                await interaction.channel.send({ embeds: [panelMessageEmbed], components: [row] });
                await interaction.reply({ content: 'Ticket panel sent successfully!', ephemeral: true });
                logTicketEvent(`Ticket panel deployed by ${interaction.user.tag} in channel ${interaction.channel.name}.`, 'INFO');
            } catch (error) {
                console.error("Error sending panel:", error);
                logTicketEvent(`Error sending panel: ${error.message}`, 'ERROR');
                await interaction.reply({ content: 'Failed to send the ticket panel.', ephemeral: true });
            }
        }

        // --- /add-user command ---
        else if (commandName === 'add-user') {
            if (!isStaff(interaction.member)) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
            if (!interaction.channel.name.startsWith(ticketNamePrefix) && !openTickets.has(interaction.channelId)) {
                 return interaction.reply({ content: 'This command can only be used in an active ticket channel.', ephemeral: true });
            }

            const userToAdd = interaction.options.getUser('user');
            if (!userToAdd) {
                return interaction.reply({ content: 'You must specify a user to add.', ephemeral: true });
            }

            try {
                await interaction.channel.permissionOverwrites.edit(userToAdd.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                });
                await interaction.reply({ content: `${userToAdd} has been added to this ticket.`, ephemeral: false });
                logTicketEvent(`${userToAdd.tag} added to ticket ${interaction.channel.name} by ${interaction.user.tag}.`, 'INFO');
            } catch (error) {
                console.error(`Error adding user ${userToAdd.tag} to ticket ${interaction.channel.name}:`, error);
                logTicketEvent(`Error adding user ${userToAdd.tag} to ticket ${interaction.channel.name}: ${error.message}`, 'ERROR');
                await interaction.reply({ content: `Failed to add ${userToAdd} to the ticket.`, ephemeral: true });
            }
        }

        // --- /remove-user command ---
        else if (commandName === 'remove-user') {
            if (!isStaff(interaction.member)) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
            if (!interaction.channel.name.startsWith(ticketNamePrefix) && !openTickets.has(interaction.channelId)) {
                 return interaction.reply({ content: 'This command can only be used in an active ticket channel.', ephemeral: true });
            }

            const userToRemove = interaction.options.getUser('user');
            if (!userToRemove) {
                return interaction.reply({ content: 'You must specify a user to remove.', ephemeral: true });
            }

            // Prevent staff from removing themselves or other staff via this specific command (they can manage permissions directly if needed)
            const memberToRemove = await interaction.guild.members.fetch(userToRemove.id).catch(() => null);
            if (memberToRemove && isStaff(memberToRemove)) {
                // return interaction.reply({ content: 'Staff members cannot be removed using this command. Manage channel permissions directly if necessary.', ephemeral: true });
                // Allow removing staff, but log it carefully. Original user who opened ticket should also not be removable this way easily.
            }
             if (interaction.channel.topic && interaction.channel.topic.includes(userToRemove.id)) { // Check if user is the ticket opener
                return interaction.reply({ content: `You cannot remove the original ticket opener (${userToRemove.tag}) with this command. Close the ticket instead.`, ephemeral: true });
            }

            try {
                await interaction.channel.permissionOverwrites.delete(userToRemove.id);
                await interaction.reply({ content: `${userToRemove} has been removed from this ticket.`, ephemeral: false });
                logTicketEvent(`${userToRemove.tag} removed from ticket ${interaction.channel.name} by ${interaction.user.tag}.`, 'INFO');
            } catch (error) {
                console.error(`Error removing user ${userToRemove.tag} from ticket ${interaction.channel.name}:`, error);
                logTicketEvent(`Error removing user ${userToRemove.tag} from ticket ${interaction.channel.name}: ${error.message}`, 'ERROR');
                await interaction.reply({ content: `Failed to remove ${userToRemove} from the ticket.`, ephemeral: true });
            }
        }

        // --- /close-ticket command ---
        else if (commandName === 'close-ticket') {
            if (!isStaff(interaction.member)) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
            if (!interaction.channel.name.startsWith(ticketNamePrefix) && !openTickets.has(interaction.channelId)) {
                 return interaction.reply({ content: 'This command can only be used in an active ticket channel.', ephemeral: true });
            }

            const reason = interaction.options.getString('reason') || 'No reason provided';
            const ticketChannel = interaction.channel;

            await interaction.reply({ content: 'Closing this ticket...', ephemeral: true });
            logTicketEvent(`Ticket ${ticketChannel.name} is being closed by ${interaction.user.tag} using /close-ticket. Reason: ${reason}`, 'INFO');

            // Optional: Send a closing message
            const closeEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Ticket Closed')
                .setDescription(ticketCloseMessage.replace('{staff_user}', interaction.user.toString()))
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp();
            try {
                 await ticketChannel.send({ embeds: [closeEmbed] });
            } catch (e) { console.warn("Could not send close message, channel might be deleting.")}

            // Transcript saving logic would go here.
            // For simplicity, we're not implementing full transcript generation in this example.
            // You could save messages to a file or another service.
            // console.log(`Transcript for ${ticketChannel.name} would be saved here.`);

            if (archiveCategoryParentId) {
                try {
                    await ticketChannel.setParent(archiveCategoryParentId, { lockPermissions: true });
                    await ticketChannel.setName(ticketChannel.name.replace(ticketNamePrefix, `closed-${ticketNamePrefix}`));
                    logTicketEvent(`Ticket ${ticketChannel.name} archived by ${interaction.user.tag}.`, 'INFO');
                    // No need to send another reply if one was deferred/sent
                } catch (err) {
                    console.error("Error archiving ticket:", err);
                    logTicketEvent(`Error archiving ticket ${ticketChannel.name}: ${err.message}`, 'ERROR');
                    // Fallback to delete
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await ticketChannel.delete(`Ticket closed by ${interaction.user.tag}. Reason: ${reason}. Archiving failed.`);
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Delay to allow messages to be read
                await ticketChannel.delete(`Ticket closed by ${interaction.user.tag}. Reason: ${reason}`);
            }
            openTickets.delete(ticketChannel.id);
        }

        // --- /ticket-stats command ---
        else if (commandName === 'ticket-stats') {
            if (!isStaff(interaction.member)) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }

            const statsEmbed = new EmbedBuilder()
                .setColor('#00FFFF')
                .setTitle('Ticket Statistics')
                .addFields(
                    { name: 'Total Tickets Created (This Session)', value: ticketCounter.toString(), inline: true },
                    { name: 'Currently Open Tickets', value: openTickets.size.toString(), inline: true }
                )
                .setFooter({ text: `Stats as of` })
                .setTimestamp();

            await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
            logTicketEvent(`Ticket stats requested by ${interaction.user.tag}. Total: ${ticketCounter}, Open: ${openTickets.size}.`, 'INFO');
        }

        // --- /create-ticket command ---
        else if (commandName === 'create-ticket') {
            const category = options.getString('category');
            const result = createTicket(user.id, category);

            if (!result.success) {
                await interaction.reply({ content: languages[defaultLanguage].ticketLimit, ephemeral: true });
                return;
            }

            await interaction.reply({ content: `${languages[defaultLanguage].ticketCreated}${result.ticket.id}`, ephemeral: true });
        }

        // --- /leaderboard command ---
        else if (commandName === 'leaderboard') {
            const leaderboardPath = generateLeaderboard(ticketData);
            await interaction.reply({ content: languages[defaultLanguage].leaderboardGenerated, files: [leaderboardPath] });
        }

        // --- /set-language command ---
        else if (commandName === 'set-language') {
            const language = options.getString('language');
            if (!languages[language]) {
                await interaction.reply({ content: 'Invalid language selected.', ephemeral: true });
                return;
            }

            defaultLanguage = language;
            await interaction.reply({ content: `Language set to ${language}.`, ephemeral: true });
        }

        // --- /open-ticket-menu command ---
        else if (commandName === 'open-ticket-menu') {
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ticket-category')
                        .setPlaceholder('Select a category')
                        .addOptions([
                            { label: 'Support', value: 'support' },
                            { label: 'Store', value: 'store' },
                            { label: 'Order', value: 'order' },
                        ])
                );

            await interaction.reply({ content: 'Please select a category:', components: [row], ephemeral: true });
        }
    }
});

// Replace buttons with a select menu for ticket categories
client.on('interactionCreate', async interaction => {
    if (!interaction.isSelectMenu()) return;

    const { customId, values, user } = interaction;

    if (customId === 'ticket-category') {
        const category = values[0];
        const result = createTicket(user.id, category);

        if (!result.success) {
            await interaction.reply({ content: languages[defaultLanguage].ticketLimit, ephemeral: true });
            return;
        }

        await interaction.reply({ content: `${languages[defaultLanguage].ticketCreated}${result.ticket.id}`, ephemeral: true });
    }
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
    logTicketEvent('Bot shutting down...', 'WARN');
    client.destroy();
    process.exit();
});

process.on('SIGTERM', () => {
    logTicketEvent('Bot shutting down (SIGTERM)...', 'WARN');
    client.destroy();
    process.exit();
});

// Load ticket data on bot startup
loadTicketData();

// --- Login to Discord ---
client.login(token).catch(error => {
    console.error("Failed to login to Discord:", error);
    logTicketEvent(`Failed to login: ${error.message}`, 'ERROR');
    process.exit(1);
});