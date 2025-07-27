require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const simpleGit = require('simple-git');
const http = require('http');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const FOLLOWED_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const git = simpleGit();

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running');
}).listen(process.env.PORT || 3000, () => {
  console.log('HTTP server listening on port', process.env.PORT || 3000);
});

async function setupGitConfig() {
  await git.addConfig('user.name', process.env.GITHUB_USERNAME || 'github-actions');
  await git.addConfig('user.email', process.env.GITHUB_EMAIL || 'github-actions@example.com');

  const remoteUrl = `https://${process.env.GITHUB_USERNAME}:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_USERNAME}/${process.env.GITHUB_REPO}.git`;
  console.log('Using remote URL:', remoteUrl);

  try {
    await git.removeRemote('origin');
  } catch {
    console.log('No existing remote to remove.');
  }

  await git.addRemote('origin', remoteUrl);
  console.log('Git remote configured.');
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await setupGitConfig();
});

client.on('messageCreate', async (msg) => {
  console.log(`Received message from ${msg.author.username} in channel ${msg.channel.id}`);

  if (msg.channel.id !== FOLLOWED_CHANNEL_ID) {
    console.log(`Ignored message in channel ${msg.channel.id}`);
    return;
  }
  if (msg.author.bot) {
    console.log(`Ignored bot message from ${msg.author.username}`);
    return;
  }

  const timestamp = new Date().toISOString();
  const safeTimestamp = timestamp.replace(/:/g, '-');
  const dir = 'logs';
  const fileName = `${dir}/${safeTimestamp}.md`;

  const content = `### ${timestamp}\n\n- **${msg.author.username}**: ${msg.content}\n`;

  try {
    // Ensure logs directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
      console.log(`Created directory: ${dir}`);
    }

    // Pull latest changes before adding new file (rebase)
    await git.pull('origin', 'main', { '--rebase': 'true' });

    // Write new message log file
    fs.writeFileSync(fileName, content);
    console.log(`Created new log file: ${fileName}`);

    // Add, commit, and push new file
    await git.add([fileName]);
    await git.commit(`Add log from ${msg.author.username} at ${timestamp}`);
    await git.push('origin', 'main');

    if (msg.content.length <= 100) {
      console.log(`New post: ${msg.content}`);
    } else {
      console.log(`New post from ${msg.author.username} (too long to display) — see latest entry in logs/ folder on GitHub`);
    }
  } catch (err) {
    console.error('Failed to create or push log file:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);
