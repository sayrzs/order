const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-config')
        .setDescription('View current ticket system configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const { client, guild } = interaction;
        const config = client.config;

        try {
            const category = await guild.channels.fetch(config.ticketSettings.categoryId);
            const logChannel = await guild.channels.fetch(config.ticketSettings.logChannelId);
            const transcriptChannel = await guild.channels.fetch(config.ticketSettings.transcriptChannelId);
            const staffRoles = await Promise.all(
                config.staffRoles.map(id => guild.roles.fetch(id))
            );

            return interaction.reply({
                embeds: [{
                    color: config.embeds.color,
                    title: 'Ticket System Configuration',
                    fields: [
                        { name: 'Ticket Category', value: category?.toString() || 'Not set', inline: true },
                        { name: 'Log Channel', value: logChannel?.toString() || 'Not set', inline: true },
                        { name: 'Transcript Channel', value: transcriptChannel?.toString() || 'Not set', inline: true },
                        { name: 'Staff Roles', value: staffRoles.filter(r => r).map(r => r.toString()).join('\n') || 'None set', inline: true },
                        { name: 'Max Tickets per User', value: config.ticketSettings.maxTicketsPerUser.toString(), inline: true },
                        { name: 'Auto-close After', value: `${config.ticketSettings.autoCloseHours} hours`, inline: true },
                        { name: 'Transcript Expiry', value: `${config.ticketSettings.transcriptExpiryHours} hours`, inline: true },
                        { name: 'Ticket Cooldown', value: `${config.ticketSettings.ticketCooldown} seconds`, inline: true }
                    ],
                    description: 'Panel Configuration:',
                    timestamp: new Date(),
                    footer: { text: config.embeds.footerText }
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: 'There was an error fetching the configuration.',
                ephemeral: true
            });
        }
    },
};