const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('faq')
        .setDescription('Show frequently asked questions about the ticket system')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Specific FAQ category to view')
                .setRequired(false)
                .addChoices(
                    { name: 'General', value: 'general' },
                    { name: 'Staff', value: 'staff' },
                    { name: 'Commands', value: 'commands' },
                    { name: 'Support', value: 'support' }
                )),

    async execute(interaction) {
        const category = interaction.options.getString('category') || 'general';
        const { client } = interaction;

        const faqs = {
            general: [
                ['How do I create a ticket?', 'Use the ticket panel in the designated channel and click the appropriate button for your issue.'],
                ['How long until my ticket is answered?', 'Wait times vary based on staff availability and ticket volume. You can check queue status with `/queue-status`.'],
                ['Can I have multiple tickets open?', `No, you can only have ${client.config.ticketSettings.maxConcurrentTickets || 1} ticket(s) open at a time.`],
                ['What happens to closed tickets?', 'Closed tickets are archived and can be accessed by staff. You can request a transcript before closing.']
            ],
            staff: [
                ['How do I claim a ticket?', 'Click the claim button in the ticket or use the claim command to take ownership of a ticket.'],
                ['How do I transfer a ticket?', 'You can transfer ownership of a claimed ticket to another staff member using the transfer command.'],
                ['What are ticket tags?', 'Tags help categorize and track tickets. Add tags with `/tag add` for better organization.'],
                ['How do I view ticket stats?', 'Use `/stats` to view ticket statistics and staff performance metrics.']
            ],
            commands: [
                ['What are the basic commands?', '`/close`, `/add`, `/remove`, `/transcript` - These are the main ticket management commands.'],
                ['How do I rename a ticket?', 'Use `/rename` to change the ticket channel name for better organization.'],
                ['Can I reopen a ticket?', 'Staff can reopen closed tickets using `/reopen` if further assistance is needed.'],
                ['How do I view ticket history?', 'Use `/history` to search through past tickets and view user history.']
            ],
            support: [
                ['What info should I provide?', 'Be clear about your issue, provide relevant details, and follow staff instructions.'],
                ['How do I add someone to my ticket?', 'Staff can add others using `/add @user`. Only request this if necessary.'],
                ['What if my ticket is closed?', 'If you need further help after closure, create a new ticket or ask staff to reopen it.'],
                ['How do I contact staff directly?', 'Always use the ticket system. Direct messages to staff about issues are discouraged.']
            ]
        };

        const titles = {
            general: '📚 General FAQ',
            staff: '👮 Staff FAQ',
            commands: '⌨️ Commands FAQ',
            support: '🆘 Support FAQ'
        };

        const embed = new EmbedBuilder()
            .setColor(client.config.embeds.color)
            .setTitle(titles[category])
            .setDescription('Here are some frequently asked questions and their answers:')
            .addFields(
                faqs[category].map(([question, answer]) => ({
                    name: `Q: ${question}`,
                    value: `A: ${answer}`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Use /faq [category] to view other categories' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};