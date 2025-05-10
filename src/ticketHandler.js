// Module for handling ticket creation, closing, and tracking
const fs = require('fs');

let ticketData = {
  tickets: [],
  staffStats: {},
};

// Load ticket data from a file
function loadTicketData() {
  if (fs.existsSync('ticketData.json')) {
    ticketData = JSON.parse(fs.readFileSync('ticketData.json'));
  }
}

// Save ticket data to a file
function saveTicketData() {
  fs.writeFileSync('ticketData.json', JSON.stringify(ticketData, null, 2));
}

// Create a new ticket
function createTicket(userId, category) {
  const userTickets = ticketData.tickets.filter(ticket => ticket.userId === userId);
  if (userTickets.length >= 2) {
    return { success: false, message: 'You have reached the ticket limit (2).' };
  }

  const newTicket = {
    id: ticketData.tickets.length + 1,
    userId,
    category,
    status: 'open',
    createdAt: new Date(),
  };
  ticketData.tickets.push(newTicket);
  saveTicketData();
  return { success: true, ticket: newTicket };
}

// Close a ticket
function closeTicket(ticketId, staffId) {
  const ticket = ticketData.tickets.find(t => t.id === ticketId);
  if (!ticket || ticket.status !== 'open') {
    return { success: false, message: 'Ticket not found or already closed.' };
  }

  ticket.status = 'closed';
  ticket.closedAt = new Date();
  ticket.closedBy = staffId;

  if (!ticketData.staffStats[staffId]) {
    ticketData.staffStats[staffId] = { closed: 0, reopened: 0, solved: 0, claimed: 0 };
  }
  ticketData.staffStats[staffId].closed++;
  saveTicketData();
  return { success: true, ticket };
}

module.exports = {
  loadTicketData,
  saveTicketData,
  createTicket,
  closeTicket,
};
