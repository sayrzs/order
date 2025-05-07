const { SlashCommandBuilder } = require('discord.js');

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
        const ticket = client.tickets.get(channel.id);
        const newName = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9-]/g, '-');

        if (!ticket) {
            return interaction.reply({
                content: 'This command can only be used in ticket channels!',
                ephemeral: true
            });
        }

        const hasPermission = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (!hasPermission && interaction.user.id !== ticket.userId) {
            return interaction.reply({
                content: 'You do not have permission to rename this ticket!',
                ephemeral: true
            });
        }

        try {
            const oldName = channel.name;
            await channel.setName(`ticket-${newName}`);

            // Log channel rename
            const logChannel = await interaction.guild.channels.fetch(client.config.ticketSettings.logChannelId);
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        color: 0x0099ff,
                        title: 'Ticket Renamed',
                        description: `Ticket #${ticket.id} renamed by ${interaction.user}`,
                        fields: [
                            { name: 'Old Name', value: oldName, inline: true },
                            { name: 'New Name', value: `ticket-${newName}`, inline: true }
                        ],
                        timestamp: new Date()
                    }]
                });
            }

            return interaction.reply({
                content: `Ticket channel renamed to \`ticket-${newName}\``,
            });
        } catch (error) {
            return interaction.reply({
                content: 'There was an error renaming the ticket channel.',
                ephemeral: true
            });
        }
    },
};