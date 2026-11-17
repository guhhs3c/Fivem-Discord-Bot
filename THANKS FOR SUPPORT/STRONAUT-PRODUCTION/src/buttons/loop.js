import { createWarningEmbed } from '../utils/embed.js';
import { config } from '../config/config.js';

export default {
  customId: 'loop',

  async execute(interaction) {
    const parts = interaction.customId.split('|');
    const server = parts[1] || '';
    const nama = parts[2] || '';

    await interaction.reply({
      embeds: [createWarningEmbed(
        'Gunakan Command !loop',
        `Untuk memulai auto monitoring, ketik di chat:\n\n` +
        `\`\`\`${config.bot.prefix}loop ${server} ${nama} 60\`\`\`\n` +
        `Ganti \`60\` dengan interval (detik) sesuai keinginan.\n` +
        `Min: \`${config.loop.minInterval}s\` · Max: \`${config.loop.maxInterval}s\``
      )],
      ephemeral: true,
    });
  },
};
