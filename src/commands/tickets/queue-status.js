const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const QueueManager = require('../../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue-status')
        .setDescription('Check the current ticket queue status'),

    async execute(interaction) {
        const { guild, client } = interaction;
        const status = QueueManager.getQueueStatus(guild.id);
        const position = QueueManager.getQueuePosition(guild.id, interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTitle('Ticket Queue Status')
            .addFields(
                { name: 'Queue Size', value: status.size.toString(), inline: true },
                { name: 'Processing', value: status.processing ? 'Yes' : 'No', inline: true }
            )
            .setTimestamp();

        if (status.oldestRequest) {
            embed.addFields({
                name: 'Oldest Request',
                value: `<t:${Math.floor(status.oldestRequest / 1000)}:R>`,
                inline: true
            });
        }

        if (position > 0) {
            embed.addFields({
                name: 'Your Position',
                value: `#${position}`,
                inline: true
            });

            // Estimate wait time (2 seconds per ticket plus initial delay)
            const estimatedWait = (position - 1) * 2;
            if (estimatedWait > 0) {
                embed.addFields({
                    name: 'Estimated Wait',
                    value: `${estimatedWait} seconds`,
                    inline: true
                });
            }
        }

        // Add staff-only information
        const isStaff = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (isStaff && status.size > 0) {
            const queue = QueueManager.queues.get(guild.id) || [];
            const nextUsers = queue.slice(0, 3).map((req, index) => 
                `${index + 1}. ${req.interaction.user.tag}`
            ).join('\n');

            embed.addFields({
                name: 'Next in Queue',
                value: nextUsers || 'No users in queue',
                inline: false
            });
        }

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    },
};