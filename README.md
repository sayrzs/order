# Discord Ticket Bot ( SOME ISSUE I'll FIX IT NOW )

A feature-rich ticket management system for Discord servers with support for multiple categories, transcripts, and extensive customization.

## Features

### Core Commands
- `/send-panel` - Create customizable ticket panels (buttons or select menus)
- `/close` - Close tickets with optional reason
- `/reopen` - Reopen closed tickets
- `/add` & `/remove` - Manage users in tickets
- `/rename` - Rename ticket channels
- `/tag` - Ping roles/users in tickets
- `/transcript` - Generate HTML transcripts (auto-delete after 12h)
- `/stats` - View ticket statistics with visual display

### Admin Commands
- `/setup` - Configure categories, roles, channels, etc.
- `/ticket-config` - View current configuration
- `/reset-panel` - Remove or update ticket panels

### Smart Features
- Auto-increment ticket names (ticket-001, ticket-002, etc.)
- Comprehensive logging system
- Configurable cooldowns & max tickets per user
- Auto-delete closed tickets
- HTML transcripts with automatic cleanup
- Support for multiple ticket categories
- Role-based permissions system
- Ticket claiming system for staff

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure the Bot**
   - Create a `config.json` file with your settings:
   ```json
   {
       "clientId": "YOUR_BOT_CLIENT_ID",
       "token": "YOUR_BOT_TOKEN",
       "adminRole": "ADMIN_ROLE_ID",
       "staffRoles": ["STAFF_ROLE_ID"],
       "ticketSettings": {
           "categoryId": "TICKETS_CATEGORY_ID",
           "logChannelId": "LOG_CHANNEL_ID",
           "transcriptChannelId": "TRANSCRIPT_CHANNEL_ID",
           "maxTicketsPerUser": 3,
           "ticketCooldown": 300,
           "autoCloseHours": 24,
           "transcriptExpiryHours": 12
       },
       "panels": [
           {
               "name": "Support",
               "emoji": "🎫",
               "description": "Create a support ticket",
               "color": "#5865F2"
           },
           {
               "name": "Store",
               "emoji": "🛍️",
               "description": "Create a store-related ticket",
               "color": "#57F287"
           }
       ],
       "embeds": {
           "color": "#5865F2",
           "footerText": "Support Tickets",
           "timestamp": true,
           "thumbnailUrl": ""
       }
   }
   ```

3. **Deploy Commands**
   ```bash
   npm run deploy
   ```

4. **Start the Bot**
   ```bash
   npm start
   ```

## Usage

1. Use `/setup` to configure the ticket system for your server
2. Use `/send-panel` to create ticket panels in your chosen channels
3. Configure additional settings as needed using admin commands
4. Staff can use ticket management commands in created tickets

## Requirements

- Node.js 16.9.0 or higher
- Discord.js v14
- A Discord bot token with appropriate intents:
  - GUILDS
  - GUILD_MESSAGES
  - MESSAGE_CONTENT
  - GUILD_MEMBERS

## Support

For support, please create an issue in the repository or contact the maintainers.
