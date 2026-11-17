import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Options, Partials, Events, ActivityType, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { config } from './config/config.js';
import { initDb } from './database/db.js';
import { startDashboard } from './dashboard/server.js';
import { resumeAllServersMonitors } from './services/monitor/allServersMonitorService.js';
import { startPlaytimePolling, startPlaytimeReportScheduler } from './services/fivem/playtimeService.js';
import { createGuildEventEmbed } from './utils/embed.js';
import { buildSlashCommandsData } from './utils/slashBuilder.js';
import { createMessageShim, buildArgsFromInteraction } from './utils/interactionAdapter.js';
import { requireSubscription } from './utils/subscription.js';
import { startPaymentPoller, ensurePremiumSchema } from './services/payment/premiumPayment.js';
import { isPaymentConfigured } from './services/payment/pakasir.js';
import { startPremiumBackup } from './services/backup/premiumBackup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Init DB ───────────────────────────────────────────────────────────────
initDb();
ensurePremiumSchema(); // satu skema premium untuk bot + website (+ migrasi data web lama)
console.log('[DB] SQLite initialized');
startPremiumBackup();

// ─── Discord Client ─────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  // ── LITE: batasi cache bawaan discord.js supaya RAM stabil di RDP 2GB ──
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 20,          // default 200 pesan/channel
    ReactionManager: 0,
    PresenceManager: 0,
    ThreadManager: 0,
    GuildScheduledEventManager: 0,
    StageInstanceManager: 0,
    VoiceStateManager: 0,
    GuildMemberManager: { maxSize: 50, keepOverLimit: (m) => m.id === m.client.user.id },
    UserManager: { maxSize: 100, keepOverLimit: (u) => u.id === u.client.user.id },
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 300, lifetime: 600 },   // tiap 5 menit buang pesan > 10 menit
    users: { interval: 600, filter: () => (u) => u.id !== u.client.user.id },
    guildMembers: { interval: 600, filter: () => (m) => m.id !== m.client.user.id },
  },
});

client.commands = new Collection();
client.buttons = new Collection();
client.cooldowns = new Collection();

// ─── Load Commands ──────────────────────────────────────────────────────────
async function loadCommands() {
  const categoriesDir = path.join(__dirname, 'commands');
  const categories = readdirSync(categoriesDir);

  for (const category of categories) {
    const files = readdirSync(path.join(categoriesDir, category)).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const mod = await import(`./commands/${category}/${file}`);
      const command = mod.default;
      if (!command || !command.name) continue;
      client.commands.set(command.name, command);
      if (command.aliases) {
        command.aliases.forEach(alias => client.commands.set(alias, command));
      }
    }
  }
  console.log(`[Commands] Loaded ${client.commands.size} commands/aliases`);
}

// ─── Load Buttons ───────────────────────────────────────────────────────────
async function loadButtons() {
  const buttonsDir = path.join(__dirname, 'buttons');
  const files = readdirSync(buttonsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const mod = await import(`./buttons/${file}`);
    const button = mod.default;
    if (!button || !button.customId) continue;
    client.buttons.set(button.customId, button);
  }
  console.log(`[Buttons] Loaded ${client.buttons.size} button handlers`);
}

// ─── Message Handler ─────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  // Abaikan pesan dari bot
  if (message.author.bot) return;

  // ─── Bot Mention / Tag Handler ────────────────────────────────────────────
  const mentionRegex = new RegExp(
    `^<@!?${client.user.id}>\\s*$`
  );

  // Hanya aktif jika isi pesan hanya tag bot
  if (mentionRegex.test(message.content.trim())) {

    // ================================
    // EDIT LINK DI BAWAH INI
    // ================================
    const BOT_INVITE =
      'https://discord.com/oauth2/authorize?client_id=992716787483418697&permissions=8&scope=bot%20applications.commands';

    const WEBSITE =
      'https://stronaut.staticdomains.app/stronaut-invite';

    const DONATION =
      'https://cdn.discordapp.com/attachments/1515942664820887633/1522136221873082478/IMG-20260702-WA0013.jpg?ex=6a84ad13&is=6a835b93&hm=11ea7233ed7111a5e552a4f33087ff1c412d73966730368176a1e2e1cfa77cf3&';

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({
        name: client.user.username,
        iconURL: client.user.displayAvatarURL()
      })
      .setTitle('👋 Halo, ada yang bisa saya bantu?')
      .setDescription(
        [
          `Hai ${message.author}! Terima kasih sudah menggunakan **${config.bot.name}**.`,
          '',
          'Klik tombol di bawah untuk:',
          '🤖 **Invite Bot ke server kamu**',
          '🌐 **Mengunjungi Website**',
          '❤️ **Memberikan Donasi**'
        ].join('\n')
      )
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({
        text: `${config.bot.name} • Terima kasih atas dukungan kamu ❤️`
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Invite Bot')
        .setEmoji('🤖')
        .setStyle(ButtonStyle.Link)
        .setURL(BOT_INVITE),

      new ButtonBuilder()
        .setLabel('Website')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(WEBSITE),

      new ButtonBuilder()
        .setLabel('Donasi')
        .setEmoji('❤️')
        .setStyle(ButtonStyle.Link)
        .setURL(DONATION)
    );

    return message.reply({
      embeds: [embed],
      components: [row],
      allowedMentions: {
        repliedUser: false
      }
    });
  }

  // ─── Prefix Command Handler ───────────────────────────────────────────────

  if (!message.content.startsWith(config.bot.prefix)) return;

  const args = message.content
    .slice(config.bot.prefix.length)
    .trim()
    .split(/\s+/);

  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);

  if (!command) return;

  // Gate premium: command dengan `premium: true` hanya untuk server berlangganan.
  if (command.premium) {
    const check = requireSubscription(message);
    if (!check.allowed) return message.reply({ embeds: [check.embed] });
  }

  // Cooldown check
  const { cooldowns } = client;

  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 3) * 1000;
  const userId = message.author.id;

  if (timestamps.has(userId)) {
    const expiry = timestamps.get(userId) + cooldownAmount;

    if (now < expiry) {
      const remaining = ((expiry - now) / 1000).toFixed(1);

      return message.reply({
        content:
          `⏳ Tunggu **${remaining}s** sebelum pakai ` +
          `\`${config.bot.prefix}${command.name}\` lagi.`
      });
    }
  }

  timestamps.set(userId, now);

  setTimeout(() => {
    timestamps.delete(userId);
  }, cooldownAmount);

  try {
    await command.execute(message, args, client);
  } catch (err) {
    console.error(`[Command Error] ${command.name}:`, err);

    try {
      await message.reply({
        content: `❌ Terjadi error: \`${err.message}\``
      });
    } catch {}
  }
});

// ─── Button Interaction Handler ──────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  // Match button by prefix (e.g. "refresh|player|..." → "refresh")
  const [prefix] = customId.split('|');
  const [altPrefix] = customId.split(':');

  const handler = client.buttons.get(prefix) || client.buttons.get(altPrefix);
  if (!handler) return;

  // Gate premium untuk tombol (mis. pagination !allplayer di pesan lama).
  if (handler.premium) {
    const check = requireSubscription({ guild: interaction.guild, author: interaction.user });
    if (!check.allowed) {
      return interaction.reply({ embeds: [check.embed], ephemeral: true }).catch(() => {});
    }
  }

  try {
    await handler.execute(interaction);
  } catch (err) {
    console.error(`[Button Error] ${customId}:`, err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ Error: \`${err.message}\``, components: [] });
      } else {
        await interaction.reply({ content: `❌ Error: \`${err.message}\``, ephemeral: true });
      }
    } catch {}
  }
});

// ─── Slash Command Handler ───────────────────────────────────────────────────
// Semua command lama (execute(message, args, client)) dipakai ulang lewat
// shim di utils/interactionAdapter.js, jadi tidak perlu ditulis dua kali.
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: '❌ Command tidak ditemukan.', ephemeral: true }).catch(() => {});
  }

  // Cooldown check (sama seperti prefix command)
  const { cooldowns } = client;
  if (!cooldowns.has(command.name)) cooldowns.set(command.name, new Collection());
  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 3) * 1000;
  const userId = interaction.user.id;

  if (timestamps.has(userId)) {
    const expiry = timestamps.get(userId) + cooldownAmount;
    if (now < expiry) {
      const remaining = ((expiry - now) / 1000).toFixed(1);
      return interaction.reply({ content: `⏳ Tunggu **${remaining}s** sebelum pakai \`/${command.name}\` lagi.`, ephemeral: true }).catch(() => {});
    }
  }
  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownAmount);

  // Defer dulu supaya aman dari timeout 3 detik Discord untuk command
  // yang butuh fetch ke API luar (FiveM, Steam, dsb).
  try {
    await interaction.deferReply();
  } catch (err) {
    console.error(`[Slash Defer Error] ${command.name}:`, err.message);
    return;
  }

  const args = buildArgsFromInteraction(interaction, command.slashOptions || []);
  const messageShim = createMessageShim(interaction);

  // Gate premium (slash): sama seperti prefix command.
  if (command.premium) {
    const check = requireSubscription(messageShim);
    if (!check.allowed) {
      return interaction.editReply({ embeds: [check.embed] }).catch(() => {});
    }
  }

  try {
    await command.execute(messageShim, args, client);
  } catch (err) {
    console.error(`[Slash Command Error] ${command.name}:`, err);
    try {
      await interaction.editReply({ content: `❌ Terjadi error: \`${err.message}\`` });
    } catch {}
  }
});

// ─── Guild Join / Leave Notifications ────────────────────────────────────────
async function notifyGuildEvent(guild, type) {
  const embed = createGuildEventEmbed(guild, type, client.guilds.cache.size);
  const logChannelId = config.logging.guildLogChannelId;

  if (logChannelId) {
    try {
      const channel = await client.channels.fetch(logChannelId);
      if (channel?.isTextBased?.()) {
        await channel.send({ embeds: [embed] });
        return;
      }
    } catch (err) {
      console.error('[Guild Log] Gagal kirim ke log channel:', err.message);
    }
  }

  // Fallback: DM owner kalau log channel tidak diset / gagal
  if (config.discord.ownerId) {
    try {
      const owner = await client.users.fetch(config.discord.ownerId);
      await owner.send({ embeds: [embed] });
    } catch (err) {
      console.error('[Guild Log] Gagal DM owner:', err.message);
    }
  }
}

client.on(Events.GuildCreate, (guild) => {
  console.log(`[Guild] Bergabung ke server baru: ${guild.name} (${guild.id})`);
  notifyGuildEvent(guild, 'join');
});

client.on(Events.GuildDelete, (guild) => {
  console.log(`[Guild] Keluar/dikick dari server: ${guild.name} (${guild.id})`);
  notifyGuildEvent(guild, 'leave');
});

// ─── Rotating Activity/Status ────────────────────────────────────────────────
function startActivityRotation() {
  const activities = () => [
    { name: `${config.bot.prefix}help | FiveM Tools`, type: ActivityType.Playing },
    { name: `${client.guilds.cache.size} server Discord`, type: ActivityType.Watching },
    { name: `${client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0).toLocaleString()} users`, type: ActivityType.Watching },
    { name: `player online 24/7`, type: ActivityType.Listening },
    { name: `v${config.bot.version} • ${config.bot.name}`, type: ActivityType.Competing },
  ];

  let i = 0;
  const rotate = () => {
    const list = activities();
    const activity = list[i % list.length];
    client.user.setActivity(activity.name, { type: activity.type });
    i++;
  };

  rotate();
  setInterval(rotate, config.bot.activityRotateInterval);
}

// ─── Slash Command Registration ──────────────────────────────────────────────
async function registerSlashCommands() {
  if (!config.bot.clientId) {
    console.warn('[Slash] CLIENT_ID belum diisi di .env — slash command dilewati.');
    return;
  }

  try {
    const body = buildSlashCommandsData(client.commands);
    const rest = new REST({ version: '10' }).setToken(config.bot.token);

    const route = config.discord.guildId
      ? Routes.applicationGuildCommands(config.bot.clientId, config.discord.guildId)
      : Routes.applicationCommands(config.bot.clientId);

    const result = await rest.put(route, { body });
    console.log(`[Slash] ${result.length} slash command terdaftar${config.discord.guildId ? ` di guild ${config.discord.guildId} (instan)` : ' secara global (bisa sampai ~1 jam tersebar)'}.`);
  } catch (err) {
    console.error('[Slash] Gagal mendaftarkan slash command:', err.message);
  }
}

// ─── Ready ───────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  ${config.bot.name} v${config.bot.version} — Online!         ║`);
  console.log(`║  Logged in as: ${client.user.tag.padEnd(20)} ║`);
  console.log(`║  Prefix: ${config.bot.prefix.padEnd(27)} ║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  startActivityRotation();
  resumeAllServersMonitors(client);
  startPlaytimePolling();
  startPlaytimeReportScheduler(client);
  registerSlashCommands();
  if (isPaymentConfigured()) startPaymentPoller(client);
  else console.warn('[Payment] PAKASIR_SLUG / PAKASIR_API_KEY belum diisi di .env — !bayar pakai mode manual & pembelian di website nonaktif.');
});

// ─── Boot ────────────────────────────────────────────────────────────────────
async function main() {
  if (!config.bot.token) {
    console.error('[ERROR] DISCORD_TOKEN tidak ditemukan di .env!');
    process.exit(1);
  }

  await loadCommands();
  await loadButtons();

  // Start dashboard
  startDashboard(client);

  await client.login(config.bot.token);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
