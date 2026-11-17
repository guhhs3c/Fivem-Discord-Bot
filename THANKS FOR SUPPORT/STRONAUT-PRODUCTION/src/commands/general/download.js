import { EmbedBuilder } from 'discord.js';
import { CATEGORIES } from '../../utils/downloadLinks.js'; // sesuaikan path
import { config } from '../../config/config.js';
import { SEPARATOR } from '../../utils/embed.js';

const CATEGORY_EMOJI = {
  client: '🎮',
  citizen: '🏙️',
  soundpack: '🔊',
  other: '📦',
};

function footerText(extra) {
  return `${config.bot.name} • v${config.bot.version}${extra ? ` • ${extra}` : ''}`;
}

function formatItems(items) {
  return items
    .map((item, i) => {
      const note = item.note ? `\n> ${item.note}` : '';
      return `**${i + 1}.** **[${item.name}](${item.url})**${note}`;
    })
    .join('\n\n');
}

function buildCategoryEmbed(key) {
  const cat = CATEGORIES[key];
  const emoji = CATEGORY_EMOJI[key] || '📁';

  return new EmbedBuilder()
    .setColor(cat.color)
    .setAuthor({ name: '⬇️ Download Center' })
    .setTitle(`${emoji} ${cat.label}`)
    .setDescription(`${SEPARATOR}\n\n${formatItems(cat.items)}\n\n${SEPARATOR}`)
    .setFooter({ text: footerText(`${cat.items.length} link • /download kategori:<lain>`) })
    .setTimestamp();
}

function buildOverviewEmbed() {
  const categoryFields = Object.entries(CATEGORIES).map(([key, cat]) => ({
    name: `${CATEGORY_EMOJI[key] || '📁'} ${cat.label}`,
    value: `\`${key}\` — ${cat.items.length} link`,
    inline: true,
  }));

  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setAuthor({ name: '⬇️ Download Center' })
    .setTitle('Pilih Kategori Download')
    .setDescription(
      `${SEPARATOR}\n\n` +
      `Pakai \`/download kategori:<nama>\` atau \`!download <kategori>\` untuk lihat link.\n\n` +
      `${SEPARATOR}`
    )
    .addFields(categoryFields)
    .setFooter({ text: footerText('Contoh: !download client') })
    .setTimestamp();
}

const ALIASES = {
  client: 'client',
  fivem: 'client',
  scripts: 'scripts',
  script: 'scripts',
  ctzn: 'scripts',
  citizen: 'citizen',
  soundpack: 'soundpack',
  sound: 'soundpack',
  mods: 'other',
  other: 'other',
  lainnya: 'other',
};

export default {
  name: 'download',
  aliases: ['dl', 'downloads'],
  description: 'Tampilkan link download client FiveM & resource server',
  usage: '[client|citizen|soundpack|other]',
  cooldown: 5,
  slashOptions: [
    {
      name: 'kategori',
      description: 'Kategori link download (kosongkan untuk lihat semua kategori)',
      required: false,
      choices: [
        { name: 'FiveM Client (Resmi)', value: 'client' },
        { name: 'CITIZEN RP Scripts', value: 'citizen' },
        { name: 'Soundpack', value: 'soundpack' },
        { name: 'Lainnya', value: 'other' },
      ],
    },
  ],

  execute: async (message, args) => {
    if (!args.length) {
      return message.reply({ embeds: [buildOverviewEmbed()] });
    }

    const key = ALIASES[args[0].toLowerCase()];
    if (!key) {
      const list = Object.keys(CATEGORIES).join(', ');
      const embed = new EmbedBuilder()
        .setColor(config.colors.danger)
        .setTitle('❌ Kategori Tidak Dikenal')
        .setDescription(`${SEPARATOR}\n\nKategori \`${args[0]}\` tidak ada.\n**Pilihan:** ${list}\n\n${SEPARATOR}`)
        .setFooter({ text: footerText('Download Center') })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    return message.reply({ embeds: [buildCategoryEmbed(key)] });
  },
};
