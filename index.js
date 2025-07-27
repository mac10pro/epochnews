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

    // Pull latest from remote
    await git.pull('origin', 'main', { '--rebase': 'true' });

    // Write new log file
    fs.writeFileSync(fileName, content);
    console.log(`Created log file: ${fileName}`);

    // Stage, commit, and push
    await git.add(['-f', fileName]);
    console.log(`Added file ${fileName} to git staging area`);

    const commitSummary = await git.commit(`Log update from ${msg.author.username} at ${timestamp}`);
    console.log('Commit summary:', commitSummary);

    const pushSummary = await git.push('origin', 'main');
    console.log('Push summary:', pushSummary);

    console.log('✅ Log file committed and pushed to GitHub');
  } catch (err) {
    console.error('Failed to update or push logs:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);
