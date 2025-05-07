const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const QueueManager = require('../../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue-status')
        .setDescription('View the current ticket queue status'),

    async execute(interaction) {
        const { client, guild } = interaction;
        const queue = QueueManager.getQueue(guild.id);

        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTitle('Ticket Queue Status')
            .setTimestamp();

        if (!queue || queue.length === 0) {
            embed.setDescription('There are currently no tickets in the queue.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Check if user is staff
        const isStaff = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        const queueLength = queue.length;
        let description = `There ${queueLength === 1 ? 'is' : 'are'} currently ${queueLength} ticket${queueLength === 1 ? '' : 's'} in the queue.`;

        // Find user's position in queue if they have a ticket
        const userPosition = queue.findIndex(item => item.userId === interaction.user.id) + 1;
        if (userPosition > 0) {
            description += `\nYour position in queue: ${userPosition}`;
        }

        embed.setDescription(description);

        // Add detailed queue information for staff
        if (isStaff) {
            const queueDetails = await Promise.all(queue.slice(0, 10).map(async (item, index) => {
                const user = await client.users.fetch(item.userId).catch(() => null);
                return `${index + 1}. ${user ? user.tag : 'Unknown User'} - ${item.type} (Waiting: <t:${Math.floor(item.joinedAt / 1000)}:R>)`;
            }));

            if (queueDetails.length > 0) {
                embed.addFields({
                    name: 'Queue Details',
                    value: queueDetails.join('\n'),
                });

                if (queue.length > 10) {
                    embed.addFields({
                        name: 'Note',
                        value: `+ ${queue.length - 10} more tickets in queue`,
                    });
                }
            }

            // Add average wait time if available
            if (client.queueStats && client.queueStats.averageWaitTime) {
                const avgWaitMins = Math.round(client.queueStats.averageWaitTime / 60000);
                embed.addFields({
                    name: 'Average Wait Time',
                    value: `${avgWaitMins} minutes`,
                    inline: true
                });
            }

            // Add queue settings
            embed.addFields({
                name: 'Queue Settings',
                value: [
                    `Max Concurrent Tickets: ${client.config.ticketSettings.maxConcurrentTickets}`,
                    `Max Queue Size: ${client.config.ticketSettings.maxQueueSize}`,
                    `Auto-close After: ${client.config.ticketSettings.closeTimeout} hours`
                ].join('\n'),
                inline: true
            });
        }

        return interaction.reply({ 
            embeds: [embed], 
            ephemeral: !isStaff 
        });
    },
};