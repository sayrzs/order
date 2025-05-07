const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDistanceToNow } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('View ticket history')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view history for (staff only)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number to view')
                .setMinValue(1)
                .setRequired(false)),

    async execute(interaction) {
        const { client } = interaction;
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const page = interaction.options.getInteger('page') || 1;
        const pageSize = 10;

        // Check if user has permission to view other users' history
        if (targetUser.id !== interaction.user.id) {
            const hasPermission = interaction.member.roles.cache
                .some(role => 
                    client.config.staffRoles.includes(role.id) ||
                    role.id === client.config.adminRole
                );

            if (!hasPermission) {
                return interaction.reply({
                    content: 'You can only view your own ticket history!',
                    ephemeral: true
                });
            }
        }

        // Combine active and archived tickets for the user
        const activeTickets = Array.from(client.tickets.values())
            .filter(t => t.userId === targetUser.id);
        const archivedTickets = Array.from(client.archivedTickets.values())
            .filter(t => t.userId === targetUser.id);
        
        const allTickets = [...activeTickets, ...archivedTickets]
            .sort((a, b) => b.createdAt - a.createdAt);

        // Calculate pagination
        const totalTickets = allTickets.length;
        const totalPages = Math.ceil(totalTickets / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageTickets = allTickets.slice(startIndex, endIndex);

        if (totalTickets === 0) {
            return interaction.reply({
                content: `${targetUser.id === interaction.user.id ? 'You have' : 'This user has'} no ticket history.`,
                ephemeral: true
            });
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTitle(`Ticket History - ${targetUser.tag}`)
            .setDescription(`Showing tickets ${startIndex + 1}-${Math.min(endIndex, totalTickets)} of ${totalTickets}`)
            .setFooter({ text: `Page ${page}/${totalPages}` });

        // Add ticket entries
        for (const ticket of pageTickets) {
            const status = ticket.closed ? 'Closed' : 'Open';
            const duration = ticket.closed && ticket.closedAt
                ? formatDistanceToNow(ticket.createdAt, { addSuffix: true })
                : 'Ongoing';

            embed.addFields({
                name: `Ticket #${ticket.id} - ${ticket.type}`,
                value: [
                    `**Status:** ${status}`,
                    `**Created:** <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`,
                    ticket.closed ? `**Closed:** <t:${Math.floor(ticket.closedAt.getTime() / 1000)}:R>` : '',
                    ticket.claimedBy ? `**Claimed By:** <@${ticket.claimedBy}>` : '',
                    ticket.closeReason ? `**Close Reason:** ${ticket.closeReason}` : '',
                    `**Duration:** ${duration}`
                ].filter(Boolean).join('\n'),
                inline: false
            });
        }

        // Add statistics
        const stats = {
            total: totalTickets,
            open: allTickets.filter(t => !t.closed).length,
            closed: allTickets.filter(t => t.closed).length,
            claimed: allTickets.filter(t => t.claimedBy).length
        };

        embed.addFields({
            name: 'Statistics',
            value: [
                `Total Tickets: ${stats.total}`,
                `Open Tickets: ${stats.open}`,
                `Closed Tickets: ${stats.closed}`,
                `Claimed Tickets: ${stats.claimed}`
            ].join('\n'),
            inline: false
        });

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    },
};