import { removePlaytimeSubscriptions } from '../../services/fivem/playtimeService.js';
import { createSuccessEmbed, createWarningEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'stoptime',
  aliases: ['unsettime'],
  description: 'Hentikan langganan laporan playtime otomatis',
  usage: `${config.bot.prefix}stoptime`,
  example: `${config.bot.prefix}stoptime`,
  cooldown: 3,

  async execute(message) {
    const removed = removePlaytimeSubscriptions(message.author.id);

    if (removed === 0) {
      return message.reply({
        embeds: [createWarningEmbed('Tidak Ada Langganan', `Kamu belum punya langganan laporan playtime yang aktif.\nGunakan \`${config.bot.prefix}settime\` untuk mulai langganan.`)],
      });
    }

    return message.reply({
      embeds: [createSuccessEmbed('Langganan Dihentikan', `🛑 ${removed} langganan laporan playtime otomatis kamu udah dihentikan.`)],
    });
  },
};
