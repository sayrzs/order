const { Collection } = require('discord.js');

class QueueManager {
    static queues = new Collection();
    static processing = new Set();
    static processedCount = new Collection();

    static addToQueue(guildId, interaction, panelConfig) {
        const queue = this.queues.get(guildId) || [];
        
        // Add request to queue
        queue.push({
            interaction,
            panelConfig,
            timestamp: Date.now()
        });

        this.queues.set(guildId, queue);
        
        // Start processing if not already running
        if (!this.processing.has(guildId)) {
            this.processQueue(guildId);
        }

        // Return position in queue
        return queue.length;
    }

    static async processQueue(guildId) {
        if (this.processing.has(guildId)) return;
        this.processing.add(guildId);

        try {
            while (true) {
                const queue = this.queues.get(guildId) || [];
                if (queue.length === 0) {
                    break;
                }

                const request = queue[0];
                const { interaction, panelConfig } = request;

                // Check if interaction is still valid
                if (interaction.deferred || interaction.replied) {
                    queue.shift();
                    continue;
                }

                try {
                    // Process ticket creation
                    const TicketManager = require('./ticketManager');
                    await TicketManager.createTicket(interaction, panelConfig);
                    this.incrementProcessedCount(guildId);
                } catch (error) {
                    console.error('Error processing queued ticket:', error);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                content: 'There was an error processing your ticket request.',
                                ephemeral: true
                            });
                        }
                    } catch (replyError) {
                        console.error('Error sending error message:', replyError);
                    }
                }

                // Remove processed request
                queue.shift();
                
                // Add delay between processing tickets
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } finally {
            this.processing.delete(guildId);
            this.queues.delete(guildId);
        }
    }

    static getQueuePosition(guildId, userId) {
        const queue = this.queues.get(guildId) || [];
        return queue.findIndex(request => request.interaction.user.id === userId) + 1;
    }

    static getQueueStatus(guildId) {
        const queue = this.queues.get(guildId) || [];
        return {
            size: queue.length,
            processing: this.processing.has(guildId),
            oldestRequest: queue[0]?.timestamp
        };
    }

    static removeFromQueue(guildId, userId) {
        const queue = this.queues.get(guildId) || [];
        const index = queue.findIndex(request => request.interaction.user.id === userId);
        
        if (index !== -1) {
            queue.splice(index, 1);
            if (queue.length === 0) {
                this.queues.delete(guildId);
            } else {
                this.queues.set(guildId, queue);
            }
            return true;
        }
        return false;
    }

    static getDetailedQueueInfo(guildId) {
        return this.queues.get(guildId) || [];
    }

    static getQueueMetrics(guildId) {
        const queue = this.queues.get(guildId) || [];
        const now = Date.now();
        
        return {
            averageWaitTime: queue.length > 0
                ? Math.floor((now - queue.reduce((sum, req) => sum + req.timestamp, 0) / queue.length) / 1000)
                : 0,
            maxWaitTime: queue.length > 0
                ? Math.floor((now - Math.min(...queue.map(req => req.timestamp))) / 1000)
                : 0,
            ticketsProcessed: this.processedCount.get(guildId) || 0
        };
    }

    static incrementProcessedCount(guildId) {
        const current = this.processedCount.get(guildId) || 0;
        this.processedCount.set(guildId, current + 1);
    }
}

module.exports = QueueManager;