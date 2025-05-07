const { Collection } = require('discord.js');

class ErrorHandler {
    static rateLimits = new Collection();
    static errorCounts = new Collection();

    static checkRateLimit(userId, actionType, limit, cooldown) {
        const key = `${userId}-${actionType}`;
        const now = Date.now();
        const userRateLimit = this.rateLimits.get(key);

        if (userRateLimit) {
            const timePassed = now - userRateLimit.timestamp;
            const remainingActions = userRateLimit.remaining;

            if (timePassed < cooldown) {
                if (remainingActions <= 0) {
                    const waitTime = Math.ceil((cooldown - timePassed) / 1000);
                    return {
                        limited: true,
                        waitTime,
                        message: `Please wait ${waitTime} seconds before trying again.`
                    };
                }
                this.rateLimits.set(key, {
                    timestamp: userRateLimit.timestamp,
                    remaining: remainingActions - 1
                });
            } else {
                this.rateLimits.set(key, {
                    timestamp: now,
                    remaining: limit - 1
                });
            }
        } else {
            this.rateLimits.set(key, {
                timestamp: now,
                remaining: limit - 1
            });
        }

        return { limited: false };
    }

    static handleError(error, client, context) {
        const errorId = Math.random().toString(36).substring(7);
        const timestamp = new Date();

        // Log error details
        console.error(`Error ID: ${errorId}`, {
            timestamp,
            context,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });

        // Track error frequency
        const errorKey = `${error.name}-${context}`;
        const errorCount = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, errorCount + 1);

        // Alert if error frequency is high
        if (errorCount >= 5) {
            this.alertHighErrorRate(client, errorKey, errorCount);
            this.errorCounts.delete(errorKey); // Reset counter
        }

        return {
            errorId,
            userMessage: `An error occurred (ID: ${errorId}). Staff have been notified.`
        };
    }

    static async alertHighErrorRate(client, errorKey, count) {
        const { logChannelId } = client.config.ticketSettings;
        try {
            const logChannel = await client.channels.fetch(logChannelId);
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        color: 0xFF0000,
                        title: '⚠️ High Error Rate Detected',
                        description: `Error "${errorKey}" has occurred ${count} times in the last hour.`,
                        timestamp: new Date()
                    }]
                });
            }
        } catch (error) {
            console.error('Failed to send error rate alert:', error);
        }
    }

    static async recoveryAttempt(client, channelId, errorContext) {
        const ticket = client.tickets.get(channelId);
        if (!ticket) return false;

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel) {
                // Channel no longer exists, archive the ticket
                client.archivedTickets.set(ticket.id, {
                    ...ticket,
                    archivedAt: new Date(),
                    channelDeleted: true,
                    recoveryAttempted: true
                });
                client.tickets.delete(channelId);
                client.emit('ticketUpdate');
                return true;
            }

            // Verify and fix permissions if needed
            const permissionFixed = await this.verifyPermissions(channel, ticket, client);
            return permissionFixed;
        } catch (error) {
            console.error('Recovery attempt failed:', error);
            return false;
        }
    }

    static async verifyPermissions(channel, ticket, client) {
        try {
            const currentPerms = channel.permissionOverwrites.cache;
            let fixed = false;

            // Verify user permissions
            if (!currentPerms.has(ticket.userId)) {
                await channel.permissionOverwrites.edit(ticket.userId, {
                    ViewChannel: !ticket.closed,
                    SendMessages: !ticket.closed
                });
                fixed = true;
            }

            // Verify staff role permissions
            for (const roleId of client.config.staffRoles) {
                if (!currentPerms.has(roleId)) {
                    await channel.permissionOverwrites.edit(roleId, {
                        ViewChannel: true,
                        SendMessages: true
                    });
                    fixed = true;
                }
            }

            return fixed;
        } catch (error) {
            console.error('Permission verification failed:', error);
            return false;
        }
    }
}

module.exports = ErrorHandler;