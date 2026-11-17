import { createWarningEmbed } from '../utils/embed.js';

export default {
  customId: 'konfirm',

  async execute(interaction) {
    await interaction.reply({
      embeds: [createWarningEmbed('Fitur Belum Tersedia', 'Fitur konfirmasi belum aktif saat ini.')],
      ephemeral: true,
    });
  },
};
