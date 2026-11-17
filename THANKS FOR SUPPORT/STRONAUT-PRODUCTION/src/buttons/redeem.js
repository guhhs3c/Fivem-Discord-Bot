import { createWarningEmbed } from '../utils/embed.js';

export default {
  customId: 'redeem',

  async execute(interaction) {
    await interaction.reply({
      embeds: [createWarningEmbed('Fitur Belum Tersedia', 'Fitur redeem belum aktif saat ini.')],
      ephemeral: true,
    });
  },
};
