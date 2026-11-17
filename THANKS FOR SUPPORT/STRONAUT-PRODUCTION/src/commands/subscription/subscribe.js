import { createWarningEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'subscribe',
  aliases: ['sub'],
  description: 'Info berlangganan STRONAUT Bot',
  usage: `${config.bot.prefix}subscribe`,
  example: `${config.bot.prefix}subscribe`,
  cooldown: 5,
  async execute(message) {
    await message.reply({
      embeds: [createWarningEmbed(
        'Gunakan !bayar',
        `Untuk berlangganan, ketik \`${config.bot.prefix}bayar\` di channel ini — QRIS otomatis aktif setelah bayar.`
      )],
    });
  },
};
