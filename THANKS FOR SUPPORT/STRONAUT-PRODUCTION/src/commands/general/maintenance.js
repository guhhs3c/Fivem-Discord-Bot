import { EmbedBuilder, ChannelType, PermissionsBitField } from 'discord.js';
import { createErrorEmbed, createSuccessEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

// =======================================================
// Command: !maintenance
// Kirim 1x pengumuman bebas ("FYI - STRONAUT GANK") ke SEMUA server
// yang dimasuki bot — 1 channel bebas per server, dengan jeda
// antar-server supaya tidak kena rate limit / dianggap spam.
// (Owner only)
// =======================================================

const DELAY_MS = 1500; // jeda antar server, aman dari rate limit Discord

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cari 1 channel yang "layak" dipakai buat pengumuman di sebuah guild.
// Prioritas: systemChannel -> channel bernama info/umum/general/announcement ->
// text channel pertama yang bot boleh kirim pesan di situ.
function pickAnnouncementChannel(guild) {
  const me = guild.members.me;
  if (!me) return null;

  const canSend = (channel) => {
    if (!channel || channel.type !== ChannelType.GuildText) return false;
    const perms = channel.permissionsFor(me);
    return (
      perms?.has(PermissionsBitField.Flags.ViewChannel) &&
      perms?.has(PermissionsBitField.Flags.SendMessages) &&
      perms?.has(PermissionsBitField.Flags.EmbedLinks)
    );
  };

  if (canSend(guild.systemChannel)) return guild.systemChannel;

  const preferredNames = /(info|umum|general|announcement|pengumuman|maintenance|perbaikan)/i;
  const textChannels = [...guild.channels.cache.values()].filter(
    (c) => c.type === ChannelType.GuildText
  );

  const preferred = textChannels
    .filter((c) => preferredNames.test(c.name) && canSend(c))
    .sort((a, b) => a.rawPosition - b.rawPosition)[0];
  if (preferred) return preferred;

  const fallback = textChannels
    .filter((c) => canSend(c))
    .sort((a, b) => a.rawPosition - b.rawPosition)[0];

  return fallback || null;
}

// Sekarang isi pesannya bebas — apa yang diketik owner setelah command,
// itu yang dikirim apa adanya (bukan lagi template maintenance tetap).
function buildAnnouncementEmbed(customMessage) {
  return new EmbedBuilder()
    .setColor(config.colors.warning)
    .setAuthor({ name: `📢 ${config.bot.name} — Pemberitahuan` })
    .setTitle('FYI - STRONAUT GANK')
    .setDescription(`${SEPARATOR}\n\n${customMessage}\n\n${SEPARATOR}`)
    .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
    .setTimestamp();
}

export default {
  name: 'maintenance',
  aliases: ['broadcastmaintenance', 'infoperbaikan', 'fyi'],
  description: 'Kirim pesan bebas ("FYI - STRONAUT GANK") ke 1 channel di tiap server (Owner only)',
  usage: `${config.bot.prefix}maintenance <pesan>`,
  example: `${config.bot.prefix}maintenance Malam ini ada event jam 21.00 WIB, jangan sampai ketinggalan!`,
  cooldown: 30,

  async execute(message, args, client) {
    if (message.author.id !== config.discord.ownerId) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Command ini hanya untuk Owner bot.')],
      });
    }

    const customMessage = args.join(' ').trim();

    if (!customMessage) {
      return message.reply({
        embeds: [createErrorEmbed('Pesan Kosong', `Isi pesan yang mau dikirim.\nContoh: \`${config.bot.prefix}maintenance Malam ini ada event jam 21.00 WIB\``)],
      });
    }

    const guilds = [...client.guilds.cache.values()];

    if (!guilds.length) {
      return message.reply({
        embeds: [createErrorEmbed('Gagal', 'Bot belum masuk ke server manapun.')],
      });
    }

    const embed = buildAnnouncementEmbed(customMessage);

    const status = await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(config.colors.info)
          .setDescription(`⏳ Mengirim pesan ke **${guilds.length}** server (1 channel/server, dengan jeda)...`),
      ],
    });

    const success = [];
    const failed = [];

    for (const guild of guilds) {
      const channel = pickAnnouncementChannel(guild);

      if (!channel) {
        failed.push({ name: guild.name, reason: 'Tidak ada channel yang bisa dikirimi pesan' });
      } else {
        try {
          await channel.send({ embeds: [embed] });
          success.push({ name: guild.name, channel: channel.name });
        } catch (err) {
          failed.push({ name: guild.name, reason: err.message });
        }
      }

      // Jeda antar server — mencegah rate limit & kesan spam.
      await sleep(DELAY_MS);
    }

    const summaryLines = [
      `✅ **Berhasil:** \`${success.length}/${guilds.length}\` server`,
      failed.length ? `❌ **Gagal:** \`${failed.length}\` server` : null,
      failed.length
        ? `\n**Detail gagal:**\n${failed
            .slice(0, 10)
            .map((f) => `> ${f.name} — ${f.reason}`)
            .join('\n')}${failed.length > 10 ? `\n> ...dan ${failed.length - 10} lainnya` : ''}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    const resultEmbed = createSuccessEmbed('Broadcast Selesai', summaryLines);
    await status.edit({ embeds: [resultEmbed] });
  },
};