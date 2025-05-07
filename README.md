# Discord Ticket Bot

A feature-rich ticket management system for Discord servers with support for multiple categories, staff performance tracking, visual statistics, and extensive customization options.

## Features

### Core Commands
- `/send-panel` - Create customizable ticket panels with buttons or select menus
- `/close` - Close tickets with optional reason and transcript generation
- `/reopen` - Reopen previously closed tickets
- `/add` & `/remove` - Manage users in tickets
- `/rename` - Rename ticket channels
- `/tag` - Ping roles/users in tickets
- `/transcript` - Generate HTML transcripts with automatic cleanup after 12 hours
- `/stats` - View comprehensive ticket statistics
  - Individual staff performance metrics with visual graphs
  - Overall staff performance comparison
  - System-wide statistics with category breakdowns

### Admin Commands
- `/setup` - Configure categories, roles, channels, and other settings
- `/ticket-config` - View and verify current configuration
- `/reset-panel` - Remove or update existing ticket panels

### Smart Features
- Auto-increment ticket names (ticket-001, ticket-002, etc.)
- Comprehensive logging system for all ticket actions
- Configurable cooldowns & maximum tickets per user
- Auto-delete closed tickets after configurable duration
- HTML transcripts with formatting and automatic cleanup
- Support for multiple ticket categories with custom settings
- Role-based permissions system
- Staff ticket claiming system with performance tracking
- Visual statistics and performance metrics

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
   node deploy-commands.js
   ```

4. **Start the Bot**
   ```bash
   node index.js
   ```

## Usage

1. Use `/setup` to configure the ticket system for your server
2. Use `/send-panel` to create ticket panels in your chosen channels
3. Configure additional settings as needed using admin commands
4. Staff can use ticket management commands in created tickets
5. Monitor performance using `/stats` command

## Requirements

- Node.js 16.9.0 or higher
- Discord.js v14
- Canvas (for statistics graphs)
- A Discord bot token with the following intents:
  - GUILDS
  - GUILD_MESSAGES
  - MESSAGE_CONTENT
  - GUILD_MEMBERS

## Features by Role

### Admin
- Full access to all commands
- Configure bot settings
- Manage ticket panels
- View all statistics
- Override any restrictions

### Staff
- Create and manage tickets
- View assigned ticket statistics
- Generate transcripts
- Add/remove users
- Close/reopen tickets

### Users
- Create tickets through panels
- View their ticket history
- Add messages to their tickets
- Close their own tickets (if enabled)

## Support

For support, feature requests, or bug reports, please create an issue in the repository or contact the maintainers.