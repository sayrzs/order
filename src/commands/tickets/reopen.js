const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reopen')
        .setDescription('Reopen a closed ticket'),

    async execute(interaction) {
        const { channel, client } = interaction;
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

        // Update ticket status
        ticket.closed = false;
        ticket.reopenedBy = interaction.user.id;
        ticket.reopenedAt = new Date();
        client.tickets.set(channel.id, ticket);

        // Update channel permissions
        await channel.permissionOverwrites.edit(ticket.userId, {
            ViewChannel: true,
            SendMessages: true
        });

        // Log ticket reopening
        const logChannel = await interaction.guild.channels.fetch(client.config.ticketSettings.logChannelId);
        if (logChannel) {
            await logChannel.send({
                embeds: [{
                    color: 0x00ff00,
                    title: 'Ticket Reopened',
                    description: `Ticket #${ticket.id} reopened by ${interaction.user}`,
                    fields: [
                        { name: 'Created By', value: `<@${ticket.userId}>`, inline: true },
                        { name: 'Type', value: ticket.type, inline: true }
                    ],
                    timestamp: new Date()
                }]
            });
        }

        return interaction.reply({
            content: `Ticket #${ticket.id} has been reopened.`
        });
    },
};