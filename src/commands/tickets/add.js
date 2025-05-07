const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a user to the current ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add to the ticket')
                .setRequired(true)),

    async execute(interaction) {
        const { channel, client } = interaction;
        const ticket = client.tickets.get(channel.id);
        const user = interaction.options.getUser('user');

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
                content: 'You do not have permission to add users to this ticket!',
                ephemeral: true
            });
        }

        try {
            await channel.permissionOverwrites.edit(user.id, {
                ViewChannel: true,
                SendMessages: true
            });

            // Log user addition
            const logChannel = await interaction.guild.channels.fetch(client.config.ticketSettings.logChannelId);
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        color: 0x00ff00,
                        title: 'User Added to Ticket',
                        description: `${user} was added to ticket #${ticket.id} by ${interaction.user}`,
                        timestamp: new Date()
                    }]
                });
            }

            return interaction.reply({
                content: `${user} has been added to the ticket.`
            });
        } catch (error) {
            return interaction.reply({
                content: 'There was an error adding the user to the ticket.',
                ephemeral: true
            });
        }
    },
};