const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { formatDistanceToNow, startOfDay, endOfDay, subDays } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View ticket statistics')
        .addUserOption(option =>
            option.setName('staff')
                .setDescription('View stats for a specific staff member')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('timeframe')
                .setDescription('Timeframe for statistics')
                .setRequired(false)
                .addChoices(
                    { name: 'Today', value: 'today' },
                    { name: 'This Week', value: 'week' },
                    { name: 'This Month', value: 'month' },
                    { name: 'All Time', value: 'all' }
                )),

    async execute(interaction) {
        const { client } = interaction;
        const staffMember = interaction.options.getUser('staff');
        const timeframe = interaction.options.getString('timeframe') || 'all';

        // Check if user has permission to view staff stats
        const isStaff = interaction.member.roles.cache.some(role => 
            client.config.staffRoles.includes(role.id) || 
            role.id === client.config.adminRole
        );

        if (staffMember && !isStaff) {
            return interaction.reply({
                content: 'You do not have permission to view staff statistics!',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const stats = await getStats(client, timeframe, staffMember?.id);
            const embed = createStatsEmbed(stats, timeframe, staffMember);
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error generating stats:', error);
            await interaction.editReply({
                content: 'An error occurred while generating statistics.',
                ephemeral: true
            });
        }
    }
};

async function getStats(client, timeframe, staffId = null) {
    const now = new Date();
    let startDate;

    switch (timeframe) {
        case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
        case 'week':
            startDate = new Date(now.setDate(now.getDate() - now.getDay()));
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        default:
            startDate = new Date(0); // All time
    }

    const tickets = await client.dataManager.getTickets(startDate);
    
    const stats = {
        total: 0,
        open: 0,
        closed: 0,
        avgResponseTime: 0,
        avgResolutionTime: 0,
        responseTimeSum: 0,
        resolutionTimeSum: 0,
        typeCounts: {},
        staffStats: {}
    };

    for (const ticket of tickets) {
        // Skip if looking for specific staff member and they're not involved
        if (staffId && !ticket.staffInteractions?.some(i => i.staffId === staffId)) {
            continue;
        }

        stats.total++;
        if (ticket.status === 'open') stats.open++;
        if (ticket.status === 'closed') stats.closed++;

        // Count ticket types
        stats.typeCounts[ticket.type] = (stats.typeCounts[ticket.type] || 0) + 1;

        // Calculate response and resolution times
        if (ticket.staffInteractions?.length > 0) {
            const firstResponse = ticket.staffInteractions[0].timestamp;
            const responseTime = new Date(firstResponse) - new Date(ticket.createdAt);
            stats.responseTimeSum += responseTime;

            if (ticket.status === 'closed') {
                const resolutionTime = new Date(ticket.closedAt) - new Date(ticket.createdAt);
                stats.resolutionTimeSum += resolutionTime;
            }

            // Track staff performance
            ticket.staffInteractions.forEach(interaction => {
                const staffMember = interaction.staffId;
                if (!stats.staffStats[staffMember]) {
                    stats.staffStats[staffMember] = {
                        responses: 0,
                        ticketsHandled: new Set(),
                        avgResponseTime: 0,
                        responseTimeSum: 0
                    };
                }
                stats.staffStats[staffMember].responses++;
                stats.staffStats[staffMember].ticketsHandled.add(ticket.id);
            });
        }
    }

    // Calculate averages
    if (stats.total > 0) {
        stats.avgResponseTime = stats.responseTimeSum / stats.total;
        if (stats.closed > 0) {
            stats.avgResolutionTime = stats.resolutionTimeSum / stats.closed;
        }
    }

    // Convert staff stats Sets to numbers and calculate averages
    Object.values(stats.staffStats).forEach(staffStat => {
        staffStat.ticketsHandled = staffStat.ticketsHandled.size;
    });

    return stats;
}

function createStatsEmbed(stats, timeframe, staffMember) {
    const timeframeText = {
        today: "Today's",
        week: "This Week's",
        month: "This Month's",
        all: "All Time"
    }[timeframe];

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`${staffMember ? `${staffMember.username}'s ` : ''}${timeframeText} Ticket Statistics`)
        .setTimestamp();

    // Add ticket counts
    embed.addFields(
        { name: 'Total Tickets', value: stats.total.toString(), inline: true },
        { name: 'Open Tickets', value: stats.open.toString(), inline: true },
        { name: 'Closed Tickets', value: stats.closed.toString(), inline: true }
    );

    // Add average times
    if (stats.avgResponseTime) {
        embed.addFields({
            name: 'Average Response Time',
            value: formatDuration(stats.avgResponseTime),
            inline: true
        });
    }
    
    if (stats.avgResolutionTime) {
        embed.addFields({
            name: 'Average Resolution Time',
            value: formatDuration(stats.avgResolutionTime),
            inline: true
        });
    }

    // Add ticket type distribution
    const typeDistribution = Object.entries(stats.typeCounts)
        .map(([type, count]) => `${type}: ${count}`)
        .join('\n');
    
    if (typeDistribution) {
        embed.addFields({
            name: 'Ticket Types',
            value: typeDistribution,
            inline: false
        });
    }

    // Add staff performance metrics if viewing all stats
    if (!staffMember && Object.keys(stats.staffStats).length > 0) {
        const staffPerformance = Object.entries(stats.staffStats)
            .map(([staffId, stat]) => ({
                id: staffId,
                ...stat
            }))
            .sort((a, b) => b.ticketsHandled - a.ticketsHandled)
            .slice(0, 5)
            .map(stat => `<@${stat.id}>: ${stat.ticketsHandled} tickets, ${stat.responses} responses`)
            .join('\n');

        if (staffPerformance) {
            embed.addFields({
                name: 'Top Staff Performance',
                value: staffPerformance,
                inline: false
            });
        }
    }

    return embed;
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}