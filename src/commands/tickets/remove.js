const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove from the ticket')
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
            ) || interaction.user.id === ticket.userId;

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to remove users from this ticket!',
                ephemeral: true
            });
        }

        // Prevent removing the ticket creator or staff members
        if (user.id === ticket.userId) {
            return interaction.reply({
                content: 'You cannot remove the ticket creator!',
                ephemeral: true
            });
        }

        const isStaffMember = interaction.guild.members.cache.get(user.id)?.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (isStaffMember) {
            return interaction.reply({
                content: 'You cannot remove staff members from the ticket!',
                ephemeral: true
            });
        }

        try {
            await channel.permissionOverwrites.delete(user.id);

            // Log user removal
            const logChannel = await interaction.guild.channels.fetch(client.config.ticketSettings.logChannelId);
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        color: 0xFF0000,
                        title: 'User Removed from Ticket',
                        description: `${user} was removed from ticket #${ticket.id} by ${interaction.user}`,
                        timestamp: new Date()
                    }]
                });
            }

            return interaction.reply({
                content: `${user} has been removed from the ticket.`
            });
        } catch (error) {
            return interaction.reply({
                content: 'There was an error removing the user from the ticket.',
                ephemeral: true
            });
        }
    },
};