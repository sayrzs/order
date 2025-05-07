const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createTranscript } = require('discord-html-transcripts');
const { addHours } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transcript')
        .setDescription('Generate a transcript of the ticket')
        .addStringOption(option =>
            option.setName('ticket-id')
                .setDescription('ID of an archived ticket to view transcript (staff only)')
                .setRequired(false)),

    async execute(interaction) {
        const { channel, client, guild } = interaction;
        const requestedId = interaction.options.getString('ticket-id');
        
        // Check staff permission if requesting archived ticket
        if (requestedId) {
            const hasPermission = interaction.member.roles.cache
                .some(role => 
                    client.config.staffRoles.includes(role.id) ||
                    role.id === client.config.adminRole
                );

            if (!hasPermission) {
                return interaction.reply({
                    content: 'You do not have permission to view archived ticket transcripts!',
                    ephemeral: true
                });
            }

            // Try to find archived ticket
            const archivedTicket = client.archivedTickets.get(requestedId);
            if (!archivedTicket) {
                return interaction.reply({
                    content: 'Could not find an archived ticket with that ID.',
                    ephemeral: true
                });
            }

            // Check if transcript already exists
            const transcriptChannel = await guild.channels.fetch(client.config.ticketSettings.transcriptChannelId);
            if (!transcriptChannel) {
                return interaction.reply({
                    content: 'Transcript channel not found. Please contact an administrator.',
                    ephemeral: true
                });
            }

            // Search for transcript in transcript channel
            try {
                await interaction.deferReply({ ephemeral: true });
                const messages = await transcriptChannel.messages.fetch({ limit: 100 });
                const transcriptMessage = messages.find(m => 
                    m.attachments.size > 0 && 
                    m.content.includes(`Transcript for ticket #${requestedId}`)
                );

                if (transcriptMessage) {
                    const transcript = transcriptMessage.attachments.first();
                    return interaction.editReply({
                        content: `Here is the transcript for ticket #${requestedId}:`,
                        files: [transcript]
                    });
                } else {
                    return interaction.editReply({
                        content: 'Transcript not found. It may have been deleted or expired.',
                    });
                }
            } catch (error) {
                console.error('Error fetching archived transcript:', error);
                return interaction.editReply({
                    content: 'There was an error retrieving the transcript.',
                });
            }
        }

        // Handle current ticket transcript
        const ticket = client.tickets.get(channel.id);
        if (!ticket) {
            return interaction.reply({
                content: 'This command can only be used in ticket channels!',
                ephemeral: true
            });
        }

        // Check permission for current ticket
        const canViewTranscript = interaction.member.roles.cache
            .some(role => 
                client.config.staffRoles.includes(role.id) ||
                role.id === client.config.adminRole
            ) || interaction.user.id === ticket.userId;

        if (!canViewTranscript) {
            return interaction.reply({
                content: 'You do not have permission to view this ticket\'s transcript!',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const transcript = await createTranscript(channel, {
                limit: -1,
                fileName: `ticket-${ticket.id}.html`,
                poweredBy: false,
                headerText: `Ticket #${ticket.id} Transcript`,
            });

            // Log transcript generation
            const logChannel = await guild.channels.fetch(client.config.ticketSettings.logChannelId);
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        color: parseInt(client.config.embeds.color.replace('#', ''), 16),
                        title: 'Transcript Generated',
                        description: `Transcript generated for ticket #${ticket.id} by ${interaction.user}`,
                        timestamp: new Date()
                    }]
                });
            }

            return interaction.editReply({
                content: `Here is the transcript for ticket #${ticket.id}:`,
                files: [transcript]
            });
        } catch (error) {
            console.error('Error generating transcript:', error);
            return interaction.editReply({
                content: 'There was an error generating the transcript.',
            });
        }
    },
};