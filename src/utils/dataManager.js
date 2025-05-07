const fs = require('fs').promises;
const path = require('path');
const { Collection } = require('discord.js');
const { differenceInHours } = require('date-fns');

class DataManager {
    static async initialize() {
        try {
            await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
            await fs.mkdir(path.join(process.cwd(), 'data', 'archives'), { recursive: true });
            await this.loadData();
        } catch (error) {
            console.error('Error initializing DataManager:', error);
        }
    }

    static async loadData() {
        try {
            // Load active tickets
            const ticketsPath = path.join(process.cwd(), 'data', 'tickets.json');
            const ticketData = await fs.readFile(ticketsPath, 'utf8').catch(() => '{}');
            this.tickets = new Collection(Object.entries(JSON.parse(ticketData)));

            // Load archived tickets
            const archivesPath = path.join(process.cwd(), 'data', 'archives');
            const archiveFiles = await fs.readdir(archivesPath);
            this.archivedTickets = new Collection();

            for (const file of archiveFiles) {
                if (file.endsWith('.json')) {
                    const archiveData = await fs.readFile(path.join(archivesPath, file), 'utf8');
                    const tickets = JSON.parse(archiveData);
                    for (const [id, ticket] of Object.entries(tickets)) {
                        this.archivedTickets.set(id, ticket);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.tickets = new Collection();
            this.archivedTickets = new Collection();
        }
    }

    static async saveTicket(ticketId, ticketData) {
        try {
            const tickets = Object.fromEntries(this.tickets);
            tickets[ticketId] = ticketData;
            await fs.writeFile(
                path.join(process.cwd(), 'data', 'tickets.json'),
                JSON.stringify(tickets, null, 2)
            );
            this.tickets.set(ticketId, ticketData);
        } catch (error) {
            console.error('Error saving ticket:', error);
        }
    }

    static async archiveTicket(ticketId, ticketData) {
        try {
            // Remove from active tickets
            this.tickets.delete(ticketId);
            await fs.writeFile(
                path.join(process.cwd(), 'data', 'tickets.json'),
                JSON.stringify(Object.fromEntries(this.tickets), null, 2)
            );

            // Add to archived tickets
            const archiveDate = new Date();
            const archiveMonth = `${archiveDate.getFullYear()}-${String(archiveDate.getMonth() + 1).padStart(2, '0')}`;
            const archivePath = path.join(process.cwd(), 'data', 'archives', `${archiveMonth}.json`);

            let monthlyArchive = {};
            try {
                const existingData = await fs.readFile(archivePath, 'utf8');
                monthlyArchive = JSON.parse(existingData);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('Error reading archive:', error);
                }
            }

            monthlyArchive[ticketId] = {
                ...ticketData,
                archivedAt: archiveDate.toISOString()
            };

            await fs.writeFile(archivePath, JSON.stringify(monthlyArchive, null, 2));
            this.archivedTickets.set(ticketId, monthlyArchive[ticketId]);

            // Cleanup old archives (keep last 6 months)
            await this.cleanupOldArchives();
        } catch (error) {
            console.error('Error archiving ticket:', error);
        }
    }

    static async cleanupOldArchives() {
        try {
            const archivesPath = path.join(process.cwd(), 'data', 'archives');
            const files = await fs.readdir(archivesPath);
            const sortedFiles = files
                .filter(file => file.endsWith('.json'))
                .sort((a, b) => b.localeCompare(a));

            // Keep last 6 months of archives
            if (sortedFiles.length > 6) {
                const filesToDelete = sortedFiles.slice(6);
                for (const file of filesToDelete) {
                    await fs.unlink(path.join(archivesPath, file));
                }
            }
        } catch (error) {
            console.error('Error cleaning up old archives:', error);
        }
    }

    static async getTicketHistory(userId) {
        const userTickets = [];
        this.archivedTickets.forEach((ticket, id) => {
            if (ticket.userId === userId) {
                userTickets.push({ id, ...ticket });
            }
        });
        return userTickets.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    static async getStaffStats(staffId, startDate, endDate) {
        const stats = {
            ticketsClosed: 0,
            ticketsClaimed: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            responseCount: 0
        };

        this.archivedTickets.forEach(ticket => {
            const ticketDate = new Date(ticket.createdAt);
            if (ticketDate >= startDate && ticketDate <= endDate) {
                if (ticket.closedBy === staffId) {
                    stats.ticketsClosed++;
                }
                if (ticket.claimedBy === staffId) {
                    stats.ticketsClaimed++;
                    if (ticket.claimedAt && ticket.createdAt) {
                        const responseTime = new Date(ticket.claimedAt) - new Date(ticket.createdAt);
                        stats.totalResponseTime += responseTime;
                        stats.responseCount++;
                    }
                }
            }
        });

        if (stats.responseCount > 0) {
            stats.averageResponseTime = Math.floor(
                stats.totalResponseTime / stats.responseCount / 1000 / 60
            );
        }

        return stats;
    }

    static async deleteTicketData(ticketId) {
        this.tickets.delete(ticketId);
        this.archivedTickets.delete(ticketId);
        await this.saveAllData();
    }

    static async saveAllData() {
        try {
            // Save active tickets
            await fs.writeFile(
                path.join(process.cwd(), 'data', 'tickets.json'),
                JSON.stringify(Object.fromEntries(this.tickets), null, 2)
            );

            // Group archived tickets by month
            const archivesByMonth = new Map();
            this.archivedTickets.forEach((ticket, id) => {
                const archiveDate = new Date(ticket.archivedAt);
                const monthKey = `${archiveDate.getFullYear()}-${String(archiveDate.getMonth() + 1).padStart(2, '0')}`;
                if (!archivesByMonth.has(monthKey)) {
                    archivesByMonth.set(monthKey, {});
                }
                archivesByMonth.get(monthKey)[id] = ticket;
            });

            // Save each month's archive
            for (const [month, tickets] of archivesByMonth) {
                await fs.writeFile(
                    path.join(process.cwd(), 'data', 'archives', `${month}.json`),
                    JSON.stringify(tickets, null, 2)
                );
            }
        } catch (error) {
            console.error('Error saving all data:', error);
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
                                // Channel already deleted, move to archive
                                client.archivedTickets.set(ticket.id, {
                                    ...ticket,
                                    archivedAt: now,
                                    channelDeleted: true
                                });
                                client.tickets.delete(ticket.channelId);
                                continue;
                            }
                            console.error(`Error deleting channel for ticket #${ticket.id}:`, error);
                        }

                        // Move to archive and remove from active tickets
                        client.archivedTickets.set(ticket.id, {
                            ...ticket,
                            archivedAt: now,
                            channelDeleted: true
                        });
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
                                        { name: 'Created By', value: `<@${ticket.userId}>`, inline: true },
                                        { name: 'Type', value: ticket.type, inline: true },
                                        { name: 'Closed At', value: `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:R>`, inline: true }
                                    ],
                                    timestamp: new Date()
                                }]
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error during ticket cleanup:', error);
        }
    }

    static startCleanupInterval(client) {
        // Run cleanup every hour
        setInterval(() => this.cleanupOldTickets(client), 3600000);
    }
}

module.exports = DataManager;