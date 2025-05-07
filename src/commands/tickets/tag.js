const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tag')
        .setDescription('Manage and use response templates')
        .addSubcommand(subcommand =>
            subcommand
                .setName('use')
                .setDescription('Use a response template')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the template to use')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to mention (optional)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new response template')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the template')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('content')
                        .setDescription('Content of the template')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a response template')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the template to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available templates')),

    async execute(interaction) {
        const { client } = interaction;
        const subcommand = interaction.options.getSubcommand();

        // Load tags file
        const tagsPath = path.join(process.cwd(), 'data', 'tags.json');
        let tags = {};
        try {
            const data = await fs.readFile(tagsPath, 'utf8');
            tags = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading tags:', error);
            }
        }

        // Check staff permission for management commands
        const isStaff = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            );

        switch (subcommand) {
            case 'use': {
                const name = interaction.options.getString('name').toLowerCase();
                const mentionUser = interaction.options.getUser('user');
                
                if (!tags[name]) {
                    return interaction.reply({
                        content: 'That template does not exist!',
                        ephemeral: true
                    });
                }

                // Check if in ticket channel
                const ticket = client.tickets.get(interaction.channel.id);
                if (!ticket && !isStaff) {
                    return interaction.reply({
                        content: 'This command can only be used in ticket channels!',
                        ephemeral: true
                    });
                }

                let content = tags[name].content;
                if (mentionUser) {
                    content = `${mentionUser}, ${content}`;
                }

                return interaction.reply({ content });
            }

            case 'add': {
                if (!isStaff) {
                    return interaction.reply({
                        content: 'Only staff members can manage templates!',
                        ephemeral: true
                    });
                }

                const name = interaction.options.getString('name').toLowerCase();
                const content = interaction.options.getString('content');

                if (tags[name]) {
                    return interaction.reply({
                        content: 'A template with that name already exists!',
                        ephemeral: true
                    });
                }

                tags[name] = {
                    content,
                    author: interaction.user.id,
                    createdAt: new Date().toISOString()
                };

                await fs.mkdir(path.dirname(tagsPath), { recursive: true });
                await fs.writeFile(tagsPath, JSON.stringify(tags, null, 2));

                return interaction.reply({
                    content: `Template "${name}" has been added!`,
                    ephemeral: true
                });
            }

            case 'remove': {
                if (!isStaff) {
                    return interaction.reply({
                        content: 'Only staff members can manage templates!',
                        ephemeral: true
                    });
                }

                const name = interaction.options.getString('name').toLowerCase();

                if (!tags[name]) {
                    return interaction.reply({
                        content: 'That template does not exist!',
                        ephemeral: true
                    });
                }

                delete tags[name];
                await fs.writeFile(tagsPath, JSON.stringify(tags, null, 2));

                return interaction.reply({
                    content: `Template "${name}" has been removed!`,
                    ephemeral: true
                });
            }

            case 'list': {
                const embed = new EmbedBuilder()
                    .setColor(client.config.embeds.color)
                    .setTitle('Available Response Templates')
                    .setTimestamp();

                if (Object.keys(tags).length === 0) {
                    embed.setDescription('No templates available.');
                } else {
                    const fields = [];
                    for (const [name, tag] of Object.entries(tags)) {
                        fields.push({
                            name,
                            value: [
                                `Created by: <@${tag.author}>`,
                                `Created: <t:${Math.floor(new Date(tag.createdAt).getTime() / 1000)}:R>`,
                                `Content: ${tag.content.length > 100 ? 
                                    tag.content.substring(0, 97) + '...' : 
                                    tag.content}`
                            ].join('\n'),
                            inline: false
                        });
                    }
                    embed.addFields(fields);
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }
        }
    },
};