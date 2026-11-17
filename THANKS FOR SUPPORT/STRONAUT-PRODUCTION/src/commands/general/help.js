import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { config } from '../../config/config.js';

const P = config.bot.prefix;

// Data kategori — tinggal edit di sini kalau mau nambah/kurangin command
const categories = {
  premium: {
    label: 'Fitur Premium',
    emoji: '💎',
    description:
      `Fitur di bawah ini **khusus server yang berlangganan Premium**. ` +
      `Premium berlaku untuk **seluruh member** di server.\n` +
      `Berlangganan: \`${P}bayar\` • Punya kode? \`${P}redeem <kode>\` • Cek status: \`${P}ceklangganan\`\n\n` +
      `**🎮 Player**\n` +
      `💎 \`${P}player\` — cari player berdasarkan nama\n` +
      `💎 \`${P}allplayer\` — daftar semua player online\n` +
      `💎 \`${P}loop\` — auto-cari pemain otomatis\n` +
      `💎 \`${P}playingtime\` • \`${P}settime\` — jam main & laporan playtime harian\n\n` +
      `**📡 Server**\n` +
      `💎 \`${P}cfxfinder\` — info server lengkap via cfx code\n` +
      `💎 \`${P}setmonitor\` — monitoring server andalan\n` +
      `💎 \`${P}settextstatusall\` — status player semua server di channel\n` +
      `💎 \`${P}ddoscheck\` • \`${P}ddoscheckall\` — deteksi indikasi DDoS/gangguan`,
  },
  player: {
    label: 'Player (Gratis)',
    emoji: '🎮',
    description: `\`${P}id\` — cari player by Server ID\n\`${P}stoploop\` • \`${P}stoptime\` — hentikan loop/laporan\n\n💎 Fitur premium: \`${P}player\` • \`${P}allplayer\` • \`${P}loop\` • \`${P}playingtime\` • \`${P}settime\``,
  },
  server: {
    label: 'Server (Gratis)',
    emoji: '📡',
    description: `\`${P}checkstatus\` • \`${P}serverstatus\` • \`${P}serverlist\`\n\`${P}requestserver\`\n\`${P}stopmonitor\` • \`${P}stoptextstatusall\`\n\n💎 Fitur premium: \`${P}cfxfinder\` • \`${P}setmonitor\` • \`${P}settextstatusall\` • \`${P}ddoscheck\` • \`${P}ddoscheckall\``,
  },
  tools: {
    label: 'FiveM & Gaming Tools',
    emoji: '🛠️',
    description: `\`${P}fivem-market\` • \`${P}fivem-help\` • \`${P}download\` • \`${P}tutorial\` • \`${P}kbbr\`\n\`${P}steam\` • \`${P}samp\` • \`${P}mc\` • \`${P}gameserver\` • \`${P}geoip\``,
  },
  lainnya: {
    label: 'Ask & Lainnya',
    emoji: '💬',
    description: `\`${P}ask <pertanyaan>\` — tanya apa aja soal bot ini\n\`${P}bayar\` • \`${P}support\` • \`${P}ping\``,
  },
};

function buildMainEmbed() {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`👋 Menu ${config.bot.name}`)
    .setDescription(
      `Halo! Pilih kategori di menu bawah ini untuk lihat command-nya.\n` +
      `Prefix bot ini adalah \`${P}\`. Command dasar **gratis**, fitur bertanda 💎 khusus **Premium** (lihat kategori *Fitur Premium*).\n\n` +
      `Contoh pakai: \`${P}player abc123 John\` → cari player "John" di server \`abc123\`.\n` +
      `Bingung? Coba \`${P}ask <pertanyaan>\` — tanya apa aja soal bot ini.`
    )
    .setImage(config.bot.bannerUrl)
    .setFooter({ text: `${config.bot.name} • v${config.bot.version} • Jika ingin melihat example command-nya, tinggal ketik command tersebut, nanti muncul example-nya.` })
    .setTimestamp();
}

function buildCategoryEmbed(key) {
  const cat = categories[key];
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`${cat.emoji} ${cat.label}`)
    .setDescription(cat.description)
    .setFooter({ text: `${config.bot.name} • v${config.bot.version} • 💎 = fitur Premium` })
    .setTimestamp();
}

function buildSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('help_category')
    .setPlaceholder('📂 Pilih kategori command...')
    .addOptions(
      Object.entries(categories).map(([key, cat]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(cat.label)
          .setValue(key)
          .setEmoji(cat.emoji)
      )
    );
  return new ActionRowBuilder().addComponents(menu);
}

function buildButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Traktir Kopi')
      .setEmoji('☕')
      .setStyle(ButtonStyle.Success)
      .setCustomId('help|bayar'),
    new ButtonBuilder()
      .setLabel('Gabung Support')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Link)
      .setURL(config.discord.supportServer),
  );
}

export default {
  name: 'help',
  aliases: ['h', 'menu', 'commands', 'cmd'],
  description: 'Tampilkan semua command bot',
  usage: `${P}help`,
  example: `${P}help`,
  cooldown: 5,

  async execute(message) {
    const sentMessage = await message.reply({
      embeds: [buildMainEmbed()],
      components: [buildSelectRow(), buildButtonRow()],
    });

    const collector = sentMessage.createMessageComponentCollector({
      filter: (i) => i.customId === 'help_category',
      time: 120_000, // menu aktif 2 menit
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          content: '❌ Cuma yang manggil command ini yang bisa pakai menu-nya.',
          ephemeral: true,
        });
      }

      const selected = interaction.values[0];
      await interaction.update({
        embeds: [buildCategoryEmbed(selected)],
        components: [buildSelectRow(), buildButtonRow()],
      });
    });

    collector.on('end', async () => {
      const disabledRow = ActionRowBuilder.from(buildSelectRow());
      disabledRow.components[0].setDisabled(true).setPlaceholder('⏱️ Menu sudah tidak aktif');

      await sentMessage.edit({ components: [disabledRow, buildButtonRow()] }).catch(() => {});
    });
  },
};