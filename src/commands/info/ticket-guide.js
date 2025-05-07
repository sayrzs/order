const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-guide')
        .setDescription('Get step-by-step guidance for ticket operations')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('Select a guide topic')
                .setRequired(true)
                .addChoices(
                    { name: 'Creating a Ticket', value: 'create' },
                    { name: 'Using Ticket Commands', value: 'commands' },
                    { name: 'Best Practices', value: 'best-practices' },
                    { name: 'Staff Guidelines', value: 'staff' }
                )),

    async execute(interaction) {
        const topic = interaction.options.getString('topic');
        const { client } = interaction;

        const guides = {
            create: {
                title: '📝 How to Create a Ticket',
                description: 'Follow these steps to create a support ticket:',
                steps: [
                    '1️⃣ Go to the ticket creation channel',
                    '2️⃣ Choose the appropriate category button',
                    '3️⃣ Fill out any required information',
                    '4️⃣ Wait for staff response',
                    '5️⃣ Keep your ticket updated with relevant information'
                ],
                tips: [
                    'Be clear and concise about your issue',
                    'Include any relevant screenshots or information',
                    'Be patient while waiting for a response',
                    `Check \`/queue-status\` for current wait times`
                ]
            },
            commands: {
                title: '⌨️ Essential Ticket Commands',
                description: 'Here are the main commands you can use in tickets:',
                steps: [
                    '`/add @user` - Add someone to your ticket',
                    '`/remove @user` - Remove someone from your ticket',
                    '`/transcript` - Get a copy of the ticket conversation',
                    '`/close` - Close your ticket when resolved'
                ],
                tips: [
                    'Use commands only when necessary',
                    'Staff has additional commands available',
                    'Check `/faq commands` for more details',
                    'Ask staff if you\'re unsure about a command'
                ]
            },
            'best-practices': {
                title: '✨ Ticket Best Practices',
                description: 'Follow these guidelines for the best support experience:',
                steps: [
                    '📌 Keep information organized and clear',
                    '🔍 Provide detailed descriptions',
                    '⏱️ Respond promptly to staff questions',
                    '📋 Use proper formatting for logs/code',
                    '🎯 Stay on topic in your ticket'
                ],
                tips: [
                    'Don\'t open multiple tickets for the same issue',
                    'Update your ticket if the situation changes',
                    'Be respectful and patient with staff',
                    'Save important information shared in your ticket'
                ]
            },
            staff: {
                title: '👮 Staff Guidelines',
                description: 'Essential guidelines for handling tickets:',
                steps: [
                    '1️⃣ Claim tickets promptly when available',
                    '2️⃣ Use appropriate tags for organization',
                    '3️⃣ Keep ticket updates professional',
                    '4️⃣ Transfer tickets when necessary',
                    '5️⃣ Document important decisions'
                ],
                tips: [
                    'Maintain consistent response times',
                    'Use ticket notes for internal comments',
                    'Follow the escalation protocol',
                    'Keep track of your ticket statistics'
                ]
            }
        };

        const guide = guides[topic];
        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTitle(guide.title)
            .setDescription(guide.description)
            .addFields(
                {
                    name: topic === 'commands' ? 'Available Commands' : 'Steps',
                    value: guide.steps.join('\n'),
                    inline: false
                },
                {
                    name: '💡 Tips',
                    value: guide.tips.join('\n'),
                    inline: false
                }
            );

        // Add specific notes based on topic
        if (topic === 'staff' && !interaction.member.roles.cache.some(role => 
            client.config.staffRoles.includes(role.id) ||
            role.id === client.config.adminRole
        )) {
            embed.setDescription('⚠️ This guide is only available to staff members.');
            return interaction.reply({ content: 'You do not have permission to view staff guidelines.', ephemeral: true });
        }

        embed.setFooter({ text: 'Use /faq for more detailed information' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: topic === 'staff' });
    },
};