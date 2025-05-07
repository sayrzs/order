const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class ConfirmationHandler {
    static createConfirmationButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_action')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel_action')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );
    }

    static async awaitConfirmation(interaction, content) {
        const components = this.createConfirmationButtons();
        const response = await interaction.reply({
            content,
            components: [components],
            ephemeral: true,
            fetchReply: true
        });

        try {
            const confirmation = await response.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 30000
            });

            return confirmation.customId === 'confirm_action';
        } catch (error) {
            await interaction.editReply({
                content: 'Confirmation timed out.',
                components: []
            });
            return false;
        }
    }
}

module.exports = ConfirmationHandler;