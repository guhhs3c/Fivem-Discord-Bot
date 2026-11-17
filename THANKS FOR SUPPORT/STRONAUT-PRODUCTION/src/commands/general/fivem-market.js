import { EmbedBuilder } from 'discord.js';
import {
  searchMarketplace,
  buildDirectSearchUrl,
  CATEGORIES,
  MarketplaceSearchError,
} from '../../utils/marketplaceSearch.js'; // sesuaikan kalau lokasi marketplaceSearch.js beda

/**
 * Parse args ala CLI sederhana:
 *   !fivem-market esx inventory --kategori scripts --gratis
 *   !fivem-market lowrider -k vehicles
 */
function parseArgs(args) {
  let category = null;
  let freeOnly = false;
  const queryWords = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const lower = arg.toLowerCase();

    if (lower === '--kategori' || lower === '-k') {
      category = (args[++i] || '').toLowerCase();
      continue;
    }
    if (lower.startsWith('--kategori=')) {
      category = lower.split('=')[1];
      continue;
    }
    if (lower === '--gratis' || lower === '-g' || lower === '--free') {
      freeOnly = true;
      continue;
    }

    queryWords.push(arg);
  }

  return { query: queryWords.join(' ').trim(), category, freeOnly };
}

export default {
  name: 'fivem-market',
  aliases: ['fmarket', 'cfxmarket'],
  description: 'Cari script/map/vehicle/character/clothing/misc di Cfx Marketplace',
  usage: '<kata kunci> [--kategori scripts|maps|character|clothing|vehicles|misc] [--gratis]',
  cooldown: 8,
  slashOptions: [
    { name: 'kata_kunci', description: 'Kata kunci pencarian (mis. esx inventory)', required: true },
    {
      name: 'kategori',
      description: 'Filter kategori (opsional)',
      required: false,
      flag: 'kategori',
      choices: [
        { name: 'Scripts', value: 'scripts' },
        { name: 'Maps', value: 'maps' },
        { name: 'Character', value: 'character' },
        { name: 'Clothing', value: 'clothing' },
        { name: 'Vehicles', value: 'vehicles' },
        { name: 'Misc', value: 'misc' },
      ],
    },
    {
      name: 'gratis',
      description: 'Cuma tampilkan yang gratis?',
      required: false,
      boolFlag: true,
      flag: 'gratis',
      choices: [
        { name: 'Ya', value: 'ya' },
        { name: 'Tidak', value: 'tidak' },
      ],
    },
  ],

  execute: async (message, args, client) => {
    if (!args.length) {
      const list = Object.entries(CATEGORIES)
        .map(([slug, label]) => `\`${slug}\` (${label})`)
        .join(', ');
      return message.reply(
        `Contoh: \`!fivem-market esx inventory --kategori scripts --gratis\`\n` +
          `Kategori yang tersedia: ${list}`
      );
    }

    const { query, category, freeOnly } = parseArgs(args);

    if (!query) {
      return message.reply('Kata kunci pencarian tidak boleh kosong.');
    }

    if (category && !CATEGORIES[category]) {
      const list = Object.keys(CATEGORIES).join(', ');
      return message.reply(`Kategori \`${category}\` tidak dikenal. Pilihan: ${list}`);
    }

    const directUrl = buildDirectSearchUrl(query, category);
    const categoryLabel = category ? CATEGORIES[category] : 'Semua kategori';

    const loadingMsg = await message.reply('🔎 Mencari di Cfx Marketplace...');

    try {
      const results = await searchMarketplace(query, category, freeOnly);

      const embed = new EmbedBuilder()
        .setTitle(`Hasil Cfx Marketplace: "${query}"`)
        .setColor(0xf1c40f)
        .setURL(directUrl)
        .setFooter({ text: `Kategori: ${categoryLabel}${freeOnly ? ' • Gratis saja' : ''}` });

      if (results.length === 0) {
        embed.setDescription(
          `Tidak ada hasil dari pencarian otomatis. Coba cari manual di marketplace:\n${directUrl}`
        );
      } else {
        embed.setDescription(
          results
            .map((r, i) => {
              const snippet = r.snippet ? `\n${truncate(r.snippet, 150)}` : '';
              return `**${i + 1}. [${r.title}](${r.url})**${snippet}`;
            })
            .join('\n\n')
        );
        embed.addFields({ name: 'Lihat semua hasil di marketplace', value: directUrl });
      }

      await loadingMsg.edit({ content: null, embeds: [embed] });
    } catch (err) {
      if (err instanceof MarketplaceSearchError) {
        await loadingMsg.edit({
          content: `⚠️ ${err.message}\n\nCoba cari manual di sini: ${directUrl}`,
        });
      } else {
        console.error('[fivem-market] Error:', err);
        await loadingMsg.edit({
          content: `⚠️ Terjadi error tak terduga. Coba cari manual di sini: ${directUrl}`,
        });
      }
    }
  },
};

function truncate(str, max) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}
