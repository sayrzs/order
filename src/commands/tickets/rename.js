const { SlashCommandBuilder } = require('discord.js');
const TicketManager = require('../../utils/ticketManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Rename the current ticket channel')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('New name for the ticket (without ticket- prefix)')
                .setRequired(true)),

    async execute(interaction) {
        const { channel, client } = interaction;
        const newName = interaction.options.getString('name').toLowerCase()
            .replace(/[^a-z0-9-]/g, '-'); // Sanitize input

        // Check staff permission
        const hasPermission = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to rename tickets!',
                ephemeral: true
            });
        }

        const ticket = client.tickets.get(channel.id);
        if (!ticket) {
            return interaction.reply({
                content: 'This command can only be used in ticket channels!',
                ephemeral: true
            });
        }

        try {
            // Preserve ticket number in name
            const newChannelName = `ticket-${ticket.id}-${newName}`;
            
            // Check name length
            if (newChannelName.length > 100) {
                return interaction.reply({
                    content: 'The new name is too long. Please choose a shorter name.',
                    ephemeral: true
                });
            }

            // Attempt to rename channel
            await channel.setName(newChannelName);

            // Update ticket data
            await TicketManager.updateTicket(client, channel.id, {
                customName: newName,
                renamedBy: interaction.user.id,
                renamedAt: new Date()
            });

            // Log channel rename
            const logChannel = await interaction.guild.channels.fetch(client.config.ticketSettings.logChannelId);
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        color: parseInt(client.config.embeds.color.replace('#', ''), 16),
                        title: 'Ticket Renamed',
                        description: `Ticket #${ticket.id} has been renamed by ${interaction.user}`,
                        fields: [
                            { name: 'New Name', value: newChannelName },
                            { name: 'Original Creator', value: `<@${ticket.userId}>`, inline: true }
                        ],
                        timestamp: new Date()
                    }]
                });
            }

            return interaction.reply({
                content: `Ticket channel has been renamed to \`${newChannelName}\``,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error renaming ticket:', error);
            return interaction.reply({
                content: 'There was an error renaming the ticket channel.',
                ephemeral: true
            });
        }
    },
};