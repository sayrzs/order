const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');
const { differenceInHours, differenceInMinutes } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View ticket statistics')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to view stats for (defaults to you)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { client } = interaction;

        // Get user's tickets
        const userTickets = Array.from(client.tickets.values())
            .filter(ticket => ticket.userId === targetUser.id);

        const stats = {
            total: userTickets.length,
            open: userTickets.filter(t => !t.closed).length,
            closed: userTickets.filter(t => t.closed).length,
            averageTime: 0,
        };

        // Calculate average resolution time
        const closedTickets = userTickets.filter(t => t.closed && t.closedAt);
        if (closedTickets.length > 0) {
            const totalMinutes = closedTickets.reduce((acc, ticket) => {
                return acc + differenceInMinutes(new Date(ticket.closedAt), new Date(ticket.createdAt));
            }, 0);
            stats.averageTime = Math.round(totalMinutes / closedTickets.length);
        }

        // Create canvas
        const canvas = Canvas.createCanvas(800, 400);
        const ctx = canvas.getContext('2d');

        // Set background
        ctx.fillStyle = '#2f3136';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw header
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`${targetUser.username}'s Ticket Statistics`, canvas.width / 2, 60);

        // Draw stats boxes
        const boxes = [
            { label: 'Total Tickets', value: stats.total },
            { label: 'Open Tickets', value: stats.open },
            { label: 'Closed Tickets', value: stats.closed },
            { label: 'Avg. Resolution Time', value: \`\${Math.floor(stats.averageTime / 60)}h \${stats.averageTime % 60}m\` }
        ];

        const boxWidth = 350;
        const boxHeight = 100;
        const padding = 20;
        let currentY = 100;

        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            const x = (i % 2 === 0) ? padding : canvas.width - boxWidth - padding;
            const y = currentY + (Math.floor(i / 2) * (boxHeight + padding));

            // Draw box background
            ctx.fillStyle = '#36393f';
            ctx.roundRect(x, y, boxWidth, boxHeight, 10);
            ctx.fill();

            // Draw label
            ctx.font = '24px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(box.label, x + 20, y + 35);

            // Draw value
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText(box.value, x + 20, y + 80);
        }

        // Create attachment
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'ticket-stats.png' });

        return interaction.reply({
            files: [attachment]
        });
    },
};