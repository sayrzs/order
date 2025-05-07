const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server-info')
        .setDescription('Display server information and ticket system configuration'),

    async execute(interaction) {
        const { guild, client } = interaction;

        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTitle(`${guild.name} - Server Information`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { 
                    name: '📊 Server Stats',
                    value: [
                        `👥 Members: ${guild.memberCount}`,
                        `👮 Staff: ${guild.members.cache.filter(m => 
                            m.roles.cache.some(r => client.config.staffRoles.includes(r.id))
                        ).size}`,
                        `📅 Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🎫 Ticket System',
                    value: [
                        `📝 Categories: ${client.config.ticketSettings.categories?.length || 0}`,
                        `⚙️ Max Concurrent: ${client.config.ticketSettings.maxConcurrentTickets}`,
                        `⏳ Queue Limit: ${client.config.ticketSettings.maxQueueSize}`,
                        `⌛ Auto-close: ${client.config.ticketSettings.closeTimeout}h`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '👥 Support Team',
                    value: client.config.staffRoles.map(roleId => {
                        const role = guild.roles.cache.get(roleId);
                        return role ? `${role.name}: ${role.members.size} members` : 'Unknown Role';
                    }).join('\n') || 'No staff roles configured',
                    inline: true
                }
            )
            .setFooter({ text: `Server ID: ${guild.id}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};