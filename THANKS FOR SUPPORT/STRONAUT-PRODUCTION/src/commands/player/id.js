import { findPlayerById } from '../../services/fivem/playerService.js';
import { createPlayerFoundEmbed, createErrorEmbed, createLoadingEmbed, createWarningEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'id',
  aliases: ['findid', 'pid'],
  description: 'Cari player berdasarkan Server ID di FiveM',
  usage: `${config.bot.prefix}id <server> <id>`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM', required: true },
    { name: 'id', description: 'Server ID player', required: true },
  ],
  example: `${config.bot.prefix}id satumimpi 5\n${config.bot.prefix}id smrp 12`,
  cooldown: 5,

  async execute(message, args) {
    if (args.length < 2) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}id <server> <id>\`\n**Contoh:** \`${config.bot.prefix}id satumimpi 5\``
        )],
      });
    }

    const serverInput = args[0];
    const playerId = args[1];

    if (isNaN(parseInt(playerId))) {
      return message.reply({
        embeds: [createErrorEmbed('ID Tidak Valid', 'Server ID harus berupa angka.')],
      });
    }

    const loadingMsg = await message.reply({
      embeds: [createLoadingEmbed(`Mencari player ID \`${playerId}\` di **${serverInput}**...`)],
    });

    try {
      const { player, serverData, endpoint, dbRow } = await findPlayerById(serverInput, playerId);
      const hostname = serverData?.Data?.hostname?.replace(/\^[0-9]/g, '').trim() || serverInput;
      const bannerUrl = dbRow?.banner_url || null;

      if (!player) {
        return loadingMsg.edit({
          embeds: [createWarningEmbed('Player Tidak Ditemukan', `Tidak ada player dengan ID \`${playerId}\` di **${hostname}**.`)],
          components: [],
        });
      }

      await loadingMsg.edit({
        embeds: [createPlayerFoundEmbed(player, hostname, endpoint, bannerUrl)],
        components: [],
      });
    } catch (err) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed('Gagal Mengambil Data', `❌ **${serverInput}**: ${err.message}`)],
        components: [],
      });
    }
  },
};
