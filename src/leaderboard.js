// Module for generating staff leaderboard
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateLeaderboard(ticketData) {
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');

  // Apply Dracula theme
  ctx.fillStyle = '#282a36';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f8f8f2';
  ctx.font = '30px Arial';
  ctx.fillText('Staff Leaderboard', 50, 50);

  const stats = Object.entries(ticketData.staffStats).map(([staffId, stats]) => ({
    staffId,
    ...stats,
  }));

  stats.sort((a, b) => b.closed - a.closed);

  ctx.font = '20px Arial';
  stats.forEach((stat, index) => {
    ctx.fillText(
      `${index + 1}. Staff ID: ${stat.staffId} - Closed: ${stat.closed} - Reopened: ${stat.reopened} - Solved: ${stat.solved} - Claimed: ${stat.claimed}`,
      50,
      100 + index * 30
    );
  });

  const outputPath = path.join(__dirname, 'leaderboard.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}

module.exports = {
  generateLeaderboard,
};
