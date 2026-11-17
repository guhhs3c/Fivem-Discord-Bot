import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { findPlayerByName } from '../../services/fivem/playerService.js';
import { createPlayerResultEmbed, createPlayerNotFoundEmbed, createErrorEmbed, createLoadingEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'player',
  premium: true,
  aliases: ['p', 'cari'],
  description: 'Cari player berdasarkan nama di server FiveM',
  usage: `${config.bot.prefix}player <server> <nama>`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM', required: true },
    { name: 'nama', description: 'Nama player yang dicari', required: true },
  ],
  example: `${config.bot.prefix}player satumimpi budi\n${config.bot.prefix}p smrp playerku`,
  cooldown: 5,

  async execute(message, args) {
    if (args.length < 2) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}player <server> <nama>\`\n` +
          `**Contoh:** \`${config.bot.prefix}player satumimpi budi\`\n\n` +
          `Gunakan \`${config.bot.prefix}serverlist\` untuk lihat daftar server.`
        )],
      });
    }

    const serverInput = args[0];
    const nama = args.slice(1).join(' ');

    const loadingMsg = await message.reply({
      embeds: [createLoadingEmbed(`Mencari **${nama}** di **${serverInput}**...`)],
    });

    try {
      const { found, serverData, endpoint, dbRow } = await findPlayerByName(serverInput, nama);
      const hostname = serverData?.Data?.hostname?.replace(/\^[0-9]/g, '').trim() || serverInput;
      const bannerUrl = dbRow?.banner_url || null;

      if (!found.length) {
        return loadingMsg.edit({
          embeds: [createPlayerNotFoundEmbed(nama, hostname)],
          components: [],
        });
      }

      // Single minimalist embed for all results
      const embed = createPlayerResultEmbed(found, nama, hostname, endpoint, bannerUrl);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`refresh|player|${serverInput}|${nama}`)
          .setLabel('Refresh')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`loop|${serverInput}|${nama}`)
          .setLabel('Auto Monitor')
          .setEmoji('🔁')
          .setStyle(ButtonStyle.Primary),
      );

      await loadingMsg.edit({ embeds: [embed], components: [row] });
    } catch (err) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed(
          'Gagal Mengambil Data',
          `Tidak bisa terhubung ke **${serverInput}**\n\n> \`${err.message}\`\n\n` +
          `Gunakan \`${config.bot.prefix}serverlist\` untuk server yang tersedia.`
        )],
        components: [],
      });
    }
  },
};
