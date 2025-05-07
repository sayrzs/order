const TicketManager = require('./ticketManager');
const ErrorHandler = require('./errorHandler');

class VerificationRoutine {
    static async verifyAllTickets(client) {
        try {
            const tickets = Array.from(client.tickets.values());
            const issues = [];

            for (const ticket of tickets) {
                // Verify channel exists and permissions are correct
                const isValid = await TicketManager.verifyTicket(client, ticket.channelId);
                
                if (!isValid) {
                    issues.push({
                        ticketId: ticket.id,
                        type: 'invalid_channel',
                        message: 'Channel no longer exists or has invalid permissions'
                    });
                    continue;
                }

                // Verify ticket data consistency
                const dataIssues = this.verifyTicketData(ticket);
                if (dataIssues.length > 0) {
                    issues.push(...dataIssues.map(issue => ({
                        ticketId: ticket.id,
                        ...issue
                    })));
                }
            }

            // Report issues if any found
            if (issues.length > 0) {
                await this.reportIssues(client, issues);
            }

            return issues.length === 0;
        } catch (error) {
            ErrorHandler.handleError(error, client, 'verifyAllTickets');
            return false;
        }
    }

    static verifyTicketData(ticket) {
        const issues = [];

        // Check required fields
        const requiredFields = ['id', 'channelId', 'userId', 'type', 'createdAt'];
        for (const field of requiredFields) {
            if (!ticket[field]) {
                issues.push({
                    type: 'missing_field',
                    message: `Missing required field: ${field}`
                });
            }
        }

        // Verify date fields
        const dateFields = ['createdAt', 'closedAt', 'claimedAt'];
        for (const field of dateFields) {
            if (ticket[field] && !(ticket[field] instanceof Date)) {
                issues.push({
                    type: 'invalid_date',
                    message: `Invalid date for field: ${field}`
                });
            }
        }

        // Verify logical consistency
        if (ticket.closed && !ticket.closedAt) {
            issues.push({
                type: 'inconsistent_state',
                message: 'Ticket marked as closed but has no closedAt timestamp'
            });
        }

        if (ticket.claimedBy && !ticket.claimedAt) {
            issues.push({
                type: 'inconsistent_state',
                message: 'Ticket has claimedBy but no claimedAt timestamp'
            });
        }

        return issues;
    }

    static async reportIssues(client, issues) {
        const { logChannelId } = client.config.ticketSettings;
        try {
            const logChannel = await client.channels.fetch(logChannelId);
            if (logChannel) {
                const issueGroups = this.groupIssuesByType(issues);
                
                for (const [type, typeIssues] of Object.entries(issueGroups)) {
                    await logChannel.send({
                        embeds: [{
                            color: 0xFFA500,
                            title: '🔧 Ticket System Issues Detected',
                            description: `Found ${typeIssues.length} issues of type: ${type}`,
                            fields: typeIssues.slice(0, 10).map(issue => ({
                                name: `Ticket #${issue.ticketId}`,
                                value: issue.message,
                                inline: false
                            })),
                            footer: {
                                text: typeIssues.length > 10 ? 
                                    `And ${typeIssues.length - 10} more issues...` : 
                                    'All issues shown'
                            },
                            timestamp: new Date()
                        }]
                    });
                }
            }
        } catch (error) {
            console.error('Failed to report verification issues:', error);
        }
    }

    static groupIssuesByType(issues) {
        return issues.reduce((groups, issue) => {
            const type = issue.type;
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(issue);
            return groups;
        }, {});
    }

    static startVerificationInterval(client) {
        // Run verification every 6 hours
        setInterval(() => this.verifyAllTickets(client), 21600000);
    }
}

module.exports = VerificationRoutine;