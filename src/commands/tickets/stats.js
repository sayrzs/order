const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const { subDays, startOfDay, endOfDay } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View ticket statistics')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view stats for (staff only)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days to show (default: 7)')
                .setMinValue(1)
                .setMaxValue(30)
                .setRequired(false)),

    async execute(interaction) {
        const { client } = interaction;
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const days = interaction.options.getInteger('days') || 7;

        // Check permissions for viewing other users' stats
        if (targetUser.id !== interaction.user.id) {
            const hasPermission = interaction.member.roles.cache
                .some(role => 
                    client.config.staffRoles.includes(role.id) ||
                    role.id === client.config.adminRole
                );

            if (!hasPermission) {
                return interaction.reply({
                    content: 'You can only view your own stats!',
                    ephemeral: true
                });
            }
        }

        await interaction.deferReply();

        try {
            // Collect stats data
            const now = new Date();
            const stats = {
                totalTickets: 0,
                openTickets: 0,
                closedTickets: 0,
                avgResponseTime: 0,
                dailyStats: Array(days).fill(0),
                typeDistribution: new Map()
            };

            // Combine active and archived tickets
            const allTickets = [
                ...Array.from(client.tickets.values()),
                ...Array.from(client.archivedTickets.values())
            ].filter(ticket => {
                if (targetUser.id === ticket.userId) return true;
                if (ticket.claimedBy === targetUser.id) return true;
                if (ticket.closedBy === targetUser.id) return true;
                return false;
            });

            let totalResponseTime = 0;
            let responseMeasured = 0;

            // Process tickets
            for (const ticket of allTickets) {
                stats.totalTickets++;
                if (ticket.closed) stats.closedTickets++;
                else stats.openTickets++;

                // Track ticket types
                const count = stats.typeDistribution.get(ticket.type) || 0;
                stats.typeDistribution.set(ticket.type, count + 1);

                // Calculate response time if claimed
                if (ticket.claimedAt && ticket.createdAt) {
                    const responseTime = ticket.claimedAt - ticket.createdAt;
                    totalResponseTime += responseTime;
                    responseMeasured++;
                }

                // Add to daily stats if within range
                const createDate = new Date(ticket.createdAt);
                const dayDiff = Math.floor((now - createDate) / (1000 * 60 * 60 * 24));
                if (dayDiff < days) {
                    stats.dailyStats[dayDiff]++;
                }
            }

            // Calculate average response time
            stats.avgResponseTime = responseMeasured > 0 ? 
                totalResponseTime / responseMeasured : 0;

            // Create canvas for visualization
            const canvas = createCanvas(800, 400);
            const ctx = canvas.getContext('2d');

            // Set background
            ctx.fillStyle = '#2F3136';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw daily stats graph
            const graphHeight = 200;
            const graphWidth = 700;
            const graphX = 50;
            const graphY = 300;

            // Draw axes
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(graphX, graphY);
            ctx.lineTo(graphX + graphWidth, graphY);
            ctx.moveTo(graphX, graphY);
            ctx.lineTo(graphX, graphY - graphHeight);
            ctx.stroke();

            // Draw data points
            const maxTickets = Math.max(...stats.dailyStats);
            const barWidth = graphWidth / days;
            
            ctx.fillStyle = client.config.embeds.color || '#5865F2';
            stats.dailyStats.forEach((count, i) => {
                const height = (count / maxTickets) * graphHeight;
                ctx.fillRect(
                    graphX + (days - i - 1) * barWidth,
                    graphY - height,
                    barWidth - 2,
                    height
                );
            });

            // Add labels
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Ticket Activity (Last 7 Days)', canvas.width / 2, 30);

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

            // Create image attachment
            const attachment = new AttachmentBuilder(canvas.toBuffer(), {
                name: 'stats.png',
                description: `Ticket statistics for ${targetUser.tag}`
            });

            // Send response
            return interaction.editReply({
                content: `Ticket statistics for ${targetUser}:`,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error generating stats:', error);
            return interaction.editReply({
                content: 'There was an error generating the statistics.',
                ephemeral: true
            });
        }
    },
};