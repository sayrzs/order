const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const QueueManager = require('../../utils/queueManager');
const { formatDistanceToNow } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue-status')
        .setDescription('Check the current ticket queue status'),

    async execute(interaction) {
        const { client, guild, user } = interaction;
        const status = QueueManager.getQueueStatus(guild.id);
        const userPosition = QueueManager.getQueuePosition(guild.id, user.id);

        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTitle('Ticket Queue Status')
            .addFields(
                { name: 'Queue Size', value: status.size.toString(), inline: true },
                { name: 'Processing', value: status.processing ? 'Yes' : 'No', inline: true }
            );

        if (status.oldestRequest) {
            embed.addFields({
                name: 'Oldest Request',
                value: formatDistanceToNow(status.oldestRequest, { addSuffix: true }),
                inline: true
            });
        }

        if (userPosition > 0) {
            embed.addFields({
                name: 'Your Position',
                value: userPosition.toString(),
                inline: true
            });

            // Estimate wait time based on queue position
            const estimatedWaitMinutes = (userPosition - 1) * 2; // Assuming 2 minutes per ticket
            embed.addFields({
                name: 'Estimated Wait',
                value: `~${estimatedWaitMinutes} minutes`,
                inline: true
            });
        }

        // Add staff-only information
        const hasStaffRole = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (hasStaffRole && status.size > 0) {
            const queue = QueueManager.getDetailedQueueInfo(guild.id);
            const queueBreakdown = queue.reduce((acc, req) => {
                const type = req.panelConfig.name;
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});

            embed.addFields({
                name: 'Queue Breakdown',
                value: Object.entries(queueBreakdown)
                    .map(([type, count]) => `${type}: ${count}`)
                    .join('\n') || 'No tickets in queue',
                inline: false
            });
        }

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    },
};