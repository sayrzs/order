const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View ticket system statistics')
        .addSubcommand(subcommand =>
            subcommand
                .setName('staff')
                .setDescription('View staff performance statistics')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('View stats for a specific staff member')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('system')
                .setDescription('View overall ticket system statistics')),

    async execute(interaction) {
        const { client } = interaction;

        // Check staff permissions
        const hasPermission = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to view ticket statistics!',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTimestamp();

        try {
            const allTickets = [
                ...Array.from(client.tickets.values()),
                ...Array.from(client.archivedTickets.values())
            ];

            switch (subcommand) {
                case 'staff': {
                    const targetUser = interaction.options.getUser('user');
                    
                    if (targetUser) {
                        // Individual staff stats
                        const staffTickets = allTickets.filter(ticket => 
                            ticket.claimedBy === targetUser.id
                        );

                        const last7Days = new Date();
                        last7Days.setDate(last7Days.getDate() - 7);

                        const recentTickets = staffTickets.filter(t => 
                            t.closedAt && new Date(t.closedAt) > last7Days
                        );

                        const dailyStats = new Array(7).fill(0);
                        recentTickets.forEach(ticket => {
                            const dayIndex = 6 - Math.floor(
                                (Date.now() - ticket.closedAt) / (1000 * 60 * 60 * 24)
                            );
                            if (dayIndex >= 0 && dayIndex < 7) {
                                dailyStats[dayIndex]++;
                            }
                        });

                        // Create stats canvas
                        const canvas = createCanvas(800, 400);
                        const ctx = canvas.getContext('2d');

                        // Set background
                        ctx.fillStyle = '#2F3136';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Graph dimensions
                        const graphX = 50;
                        const graphY = canvas.height - 50;
                        const graphWidth = canvas.width - 100;
                        const graphHeight = canvas.height - 150;

                        // Draw graph
                        ctx.strokeStyle = '#FFFFFF';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(graphX, graphY);
                        ctx.lineTo(graphX + graphWidth, graphY);
                        ctx.moveTo(graphX, graphY);
                        ctx.lineTo(graphX, graphY - graphHeight);
                        ctx.stroke();

                        // Draw bars
                        const maxTickets = Math.max(...dailyStats, 1);
                        const barWidth = graphWidth / 7;

                        ctx.fillStyle = client.config.embeds.color || '#5865F2';
                        dailyStats.forEach((count, i) => {
                            const height = (count / maxTickets) * graphHeight;
                            ctx.fillRect(
                                graphX + i * barWidth + 5,
                                graphY - height,
                                barWidth - 10,
                                height
                            );
                        });

                        // Add labels
                        ctx.fillStyle = '#FFFFFF';
                        ctx.font = '20px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(`Ticket Activity - ${targetUser.tag}`, canvas.width / 2, 30);

                        // Calculate statistics
                        const stats = {
                            totalTickets: staffTickets.length,
                            openTickets: staffTickets.filter(t => !t.closed).length,
                            closedTickets: staffTickets.filter(t => t.closed).length,
                            avgResponseTime: staffTickets
                                .filter(t => t.claimedAt && t.createdAt)
                                .reduce((acc, t) => acc + (t.claimedAt - t.createdAt), 0) / 
                                staffTickets.filter(t => t.claimedAt && t.createdAt).length || 0
                        };

                        // Add statistics text
                        ctx.textAlign = 'left';
                        ctx.font = '16px Arial';
                        ctx.fillText(`Total Tickets: ${stats.totalTickets}`, 50, 70);
                        ctx.fillText(`Open Tickets: ${stats.openTickets}`, 50, 90);
                        ctx.fillText(`Closed Tickets: ${stats.closedTickets}`, 50, 110);
                        ctx.fillText(
                            `Average Response Time: ${Math.round(stats.avgResponseTime / 60000)} minutes`,
                            50,
                            130
                        );

                        // Create attachment
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), {
                            name: 'stats.png',
                            description: `Ticket statistics for ${targetUser.tag}`
                        });

                        return interaction.editReply({ files: [attachment] });
                    } else {
                        // Overall staff performance
                        const staffStats = new Map();
                        
                        allTickets.forEach(ticket => {
                            if (ticket.claimedBy) {
                                const stats = staffStats.get(ticket.claimedBy) || {
                                    total: 0,
                                    active: 0,
                                    closed: 0,
                                    responseTimes: []
                                };

                                stats.total++;
                                if (ticket.closed) {
                                    stats.closed++;
                                } else {
                                    stats.active++;
                                }

                                if (ticket.claimedAt && ticket.createdAt) {
                                    stats.responseTimes.push(ticket.claimedAt - ticket.createdAt);
                                }

                                staffStats.set(ticket.claimedBy, stats);
                            }
                        });

                        const staffFields = [];
                        for (const [staffId, stats] of staffStats) {
                            const member = await interaction.guild.members.fetch(staffId).catch(() => null);
                            if (member) {
                                const avgResponseTime = stats.responseTimes.length > 0
                                    ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length / 60000)
                                    : 0;

                                staffFields.push({
                                    name: member.displayName,
                                    value: [
                                        `Total: ${stats.total}`,
                                        `Active: ${stats.active}`,
                                        `Closed: ${stats.closed}`,
                                        `Avg Response: ${avgResponseTime}min`
                                    ].join(' | '),
                                    inline: false
                                });
                            }
                        }

                        embed.setTitle('Staff Performance Overview')
                            .setDescription('Overview of all staff members\' ticket handling')
                            .addFields(staffFields);

                        return interaction.editReply({ embeds: [embed] });
                    }
                }
                case 'system': {
                    // System-wide statistics
                    const now = Date.now();
                    const last30Days = now - (30 * 24 * 60 * 60 * 1000);
                    
                    const stats = {
                        total: allTickets.length,
                        open: allTickets.filter(t => !t.closed).length,
                        closed: allTickets.filter(t => t.closed).length,
                        last30Days: allTickets.filter(t => t.createdAt > last30Days).length,
                        avgResolutionTime: 0,
                        categories: new Map()
                    };

                    // Calculate resolution times and category stats
                    const resolutionTimes = [];
                    allTickets.forEach(ticket => {
                        if (ticket.closed && ticket.closedAt && ticket.createdAt) {
                            resolutionTimes.push(ticket.closedAt - ticket.createdAt);
                        }
                        
                        const category = ticket.category || 'Unknown';
                        const categoryStats = stats.categories.get(category) || { total: 0, open: 0 };
                        categoryStats.total++;
                        if (!ticket.closed) categoryStats.open++;
                        stats.categories.set(category, categoryStats);
                    });

                    if (resolutionTimes.length > 0) {
                        stats.avgResolutionTime = Math.round(
                            resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / 3600000
                        );
                    }

                    embed.setTitle('Ticket System Statistics')
                        .addFields([
                            {
                                name: '📊 Overview',
                                value: [
                                    `Total Tickets: ${stats.total}`,
                                    `Open Tickets: ${stats.open}`,
                                    `Closed Tickets: ${stats.closed}`,
                                    `Last 30 Days: ${stats.last30Days}`
                                ].join('\n'),
                                inline: false
                            },
                            {
                                name: '⏱️ Timing',
                                value: `Average Resolution Time: ${stats.avgResolutionTime} hours`,
                                inline: false
                            }
                        ]);

                    // Add category stats
                    const categoryFields = Array.from(stats.categories.entries()).map(([category, catStats]) => ({
                        name: `📁 ${category}`,
                        value: `Total: ${catStats.total} | Open: ${catStats.open}`,
                        inline: true
                    }));

                    embed.addFields(categoryFields);
                    return interaction.editReply({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error('Error generating stats:', error);
            return interaction.editReply({
                content: 'There was an error generating the statistics.',
                ephemeral: true
            });
        }
    },
};
