const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send-panel')
        .setDescription('Send a ticket panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send the panel to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('style')
                .setDescription('Panel style')
                .setRequired(true)
                .addChoices(
                    { name: 'Buttons', value: 'buttons' },
                    { name: 'Select Menu', value: 'select' }
                ))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Custom panel description')
                .setRequired(false)),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const style = interaction.options.getString('style');
        const customDescription = interaction.options.getString('description');
        const { config } = interaction.client;

        const embed = {
            color: parseInt(config.embeds.color.replace('#', ''), 16),
            title: 'Support Ticket System',
            description: customDescription || 'Please select a category below to create a ticket.',
            footer: { text: config.embeds.footerText },
            timestamp: new Date()
        };

        if (config.embeds.thumbnailUrl) {
            embed.thumbnail = { url: config.embeds.thumbnailUrl };
        }

        let components = [];

        if (style === 'buttons') {
            const row = new ActionRowBuilder();
            config.panels.forEach((panel, index) => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`create_ticket_${index}`)
                        .setLabel(panel.name)
                        .setEmoji(panel.emoji)
                        .setStyle(ButtonStyle.Primary)
                );
            });
            components = [row];
        } else {
            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_category')
                .setPlaceholder('Select a category')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(config.panels.map((panel, index) => ({
                    label: panel.name,
                    description: panel.description,
                    emoji: panel.emoji,
                    value: `create_ticket_${index}`
                })));
            components = [new ActionRowBuilder().addComponents(menu)];
        }

        try {
            await channel.send({ embeds: [embed], components });
            return interaction.reply({
                content: `Ticket panel sent to ${channel}!`,
                ephemeral: true
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: 'There was an error sending the ticket panel.',
                ephemeral: true
            });
        }
    },
};