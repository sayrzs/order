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
        const ticket = client.tickets.get(channel.id);
        const newName = interaction.options.getString('name')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-'); // Sanitize input

        if (!ticket) {
            return interaction.reply({
                content: 'This command can only be used in ticket channels!',
                ephemeral: true
            });
        }

        // Check permissions
        const hasPermission = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (!hasPermission) {
            return interaction.reply({
                content: 'Only staff members can rename tickets!',
                ephemeral: true
            });
        }

        try {
            const oldName = channel.name;
            const newChannelName = `ticket-${newName}`;

            // Ensure the name isn't too long for Discord
            if (newChannelName.length > 100) {
                return interaction.reply({
                    content: 'The new name is too long! Please choose a shorter name.',
                    ephemeral: true
                });
            }

            await channel.setName(newChannelName);

            // Log the rename action
            const logChannel = await interaction.guild.channels.fetch(client.config.ticketSettings.logChannelId);
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        color: parseInt(client.config.embeds.color.replace('#', ''), 16),
                        title: 'Ticket Renamed',
                        description: `Ticket #${ticket.id} has been renamed by ${interaction.user}`,
                        fields: [
                            { name: 'Old Name', value: oldName, inline: true },
                            { name: 'New Name', value: newChannelName, inline: true }
                        ],
                        timestamp: new Date()
                    }]
                });
            }

            return interaction.reply({
                content: `Ticket channel has been renamed from \`${oldName}\` to \`${newChannelName}\`.`
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