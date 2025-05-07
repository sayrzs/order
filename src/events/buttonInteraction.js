const { Events } = require('discord.js');
const TicketManager = require('../utils/ticketManager');
const ConfirmationHandler = require('../utils/confirmationHandler');
const QueueManager = require('../utils/queueManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle button interactions
        if (interaction.isButton()) {
            const { customId } = interaction;

            // Handle confirmation buttons
            if (customId === 'confirm_action' || customId === 'cancel_action') {
                // These are handled by the ConfirmationHandler
                return;
            }

            // Handle ticket creation buttons
            if (customId.startsWith('create_ticket_')) {
                const panelIndex = parseInt(customId.split('_')[2]);
                const panelConfig = interaction.client.config.panels[panelIndex];
                
                if (panelConfig) {
                    const queuePosition = QueueManager.addToQueue(
                        interaction.guildId,
                        interaction,
                        panelConfig
                    );

                    if (queuePosition > 1) {
                        await interaction.reply({
                            content: `Your ticket request has been queued. Position in queue: ${queuePosition}`,
                            ephemeral: true
                        });
                    }
                }
                return;
            }

            // Handle close ticket button
            if (customId === 'close_ticket') {
                const hasPermission = interaction.member.roles.cache
                    .some(role => 
                        interaction.client.config.staffRoles.includes(role.id) ||
                        role.id === interaction.client.config.adminRole
                    );
                
                if (!hasPermission) {
                    return interaction.reply({
                        content: 'You do not have permission to close tickets!',
                        ephemeral: true
                    });
                }

                const confirmed = await ConfirmationHandler.awaitConfirmation(
                    interaction,
                    'Are you sure you want to close this ticket?\n\nThis action will:\n- Generate a transcript\n- Archive the ticket\n- Delete the channel after the configured time'
                );

                if (confirmed) {
                    await TicketManager.closeTicket(interaction);
                }
            }

            // Handle claim ticket button
            if (customId === 'claim_ticket') {
                const hasStaffRole = interaction.member.roles.cache
                    .some(role => interaction.client.config.staffRoles.includes(role.id));
                
                if (!hasStaffRole) {
                    return interaction.reply({
                        content: 'Only staff members can claim tickets!',
                        ephemeral: true
                    });
                }

                const ticket = interaction.client.tickets.get(interaction.channel.id);
                if (ticket && !ticket.claimedBy) {
                    ticket.claimedBy = interaction.user.id;
                    ticket.claimedAt = new Date();
                    interaction.client.tickets.set(interaction.channel.id, ticket);
                    interaction.client.emit('ticketUpdate');

                    await interaction.reply({
                        content: `Ticket claimed by ${interaction.user}`,
                    });
                } else if (ticket?.claimedBy) {
                    await interaction.reply({
                        content: 'This ticket has already been claimed!',
                        ephemeral: true
                    });
                }
            }
        }

        // Handle select menu interactions
        if (interaction.isStringSelectMenu()) {
            const { customId, values } = interaction;

            if (customId === 'ticket_category') {
                const selectedValue = values[0]; // Get first selected value
                if (selectedValue.startsWith('create_ticket_')) {
                    const panelIndex = parseInt(selectedValue.split('_')[2]);
                    const panelConfig = interaction.client.config.panels[panelIndex];
                    
                    if (panelConfig) {
                        const queuePosition = QueueManager.addToQueue(
                            interaction.guildId,
                            interaction,
                            panelConfig
                        );

                        if (queuePosition > 1) {
                            await interaction.reply({
                                content: `Your ticket request has been queued. Position in queue: ${queuePosition}`,
                                ephemeral: true
                            });
                        }
                    }
                }
            }
        }
    },
};