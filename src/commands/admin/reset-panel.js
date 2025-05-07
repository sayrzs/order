const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-panel')
        .setDescription('Remove or update ticket panels')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel containing the panel to reset')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('delete')
                .setDescription('Delete the panel instead of updating it')
                .setRequired(false)),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const shouldDelete = interaction.options.getBoolean('delete') || false;

        try {
            // Fetch last 100 messages to find panels
            const messages = await channel.messages.fetch({ limit: 100 });
            const panelMessages = messages.filter(msg => 
                msg.author.id === interaction.client.user.id && 
                msg.components.length > 0 &&
                msg.embeds.length > 0 &&
                msg.embeds[0].title?.includes('Support Ticket System')
            );

            if (panelMessages.size === 0) {
                return interaction.reply({
                    content: 'No ticket panels found in the specified channel.',
                    ephemeral: true
                });
            }

            if (shouldDelete) {
                // Delete all panel messages
                await Promise.all(panelMessages.map(msg => msg.delete()));
                
                return interaction.reply({
                    content: `Successfully deleted ${panelMessages.size} ticket panel(s).`,
                    ephemeral: true
                });
            } else {
                // Update all panel messages
                const { config } = interaction.client;
                await Promise.all(panelMessages.map(msg => {
                    const embed = msg.embeds[0].toJSON();
                    embed.color = parseInt(config.embeds.color.replace('#', ''), 16);
                    embed.footer = { text: config.embeds.footerText };
                    if (config.embeds.thumbnailUrl) {
                        embed.thumbnail = { url: config.embeds.thumbnailUrl };
                    }
                    
                    return msg.edit({
                        embeds: [embed],
                        components: msg.components
                    });
                }));

                return interaction.reply({
                    content: `Successfully updated ${panelMessages.size} ticket panel(s).`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: 'There was an error managing the ticket panels.',
                ephemeral: true
            });
        }
    },
};