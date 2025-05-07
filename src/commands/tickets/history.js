const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('View ticket history')
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Search through ticket history')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Search by ticket ID, creator, or content')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Filter by ticket type')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('View ticket history for a specific user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to view history for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View historical ticket statistics')),

    async execute(interaction) {
        const { client } = interaction;

        // Check permissions
        const hasPermission = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to view ticket history!',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'search': {
                    const query = interaction.options.getString('query').toLowerCase();
                    const type = interaction.options.getString('type');
                    
                    // Combine active and archived tickets
                    const allTickets = [
                        ...Array.from(client.tickets.values()),
                        ...Array.from(client.archivedTickets.values())
                    ];

                    // Filter tickets based on search criteria
                    const results = allTickets.filter(ticket => {
                        if (type && ticket.type !== type) return false;
                        
                        return (
                            ticket.id.toLowerCase().includes(query) ||
                            ticket.userId.toString().includes(query) ||
                            (ticket.tags && ticket.tags.some(tag => tag.toLowerCase().includes(query)))
                        );
                    });

                    if (results.length === 0) {
                        return interaction.reply({
                            content: 'No tickets found matching your search criteria.',
                            ephemeral: true
                        });
                    }

                    // Sort by date (newest first)
                    results.sort((a, b) => b.createdAt - a.createdAt);

                    // Create paginated embeds
                    const pages = [];
                    const itemsPerPage = 5;

                    for (let i = 0; i < results.length; i += itemsPerPage) {
                        const pageTickets = results.slice(i, i + itemsPerPage);
                        const embed = new EmbedBuilder()
                            .setColor(client.config.embeds.color)
                            .setTitle('Ticket Search Results')
                            .setDescription(`Found ${results.length} tickets matching your search`)
                            .addFields(
                                pageTickets.map(ticket => ({
                                    name: `Ticket #${ticket.id}`,
                                    value: [
                                        `Creator: <@${ticket.userId}>`,
                                        `Type: ${ticket.type}`,
                                        `Status: ${ticket.closed ? 'Closed' : 'Open'}`,
                                        ticket.tags ? `Tags: ${ticket.tags.join(', ')}` : null,
                                        `Created: <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`,
                                    ].filter(Boolean).join('\n'),
                                    inline: false
                                }))
                            )
                            .setFooter({ text: `Page ${Math.floor(i / itemsPerPage) + 1}/${Math.ceil(results.length / itemsPerPage)}` });
                        
                        pages.push(embed);
                    }

                    // Add navigation buttons if multiple pages
                    const components = [];
                    if (pages.length > 1) {
                        const row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('prev_page')
                                    .setLabel('Previous')
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('next_page')
                                    .setLabel('Next')
                                    .setStyle(ButtonStyle.Secondary)
                            );
                        components.push(row);
                    }

                    return interaction.reply({
                        embeds: [pages[0]],
                        components,
                        ephemeral: true
                    });
                }

                case 'user': {
                    const target = interaction.options.getUser('target');
                    const userTickets = [
                        ...Array.from(client.tickets.values()),
                        ...Array.from(client.archivedTickets.values())
                    ].filter(ticket => ticket.userId === target.id);

                    if (userTickets.length === 0) {
                        return interaction.reply({
                            content: `${target} has no ticket history.`,
                            ephemeral: true
                        });
                    }

                    // Sort by date (newest first)
                    userTickets.sort((a, b) => b.createdAt - a.createdAt);

                    const embed = new EmbedBuilder()
                        .setColor(client.config.embeds.color)
                        .setTitle(`Ticket History for ${target.tag}`)
                        .setDescription(`Found ${userTickets.length} tickets`)
                        .addFields(
                            { name: 'Active Tickets', value: userTickets.filter(t => !t.closed).length.toString(), inline: true },
                            { name: 'Closed Tickets', value: userTickets.filter(t => t.closed).length.toString(), inline: true },
                            { name: 'First Ticket', value: `<t:${Math.floor(userTickets[userTickets.length - 1].createdAt.getTime() / 1000)}:R>`, inline: true }
                        );

                    // Add recent tickets
                    const recentTickets = userTickets.slice(0, 5);
                    if (recentTickets.length > 0) {
                        embed.addFields({
                            name: 'Recent Tickets',
                            value: recentTickets.map(ticket => 
                                `#${ticket.id} - ${ticket.type} (${ticket.closed ? 'Closed' : 'Open'})`
                            ).join('\n'),
                            inline: false
                        });
                    }

                    return interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    });
                }

                case 'stats': {
                    const allTickets = [
                        ...Array.from(client.tickets.values()),
                        ...Array.from(client.archivedTickets.values())
                    ];

                    // Calculate statistics
                    const stats = {
                        total: allTickets.length,
                        open: allTickets.filter(t => !t.closed).length,
                        closed: allTickets.filter(t => t.closed).length,
                        types: new Map(),
                        avgResponseTime: 0,
                        avgResolutionTime: 0
                    };

                    // Calculate type distribution and times
                    let totalResponseTime = 0;
                    let totalResolutionTime = 0;
                    let responseMeasured = 0;
                    let resolutionMeasured = 0;

                    for (const ticket of allTickets) {
                        // Count ticket types
                        const typeCount = stats.types.get(ticket.type) || 0;
                        stats.types.set(ticket.type, typeCount + 1);

                        // Calculate response time
                        if (ticket.claimedAt && ticket.createdAt) {
                            totalResponseTime += ticket.claimedAt - ticket.createdAt;
                            responseMeasured++;
                        }

                        // Calculate resolution time for closed tickets
                        if (ticket.closed && ticket.closedAt && ticket.createdAt) {
                            totalResolutionTime += ticket.closedAt - ticket.createdAt;
                            resolutionMeasured++;
                        }
                    }

                    stats.avgResponseTime = responseMeasured > 0 ? 
                        totalResponseTime / responseMeasured : 0;
                    stats.avgResolutionTime = resolutionMeasured > 0 ? 
                        totalResolutionTime / resolutionMeasured : 0;

                    const embed = new EmbedBuilder()
                        .setColor(client.config.embeds.color)
                        .setTitle('Ticket System Statistics')
                        .addFields(
                            { name: 'Total Tickets', value: stats.total.toString(), inline: true },
                            { name: 'Open Tickets', value: stats.open.toString(), inline: true },
                            { name: 'Closed Tickets', value: stats.closed.toString(), inline: true },
                            { 
                                name: 'Average Response Time', 
                                value: `${Math.round(stats.avgResponseTime / 60000)} minutes`, 
                                inline: true 
                            },
                            { 
                                name: 'Average Resolution Time', 
                                value: `${Math.round(stats.avgResolutionTime / 3600000)} hours`, 
                                inline: true 
                            }
                        );

                    // Add type distribution
                    if (stats.types.size > 0) {
                        embed.addFields({
                            name: 'Ticket Types',
                            value: Array.from(stats.types.entries())
                                .map(([type, count]) => `${type}: ${count}`)
                                .join('\n'),
                            inline: false
                        });
                    }

                    return interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    });
                }
            }
        } catch (error) {
            console.error('Error viewing ticket history:', error);
            return interaction.reply({
                content: 'There was an error retrieving the ticket history.',
                ephemeral: true
            });
        }
    },
};