import { getActiveLoops } from './loop.js';
import { createSuccessEmbed, createWarningEmbed } from '../../utils/embed.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

export default {
  name: 'stoploop',
  aliases: ['stoploops', 'untrack'],
  description: 'Hentikan auto monitoring player yang aktif',
  usage: `${config.bot.prefix}stoploop`,
  example: `${config.bot.prefix}stoploop`,
  cooldown: 3,

  async execute(message) {
    const activeLoops = getActiveLoops();
    const userId = message.author.id;

    if (!activeLoops.has(userId)) {
      return message.reply({
        embeds: [createWarningEmbed('Tidak Ada Loop Aktif', `Kamu tidak memiliki monitoring aktif.\nGunakan \`${config.bot.prefix}loop\` untuk mulai monitoring.`)],
      });
    }

    clearInterval(activeLoops.get(userId));
    activeLoops.delete(userId);

    try {
      getDb().prepare(`UPDATE loopfinder SET is_active = 0 WHERE discord_id = ? AND is_active = 1`).run(userId);
    } catch {}

    await message.reply({
      embeds: [createSuccessEmbed('Monitoring Dihentikan', '✅ Auto monitoring telah berhasil dihentikan.')],
    });
  },
};
