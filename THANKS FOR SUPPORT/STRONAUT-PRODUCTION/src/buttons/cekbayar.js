import { createErrorEmbed, createSuccessEmbed, createWarningEmbed } from '../utils/embed.js';
import { checkOrder } from '../services/payment/premiumPayment.js';

// Tombol "Cek Pembayaran" — cadangan kalau user tidak mau menunggu poller (15 detik).
export default {
  customId: 'cekbayar',

  async execute(interaction) {
    const [, merchantRef] = interaction.customId.split('|');
    await interaction.deferReply({ ephemeral: true });

    let res;
    try {
      res = await checkOrder(interaction.client, merchantRef);
    } catch (err) {
      console.error('[CekBayar]', err.message);
      return interaction.editReply({ embeds: [createErrorEmbed('Gagal Cek', 'Gateway sedang bermasalah, coba lagi sebentar.')] });
    }

    switch (res.status) {
      case 'PAID':
        return interaction.editReply({ embeds: [createSuccessEmbed('Lunas ✅', 'Pembayaran diterima, premium server ini sudah aktif.')] });
      case 'UNPAID':
        return interaction.editReply({ embeds: [createWarningEmbed('Belum Terbayar', 'Pembayaran belum terdeteksi. Selesaikan pembayaran lalu tekan tombol ini lagi (atau tunggu, akan aktif otomatis).')] });
      case 'EXPIRED':
      case 'CANCELED':
      case 'FAILED':
        return interaction.editReply({ embeds: [createErrorEmbed('QR Kedaluwarsa', 'Pembayaran ini sudah kedaluwarsa/gagal. Ketik `!bayar` lagi untuk QR baru.')] });
      default:
        return interaction.editReply({ embeds: [createErrorEmbed('Tidak Ditemukan', 'Order tidak ditemukan.')] });
    }
  },
};
