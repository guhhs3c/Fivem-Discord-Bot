import { EmbedBuilder } from 'discord.js';
import { config } from '../config/config.js';
import { SEPARATOR } from '../utils/embed.js';

export default {
  customId: 'bayar',

  async execute(interaction) {
    const { qrisImageUrl } = config.payment;
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('💳 Support STRONAUT Bot')
      .setDescription(
        `${SEPARATOR}\n\nTerima kasih sudah menggunakan **${config.bot.name}**! 🙏\n\n` +
        `Jika bot ini membantu, kamu bisa support dengan scan QRIS di bawah.\n\n${SEPARATOR}`
      )
      .addFields(
        {
          name: '📝 Cara Donasi',
          value: [
            '1️⃣ Scan QRIS menggunakan e-wallet / bank apapun',
            '2️⃣ Masukkan nominal sesuai kemampuan',
            '3️⃣ Selesaikan pembayaran · Terima kasih! 🙏',
          ].join('\n'),
        },
        { name: '💡 Info', value: 'Donasi **sukarela** · Semua fitur tetap **GRATIS untuk semua**.' },
      )
      .setFooter({ text: `${config.bot.name} • Support Kami` })
      .setTimestamp();

    if (qrisImageUrl) embed.setImage(qrisImageUrl);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
