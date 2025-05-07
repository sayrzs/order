const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tag')
        .setDescription('Mention a role or user in the ticket')
        .addMentionableOption(option =>
            option.setName('target')
                .setDescription('The role or user to mention')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Optional message to include with the mention')
                .setRequired(false)),

    async execute(interaction) {
        const { channel, client } = interaction;
        const ticket = client.tickets.get(channel.id);
        const target = interaction.options.getMentionable('target');
        const message = interaction.options.getString('message');

        if (!ticket) {
            return interaction.reply({
                content: 'This command can only be used in ticket channels!',
                ephemeral: true
            });
        }

        const hasPermission = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            ) || interaction.user.id === ticket.userId;

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to use this command!',
                ephemeral: true
            });
        }

        // Check if target is staff role when used by non-staff
        if (!interaction.member.roles.cache.some(role => 
            client.config.staffRoles.includes(role.id) ||
            role.id === client.config.adminRole)) {
            const isStaffRole = client.config.staffRoles.includes(target.id) ||
                              target.id === client.config.adminRole;
            
            if (isStaffRole) {
                return interaction.reply({
                    content: 'You can only tag staff members if you are staff yourself.',
                    ephemeral: true
                });
            }
        }

        const content = message 
            ? `${target}: ${message}`
            : `${target}`;

        await interaction.reply({
            content,
            allowedMentions: { parse: ['users', 'roles'] }
        });
    },
};