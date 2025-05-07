const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDistanceToNow, startOfDay, endOfDay, subDays } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View ticket statistics')
        .addSubcommand(subcommand =>
            subcommand
                .setName('overview')
                .setDescription('View general ticket statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('staff')
                .setDescription('View staff performance statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('daily')
                .setDescription('View daily ticket statistics')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days to show (default: 7)')
                        .setRequired(false))),

    async execute(interaction) {
        const { client } = interaction;
        const subcommand = interaction.options.getSubcommand();

        // Check staff permission
        const isStaff = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (!isStaff) {
            return interaction.reply({
                content: 'Only staff members can view ticket statistics!',
                ephemeral: true
            });
        }

        switch (subcommand) {
            case 'overview': {
                await interaction.deferReply({ ephemeral: true });

                const activeTickets = client.tickets.size;
                const archivedTickets = client.archivedTickets.size;
                const totalTickets = activeTickets + archivedTickets;

                // Calculate average resolution time
                let totalResolutionTime = 0;
                let resolvedCount = 0;
                client.archivedTickets.forEach(ticket => {
                    if (ticket.closedAt && ticket.createdAt) {
                        totalResolutionTime += new Date(ticket.closedAt) - new Date(ticket.createdAt);
                        resolvedCount++;
                    }
                });

                const avgResolutionTime = resolvedCount > 0
                    ? Math.floor(totalResolutionTime / resolvedCount / 1000 / 60) // Convert to minutes
                    : 0;

                const embed = new EmbedBuilder()
                    .setColor(client.config.embeds.color)
                    .setTitle('Ticket Statistics Overview')
                    .addFields(
                        { name: 'Active Tickets', value: activeTickets.toString(), inline: true },
                        { name: 'Archived Tickets', value: archivedTickets.toString(), inline: true },
                        { name: 'Total Tickets', value: totalTickets.toString(), inline: true },
                        { name: 'Average Resolution Time', value: `${avgResolutionTime} minutes`, inline: true }
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            case 'staff': {
                await interaction.deferReply({ ephemeral: true });

                const staffStats = new Map();

                // Initialize staff stats
                interaction.guild.members.cache
                    .filter(member => 
                        member.roles.cache.some(role => 
                            client.config.staffRoles.includes(role.id)
                        )
                    )
                    .forEach(member => {
                        staffStats.set(member.id, {
                            ticketsClosed: 0,
                            averageResponseTime: 0,
                            totalResponseTime: 0,
                            responseCount: 0,
                            ticketsClaimed: 0
                        });
                    });

                // Process archived tickets
                client.archivedTickets.forEach(ticket => {
                    if (ticket.closedBy && staffStats.has(ticket.closedBy)) {
                        const stats = staffStats.get(ticket.closedBy);
                        stats.ticketsClosed++;
                    }
                    if (ticket.claimedBy && staffStats.has(ticket.claimedBy)) {
                        const stats = staffStats.get(ticket.claimedBy);
                        stats.ticketsClaimed++;
                        if (ticket.claimedAt && ticket.createdAt) {
                            const responseTime = new Date(ticket.claimedAt) - new Date(ticket.createdAt);
                            stats.totalResponseTime += responseTime;
                            stats.responseCount++;
                        }
                    }
                });

                // Calculate averages
                staffStats.forEach(stats => {
                    if (stats.responseCount > 0) {
                        stats.averageResponseTime = Math.floor(
                            stats.totalResponseTime / stats.responseCount / 1000 / 60
                        ); // Convert to minutes
                    }
                });

                // Create embed
                const embed = new EmbedBuilder()
                    .setColor(client.config.embeds.color)
                    .setTitle('Staff Performance Statistics')
                    .setTimestamp();

                for (const [staffId, stats] of staffStats) {
                    const member = await interaction.guild.members.fetch(staffId);
                    embed.addFields({
                        name: member.displayName,
                        value: [
                            `Tickets Closed: ${stats.ticketsClosed}`,
                            `Tickets Claimed: ${stats.ticketsClaimed}`,
                            `Average Response Time: ${stats.averageResponseTime} minutes`
                        ].join('\n'),
                        inline: true
                    });
                }

                return interaction.editReply({ embeds: [embed] });
            }

            case 'daily': {
                await interaction.deferReply({ ephemeral: true });
                const days = interaction.options.getInteger('days') || 7;

                // Initialize daily stats
                const dailyStats = new Map();
                for (let i = 0; i < days; i++) {
                    const date = subDays(new Date(), i);
                    dailyStats.set(date.toDateString(), {
                        created: 0,
                        closed: 0,
                        averageResolutionTime: 0,
                        totalResolutionTime: 0,
                        resolvedCount: 0
                    });
                }

                // Process archived tickets
                client.archivedTickets.forEach(ticket => {
                    const createdDate = new Date(ticket.createdAt);
                    const closedDate = ticket.closedAt ? new Date(ticket.closedAt) : null;

                    // Count created tickets
                    if (dailyStats.has(createdDate.toDateString())) {
                        const stats = dailyStats.get(createdDate.toDateString());
                        stats.created++;
                    }

                    // Count closed tickets and resolution time
                    if (closedDate && dailyStats.has(closedDate.toDateString())) {
                        const stats = dailyStats.get(closedDate.toDateString());
                        stats.closed++;
                        const resolutionTime = closedDate - createdDate;
                        stats.totalResolutionTime += resolutionTime;
                        stats.resolvedCount++;
                    }
                });

                // Calculate averages
                dailyStats.forEach(stats => {
                    if (stats.resolvedCount > 0) {
                        stats.averageResolutionTime = Math.floor(
                            stats.totalResolutionTime / stats.resolvedCount / 1000 / 60
                        ); // Convert to minutes
                    }
                });

                // Create embed
                const embed = new EmbedBuilder()
                    .setColor(client.config.embeds.color)
                    .setTitle(`Daily Ticket Statistics (Last ${days} Days)`)
                    .setTimestamp();

                for (const [date, stats] of dailyStats) {
                    embed.addFields({
                        name: date,
                        value: [
                            `Created: ${stats.created}`,
                            `Closed: ${stats.closed}`,
                            `Average Resolution: ${stats.averageResolutionTime} minutes`
                        ].join('\n'),
                        inline: true
                    });
                }

                return interaction.editReply({ embeds: [embed] });
            }
        }
    },
};