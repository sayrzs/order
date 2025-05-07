const fs = require('fs').promises;
const path = require('path');
const { differenceInHours } = require('date-fns');

class DataManager {
    static dataPath = path.join(process.cwd(), 'data');
    static ticketsFile = path.join(this.dataPath, 'tickets.json');

    static async initialize() {
        try {
            await fs.mkdir(this.dataPath, { recursive: true });
            
            // Create tickets file if it doesn't exist
            try {
                await fs.access(this.ticketsFile);
            } catch {
                await fs.writeFile(this.ticketsFile, '[]');
            }
        } catch (error) {
            console.error('Error initializing data directory:', error);
        }
    }

    static async saveTickets(tickets) {
        try {
            const ticketData = Array.from(tickets.values()).map(ticket => ({
                ...ticket,
                createdAt: ticket.createdAt.toISOString(),
                closedAt: ticket.closedAt?.toISOString(),
                claimedAt: ticket.claimedAt?.toISOString()
            }));
            
            await fs.writeFile(
                this.ticketsFile,
                JSON.stringify(ticketData, null, 2)
            );
        } catch (error) {
            console.error('Error saving tickets:', error);
        }
    }

    static async loadTickets() {
        try {
            const data = await fs.readFile(this.ticketsFile, 'utf-8');
            const tickets = JSON.parse(data).map(ticket => ({
                ...ticket,
                createdAt: new Date(ticket.createdAt),
                closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
                claimedAt: ticket.claimedAt ? new Date(ticket.claimedAt) : null
            }));

            return new Map(tickets.map(ticket => [ticket.channelId, ticket]));
        } catch (error) {
            console.error('Error loading tickets:', error);
            return new Map();
        }
    }

    static async cleanupOldTickets(client) {
        try {
            const { ticketSettings } = client.config;
            const now = new Date();
            const tickets = Array.from(client.tickets.values());

            for (const ticket of tickets) {
                if (ticket.closed && ticket.closedAt) {
                    const hoursSinceClosure = differenceInHours(now, new Date(ticket.closedAt));
                    
                    if (hoursSinceClosure >= ticketSettings.autoCloseHours) {
                        // Attempt to delete the channel
                        try {
                            const channel = await client.channels.fetch(ticket.channelId);
                            if (channel && channel.deletable) {
                                await channel.delete(`Auto-deleted after ${ticketSettings.autoCloseHours} hours`);
                            }
                        } catch (error) {
                            if (error.code === 10003) { // Unknown Channel error
                                // Channel already deleted, remove from collection
                                client.tickets.delete(ticket.channelId);
                                continue;
                            }
                            console.error(`Error deleting channel for ticket #${ticket.id}:`, error);
                        }

                        // Remove ticket from collection
                        client.tickets.delete(ticket.channelId);
                        client.emit('ticketUpdate');

                        // Log cleanup
                        const logChannel = await client.channels.fetch(ticketSettings.logChannelId);
                        if (logChannel) {
                            await logChannel.send({
                                embeds: [{
                                    color: 0x808080,
                                    title: 'Ticket Auto-Deleted',
                                    description: `Ticket #${ticket.id} has been automatically deleted after ${ticketSettings.autoCloseHours} hours of inactivity.`,
                                    fields: [