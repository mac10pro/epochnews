require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const http = require('http');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const FOLLOWED_CHANNEL_ID = process.env.FOLLOWED_CHANNEL_ID;
const MARKDOWN_FILE = 'logs.md';

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running');
}).listen(process.env.PORT || 3000, () => {
  console.log(`HTTP server listening on port ${process.env.PORT || 3000}`);
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', (msg) => {
  if (msg.channel.id !== FOLLOWED_CHANNEL_ID) return;
  if (msg.author.bot) return; // ignore bot messages if you want

  const logLine = `- [${new Date().toISOString()}] ${msg.author.username}: ${msg.content}\n`;

  fs.appendFileSync(MARKDOWN_FILE, logLine);

  console.log(`Logged message: ${msg.content}`);
});

client.login(process.env.DISCORD_TOKEN);
