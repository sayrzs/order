const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-list')
        .setDescription('View available support staff members'),

    async execute(interaction) {
        const { guild, client } = interaction;
        
        // Get all staff members
        const staffMembers = await guild.members.cache.filter(member =>
            member.roles.cache.some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            )
        );

        // Get active tickets
        const activeTickets = Array.from(client.tickets.values())
            .filter(ticket => !ticket.closed);

        // Calculate staff status
        const staffStatus = new Map();
        staffMembers.forEach(member => {
            const assignedTickets = activeTickets.filter(t => t.claimedBy === member.id);
            const status = {
                available: member.presence?.status || 'offline',
                ticketsHandling: assignedTickets.length,
                lastActive: member.lastMessageId ? 'Recently active' : 'No recent activity'
            };
            staffStatus.set(member.id, status);
        });

        // Sort staff by availability and tickets handling
        const sortedStaff = Array.from(staffStatus.entries())
            .sort(([idA, statusA], [idB, statusB]) => {
                // Online staff first
                if (statusA.available === 'online' && statusB.available !== 'online') return -1;
                if (statusB.available === 'online' && statusA.available !== 'online') return 1;
                // Then by number of tickets handling
                return statusA.ticketsHandling - statusB.ticketsHandling;
            });

        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTitle('Support Staff List')
            .setDescription('Current available staff members and their status.')
            .addFields({
                name: 'Current Support Coverage',
                value: `Total Staff: ${staffMembers.size}\nOnline Staff: ${staffMembers.filter(m => m.presence?.status === 'online').size}\nActive Tickets: ${activeTickets.length}`,
                inline: false
            });

        // Add staff members to embed
        const staffFields = sortedStaff.map(([memberId, status]) => {
            const member = staffMembers.get(memberId);
            if (!member) return null;

            const statusEmoji = {
                online: '🟢',
                idle: '🟡',
                dnd: '🔴',
                offline: '⚫'
            }[status.available] || '⚫';

            return {
                name: `${statusEmoji} ${member.displayName}`,
                value: [
                    `Status: ${status.available}`,
                    `Handling: ${status.ticketsHandling} ticket(s)`,
                    `Activity: ${status.lastActive}`
                ].join('\n'),
                inline: true
            };
        }).filter(Boolean);

        embed.addFields(staffFields);

        // Add peak hours if configured
        if (client.config.ticketSettings.peakHours) {
            embed.addFields({
                name: '⏰ Peak Support Hours',
                value: client.config.ticketSettings.peakHours,
                inline: false
            });
        }

        embed.setFooter({ text: 'Staff status updates every few minutes' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};