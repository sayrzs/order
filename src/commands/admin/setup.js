const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure the ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('Category for ticket channels')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('logs')
                .setDescription('Channel for ticket logs')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('transcripts')
                .setDescription('Channel for ticket transcripts')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('staff')
                .setDescription('Staff role that can manage tickets')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('max-tickets')
                .setDescription('Maximum number of open tickets per user')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('auto-close')
                .setDescription('Hours before auto-closing inactive tickets')
                .setMinValue(1)
                .setMaxValue(720)
                .setRequired(false)),

    async execute(interaction) {
        const category = interaction.options.getChannel('category');
        const logs = interaction.options.getChannel('logs');
        const transcripts = interaction.options.getChannel('transcripts');
        const staffRole = interaction.options.getRole('staff');
        const maxTickets = interaction.options.getInteger('max-tickets') || 3;
        const autoClose = interaction.options.getInteger('auto-close') || 24;

        try {
            const configPath = path.join(process.cwd(), 'config.json');
            const config = require(configPath);

            // Update config
            config.ticketSettings = {
                ...config.ticketSettings,
                categoryId: category.id,
                logChannelId: logs.id,
                transcriptChannelId: transcripts.id,
                maxTicketsPerUser: maxTickets,
                autoCloseHours: autoClose
            };

            if (!config.staffRoles.includes(staffRole.id)) {
                config.staffRoles.push(staffRole.id);
            }

            // Save config
            await fs.writeFile(configPath, JSON.stringify(config, null, 4));

            // Update client config
            interaction.client.config = config;

            return interaction.reply({
                embeds: [{
                    color: 0x00ff00,
                    title: 'Ticket System Setup Complete',
                    fields: [
                        { name: 'Ticket Category', value: category.toString(), inline: true },
                        { name: 'Log Channel', value: logs.toString(), inline: true },
                        { name: 'Transcript Channel', value: transcripts.toString(), inline: true },
                        { name: 'Staff Role', value: staffRole.toString(), inline: true },
                        { name: 'Max Tickets per User', value: maxTickets.toString(), inline: true },
                        { name: 'Auto-close After', value: `${autoClose} hours`, inline: true }
                    ],
                    timestamp: new Date()
                }]
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: 'There was an error saving the configuration.',
                ephemeral: true
            });
        }
    },
};