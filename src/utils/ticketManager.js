const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createTranscript } = require('discord-html-transcripts');
const { addHours } = require('date-fns');

class TicketManager {
    static async createTicket(interaction, panelConfig) {
        const { client, guild, user } = interaction;
        const { ticketSettings } = client.config;

        // Check if user has reached max tickets
        const userTickets = Array.from(client.tickets.values())
            .filter(ticket => ticket.userId === user.id && !ticket.closed);
        
        if (userTickets.length >= ticketSettings.maxTicketsPerUser) {
            return interaction.reply({
                content: `You already have ${userTickets.length} open tickets. Please close some before creating new ones.`,
                ephemeral: true
            });
        }

        // Check cooldown
        const lastTicket = userTickets.sort((a, b) => b.createdAt - a.createdAt)[0];
        if (lastTicket) {
            const cooldownTime = (lastTicket.createdAt.getTime() + (ticketSettings.ticketCooldown * 1000)) - Date.now();
            if (cooldownTime > 0) {
                const minutes = Math.ceil(cooldownTime / 60000);
                return interaction.reply({
                    content: `Please wait ${minutes} minute(s) before creating another ticket.`,
                    ephemeral: true
                });
            }
        }

        // Generate ticket number
        const ticketNumber = (client.tickets.size + 1).toString().padStart(3, '0');
        const channelName = `ticket-${ticketNumber}`;

        // Create channel
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: ticketSettings.categoryId,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
                ...client.config.staffRoles.map(roleId => ({
                    id: roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                })),
            ],
        });

        // Create ticket embed
        const embed = new EmbedBuilder()
            .setColor(panelConfig.color)
            .setTitle(`${panelConfig.name} Ticket`)
            .setDescription(`Welcome ${user}! Please describe your issue.\nStaff will be with you shortly.`)
            .setFooter({ text: `Ticket ID: ${ticketNumber}` })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Claim Ticket')
                    .setStyle(ButtonStyle.Primary)
            );

        await channel.send({ 
            content: `${user} | Staff will assist you shortly.`,
            embeds: [embed],
            components: [row]
        });
        
        // Store ticket data
        client.tickets.set(channel.id, {
            id: ticketNumber,
            channelId: channel.id,
            userId: user.id,
            type: panelConfig.name,
            createdAt: new Date(),
            closed: false,
        });

        // Emit update event
        client.emit('ticketUpdate');

        // Log ticket creation
        const logChannel = await guild.channels.fetch(ticketSettings.logChannelId);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(panelConfig.color)
                .setTitle('Ticket Created')
                .setDescription(`Ticket #${ticketNumber} created by ${user}`)
                .addFields(
                    { name: 'Type', value: panelConfig.name, inline: true },
                    { name: 'Channel', value: `<#${channel.id}>`, inline: true }
                )
                .setTimestamp();
            
            await logChannel.send({ embeds: [logEmbed] });
        }

        return interaction.reply({
            content: `Your ticket has been created: <#${channel.id}>`,
            ephemeral: true
        });
    }

    static async closeTicket(interaction, reason = 'No reason provided') {
        const { channel, client, guild } = interaction;
        const ticket = client.tickets.get(channel.id);
        
        if (!ticket) {
            return interaction.reply({
                content: 'This command can only be used in ticket channels!',
                ephemeral: true
            });
        }

        if (ticket.closed) {
            return interaction.reply({
                content: 'This ticket is already closed!',
                ephemeral: true
            });
        }

        // Generate transcript
        const transcript = await createTranscript(channel, {
            limit: -1,
            fileName: `ticket-${ticket.id}.html`,
            poweredBy: false,
            headerText: `Ticket #${ticket.id} Transcript`,
        });

        // Send transcript
        const transcriptChannel = await guild.channels.fetch(client.config.ticketSettings.transcriptChannelId);
        if (transcriptChannel) {
            const message = await transcriptChannel.send({
                content: `Transcript for ticket #${ticket.id}`,
                files: [transcript],
            });

            // Schedule transcript deletion
            setTimeout(() => {
                if (message.deletable) {
                    message.delete().catch(console.error);
                }
            }, client.config.ticketSettings.transcriptExpiryHours * 3600000);
        }

        // Update ticket status
        ticket.closed = true;
        ticket.closedBy = interaction.user.id;
        ticket.closedAt = new Date();
        ticket.closeReason = reason;
        client.tickets.set(channel.id, ticket);

        // Emit update event
        client.emit('ticketUpdate');

        // Notify the ticket creator
        try {
            const ticketCreator = await client.users.fetch(ticket.userId);
            await ticketCreator.send({
                embeds: [{
                    color: parseInt(client.config.embeds.color.replace('#', ''), 16),
                    title: 'Ticket Closed',
                    description: `Your ticket (#${ticket.id}) has been closed.\nReason: ${reason}`,
                    fields: [
                        { name: 'Closed By', value: interaction.user.tag, inline: true },
                        { name: 'Type', value: ticket.type, inline: true }
                    ],
                    timestamp: new Date()
                }]
            });
        } catch (error) {
            console.error('Could not DM ticket creator:', error);
        }

        // Schedule channel deletion
        const deleteTime = addHours(new Date(), client.config.ticketSettings.autoCloseHours);
        setTimeout(() => {
            if (channel.deletable) {
                channel.delete(`Ticket auto-deleted after ${client.config.ticketSettings.autoCloseHours} hours`);
            }
        }, client.config.ticketSettings.autoCloseHours * 3600000);

        // Log ticket closure
        const logChannel = await guild.channels.fetch(client.config.ticketSettings.logChannelId);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('Ticket Closed')
                .setDescription(`Ticket #${ticket.id} closed by ${interaction.user}`)
                .addFields(
                    { name: 'Created By', value: `<@${ticket.userId}>`, inline: true },
                    { name: 'Type', value: ticket.type, inline: true },
                    { name: 'Duration', value: this.getTicketDuration(ticket.createdAt, new Date()), inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();
            
            await logChannel.send({ embeds: [logEmbed] });
        }

        // Update channel permissions
        await channel.permissionOverwrites.edit(ticket.userId, {
            ViewChannel: false
        });

        return interaction.editReply({
            content: `Ticket closed. Channel will be deleted in ${client.config.ticketSettings.autoCloseHours} hours.\nReason: ${reason}`,
            components: []
        });
    }

    static async updateTicket(client, channelId, updates) {
        const ticket = client.tickets.get(channelId);
        if (ticket) {
            const updatedTicket = { ...ticket, ...updates };
            client.tickets.set(channelId, updatedTicket);
            client.emit('ticketUpdate');
            return updatedTicket;
        }
        return null;
    }

    static getTicketDuration(start, end) {
        const diff = Math.abs(end - start);
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    }
}

module.exports = TicketManager;