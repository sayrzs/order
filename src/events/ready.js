const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        // Initialize ticket collection from existing channels
        const guilds = await client.guilds.fetch();
        
        for (const [_, guild] of guilds) {
            const resolvedGuild = await guild.fetch();
            const ticketCategory = await resolvedGuild.channels.fetch(client.config.ticketSettings.categoryId);
            
            if (ticketCategory) {
                const ticketChannels = ticketCategory.children.cache.filter(channel => 
                    channel.name.startsWith('ticket-')
                );

                for (const [channelId, channel] of ticketChannels) {
                    const ticketNumber = channel.name.split('-')[1];
                    if (!isNaN(ticketNumber)) {
                        const firstMessage = (await channel.messages.fetch({ limit: 1 })).first();
                        if (firstMessage) {
                            const ticket = {
                                id: ticketNumber,
                                channelId: channelId,
                                userId: firstMessage.mentions.users.first()?.id,
                                type: firstMessage.embeds[0]?.title?.split(' ')[0] || 'Support',
                                createdAt: channel.createdAt,
                                closed: false
                            };
                            client.tickets.set(channelId, ticket);
                        }
                    }
                }
            }
        }

        // Start cleanup interval for transcripts
        setInterval(async () => {
            const transcriptChannel = await client.channels.fetch(client.config.ticketSettings.transcriptChannelId);
            if (transcriptChannel) {
                const messages = await transcriptChannel.messages.fetch();
                const expiryTime = Date.now() - (client.config.ticketSettings.transcriptExpiryHours * 3600000);
                
                messages.forEach(message => {
                    if (message.createdTimestamp < expiryTime) {
                        message.delete().catch(console.error);
                    }
                });
            }
        }, 3600000); // Check every hour "YOU CAN CHANGE THIS TO 1 MINUTE FOR TESTING"
        // Log the number of active tickets
        const activeTickets = client.tickets.filter(ticket => !ticket.closed).size;
        console.log(`Active tickets: ${activeTickets}`);
        // Log the number of closed tickets
        /* const closedTickets = client.tickets.filter(ticket => ticket.closed).size;
        console.log(`Closed tickets: ${closedTickets}`);
        */
        console.log(`Ready! Loaded ${client.tickets.size} active tickets.`);
    },
};