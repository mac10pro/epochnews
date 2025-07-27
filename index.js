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

  // Explicitly checkout main branch to avoid detached HEAD
  try {
    await git.checkout('main');
    console.log('Checked out branch main');
  } catch (err) {
    console.log('Branch main not found, creating it...');
    await git.checkoutLocalBranch('main');
  }

  // Pull latest main with rebase
  await git.pull('origin', 'main', { '--rebase': 'true' });
  console.log('Pulled latest changes from origin/main');
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await setupGitConfig();
});

client.on('messageCreate', async (msg) => {
  try {
    if (msg.channel.id !== FOLLOWED_CHANNEL_ID) return;
    if (msg.author.bot) return;

    console.log(`Received message from ${msg.author.username} in channel ${msg.channel.id}`);

    const timestamp = new Date().toISOString();
    const safeTimestamp = timestamp.replace(/:/g, '-');
    const dir = 'logs';
    const fileName = `${dir}/${safeTimestamp}.md`;
    const content = `### ${timestamp}\n\n- **${msg.author.username}**: ${msg.content}\n`;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
      console.log(`Created directory: ${dir}`);
    }

    // Pull latest changes before writing to avoid conflicts
    await git.pull('origin', 'main', { '--rebase': 'true' });

    fs.writeFileSync(fileName, content);
    console.log(`Created log file: ${fileName}`);

    await git.add(['-f', fileName]);
    console.log(`Added file ${fileName} to git staging area`);

    await git.commit(`Log update from ${msg.author.username} at ${timestamp}`);
    console.log('Committed log file');

    await git.push('origin', 'main');
    console.log('Pushed log file to GitHub');

    if (msg.content.length <= 100) {
      console.log(`New post: ${msg.content}`);
    } else {
      console.log(`New post from ${msg.author.username} (too long to display) — see latest log file on GitHub`);
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);
