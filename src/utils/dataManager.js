const fs = require('fs').promises;
const path = require('path');

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
}

module.exports = DataManager;