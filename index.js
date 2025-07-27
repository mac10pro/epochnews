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

const MARKDOWN_FILE = 'logs.md';
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
  const newEntry = `\n--------------\n\n### ${timestamp}\n\n- **${msg.author.username}**: ${msg.content}\n`;

  let oldContent = '';
  try {
    oldContent = fs.readFileSync(MARKDOWN_FILE, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error reading logs.md:', err);
      return;
    }
  }

  const updatedContent = newEntry + oldContent;

  try {
    fs.writeFileSync(MARKDOWN_FILE, updatedContent);
    console.log('File content now:', updatedContent.substring(0, 200));

    await git.add(MARKDOWN_FILE);
    await git.commit(`Log update from ${msg.author.username} at ${timestamp}`);

    await git.pull('origin', 'main', {'--rebase': 'true'});

    await git.push('origin', 'main');

    if (msg.content.length <= 100) {
      console.log(`New post: ${msg.content}`);
    } else {
      console.log(`New post from ${msg.author.username} (too long to display) — see latest entry in logs.md on GitHub`);
    }
  } catch (err) {
    console.error('Failed to update or push logs:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);
