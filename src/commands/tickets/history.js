const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDistanceToNow } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('View ticket history')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view history for (staff only)')
                .setRequired(false)),

    async execute(interaction) {
        const { client } = interaction;
        const targetUser = interaction.options.getUser('user') || interaction.user;

        // If viewing other user's history, check staff permission
        if (targetUser.id !== interaction.user.id) {
            const isStaff = interaction.member.roles.cache
                .some(role => 
                    client.config.staffRoles.includes(role.id) ||
                    role.id === client.config.adminRole
                );

            if (!isStaff) {
                return interaction.reply({
                    content: 'You can only view your own ticket history!',
                    ephemeral: true
                });
            }
        }

        await interaction.deferReply({ ephemeral: true });

        // Get ticket history from DataManager
        const ticketHistory = await client.dataManager.getTicketHistory(targetUser.id);

        if (ticketHistory.length === 0) {
            return interaction.editReply({
                content: `No ticket history found for ${targetUser.id === interaction.user.id ? 'you' : targetUser.tag}!`,
                ephemeral: true
            });
        }

        // Create embed with ticket history
        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTitle(`Ticket History - ${targetUser.tag}`)
            .setTimestamp();

        // Group tickets by status
        const openTickets = ticketHistory.filter(t => !t.closed);
        const closedTickets = ticketHistory.filter(t => t.closed);

        if (openTickets.length > 0) {
            const openFields = openTickets.map(ticket => ({
                name: `Ticket #${ticket.id}`,
                value: [
                    `Created: <t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>`,
                    `Type: ${ticket.type}`,
                    ticket.subject ? `Subject: ${ticket.subject}` : null,
                    `Status: ${ticket.claimed ? 'Claimed' : 'Unclaimed'}`,
                    ticket.claimedBy ? `Claimed by: <@${ticket.claimedBy}>` : null
                ].filter(Boolean).join('\n'),
                inline: false
            }));
            embed.addFields({ name: '📬 Open Tickets', value: '\u200B' });
            embed.addFields(openFields);
        }

        if (closedTickets.length > 0) {
            const closedFields = closedTickets.slice(0, 5).map(ticket => ({
                name: `Ticket #${ticket.id}`,
                value: [
                    `Created: <t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>`,
                    `Closed: <t:${Math.floor(new Date(ticket.closedAt).getTime() / 1000)}:R>`,
                    `Type: ${ticket.type}`,
                    ticket.subject ? `Subject: ${ticket.subject}` : null,
                    ticket.closedBy ? `Closed by: <@${ticket.closedBy}>` : null
                ].filter(Boolean).join('\n'),
                inline: false
            }));
            embed.addFields({ name: '📪 Recent Closed Tickets', value: '\u200B' });
            embed.addFields(closedFields);
        }

        // Add summary field
        embed.addFields({
            name: '📊 Summary',
            value: [
                `Total Tickets: ${ticketHistory.length}`,
                `Open Tickets: ${openTickets.length}`,
                `Closed Tickets: ${closedTickets.length}`,
                `Average Resolution Time: ${calculateAverageResolutionTime(closedTickets)} minutes`
            ].join('\n'),
            inline: false
        });

        return interaction.editReply({ embeds: [embed] });
    },
};

function calculateAverageResolutionTime(tickets) {
    if (tickets.length === 0) return 0;

    const totalTime = tickets.reduce((sum, ticket) => {
        if (ticket.closedAt && ticket.createdAt) {
            return sum + (new Date(ticket.closedAt) - new Date(ticket.createdAt));
        }
        return sum;
    }, 0);

    return Math.floor(totalTime / tickets.length / 1000 / 60); // Convert to minutes
}