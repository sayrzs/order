const { SlashCommandBuilder } = require('discord.js');
const TicketManager = require('../../utils/ticketManager');
const ConfirmationHandler = require('../../utils/confirmationHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for closing the ticket')
                .setRequired(false)),

    async execute(interaction) {
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

        const reason = interaction.options.getString('reason') || 'No reason provided';
        const confirmed = await ConfirmationHandler.awaitConfirmation(
            interaction,
            `Are you sure you want to close this ticket?\nReason: ${reason}\n\nThis action will:\n- Generate a transcript\n- Archive the ticket\n- Delete the channel in ${interaction.client.config.ticketSettings.autoCloseHours} hours`
        );

        if (confirmed) {
            await TicketManager.closeTicket(interaction, reason);
        }
    },
};