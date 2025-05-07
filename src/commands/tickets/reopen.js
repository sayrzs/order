const { SlashCommandBuilder } = require('discord.js');
const TicketManager = require('../../utils/ticketManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reopen')
        .setDescription('Reopen a closed ticket')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for reopening the ticket')
                .setRequired(false)),

    async execute(interaction) {
        const { channel, client, guild } = interaction;
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        // Check staff permission
        const hasPermission = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to reopen tickets!',
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

        if (!ticket.closed) {
            return interaction.reply({
                content: 'This ticket is already open!',
                ephemeral: true
            });
        }

        try {
            // Restore channel permissions
            await channel.permissionOverwrites.edit(ticket.userId, {
                ViewChannel: true,
                SendMessages: true
            });

            // Update ticket status
            const updatedTicket = await TicketManager.updateTicket(client, channel.id, {
                closed: false,
                reopenedBy: interaction.user.id,
                reopenedAt: new Date(),
                reopenReason: reason
            });

            // Clear any scheduled deletion
            clearTimeout(ticket.deletionTimeout);

            // Log ticket reopening
            const logChannel = await guild.channels.fetch(client.config.ticketSettings.logChannelId);
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        color: 0x00FF00,
                        title: 'Ticket Reopened',
                        description: `Ticket #${ticket.id} has been reopened by ${interaction.user}`,
                        fields: [
                            { name: 'Reason', value: reason },
                            { name: 'Original Creator', value: `<@${ticket.userId}>`, inline: true }
                        ],
                        timestamp: new Date()
                    }]
                });
            }

            // Notify the ticket creator
            try {
                const ticketCreator = await client.users.fetch(ticket.userId);
                await ticketCreator.send({
                    embeds: [{
                        color: parseInt(client.config.embeds.color.replace('#', ''), 16),
                        title: 'Ticket Reopened',
                        description: `Your ticket (#${ticket.id}) has been reopened.`,
                        fields: [
                            { name: 'Reopened By', value: interaction.user.tag, inline: true },
                            { name: 'Reason', value: reason, inline: true }
                        ],
                        timestamp: new Date()
                    }]
                });
            } catch (error) {
                console.error('Could not DM ticket creator:', error);
            }

            return interaction.reply({
                content: `Ticket has been reopened. Reason: ${reason}`,
                components: []
            });
        } catch (error) {
            console.error('Error reopening ticket:', error);
            return interaction.reply({
                content: 'There was an error reopening the ticket.',
                ephemeral: true
            });
        }
    },
};