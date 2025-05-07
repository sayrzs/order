const { SlashCommandBuilder } = require('discord.js');
const TicketManager = require('../../utils/ticketManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tag')
        .setDescription('Manage tags for the current ticket')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add tags to the ticket')
                .addStringOption(option =>
                    option.setName('tags')
                        .setDescription('Tags to add (comma-separated)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove tags from the ticket')
                .addStringOption(option =>
                    option.setName('tags')
                        .setDescription('Tags to remove (comma-separated)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all tags on the ticket')),

    async execute(interaction) {
        const { channel, client } = interaction;
        const ticket = client.tickets.get(channel.id);

        if (!ticket) {
            return interaction.reply({
                content: 'This command can only be used in ticket channels!',
                ephemeral: true
            });
        }

        // Check permissions
        const hasPermission = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        if (!hasPermission) {
            return interaction.reply({
                content: 'Only staff members can manage ticket tags!',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'add': {
                    const tagsInput = interaction.options.getString('tags');
                    const newTags = tagsInput.split(',')
                        .map(tag => tag.trim().toLowerCase())
                        .filter(tag => tag.length > 0);

                    if (newTags.length === 0) {
                        return interaction.reply({
                            content: 'Please provide valid tags!',
                            ephemeral: true
                        });
                    }

                    // Get existing tags or initialize empty array
                    const existingTags = ticket.tags || [];
                    
                    // Add new tags (avoiding duplicates)
                    const updatedTags = [...new Set([...existingTags, ...newTags])];

                    // Update ticket
                    await TicketManager.updateTicket(client, channel.id, {
                        tags: updatedTags
                    });

                    return interaction.reply({
                        content: `Added tags: ${newTags.join(', ')}`,
                        allowedMentions: { parse: [] }
                    });
                }

                case 'remove': {
                    const tagsInput = interaction.options.getString('tags');
                    const tagsToRemove = new Set(
                        tagsInput.split(',')
                            .map(tag => tag.trim().toLowerCase())
                            .filter(tag => tag.length > 0)
                    );

                    if (!ticket.tags || ticket.tags.length === 0) {
                        return interaction.reply({
                            content: 'This ticket has no tags to remove!',
                            ephemeral: true
                        });
                    }

                    const updatedTags = ticket.tags.filter(tag => !tagsToRemove.has(tag));

                    // Update ticket
                    await TicketManager.updateTicket(client, channel.id, {
                        tags: updatedTags
                    });

                    return interaction.reply({
                        content: `Removed tags: ${Array.from(tagsToRemove).join(', ')}`,
                        allowedMentions: { parse: [] }
                    });
                }

                case 'list': {
                    if (!ticket.tags || ticket.tags.length === 0) {
                        return interaction.reply({
                            content: 'This ticket has no tags.',
                            ephemeral: true
                        });
                    }

                    return interaction.reply({
                        content: `Current tags: ${ticket.tags.join(', ')}`,
                        allowedMentions: { parse: [] }
                    });
                }
            }
        } catch (error) {
            console.error('Error managing ticket tags:', error);
            return interaction.reply({
                content: 'There was an error managing the ticket tags.',
                ephemeral: true
            });
        }
    },
};