import axios from 'axios';
import { createErrorEmbed, createSuccessEmbed, createWarningEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';
import {
  sendPremiumBackup,
  restorePremiumData,
  parseBackupBuffer,
  getBackupStatus,
} from '../../services/backup/premiumBackup.js';

const p = config.bot.prefix;

export default {
  name: 'premiumbackup',
  aliases: ['backuppremium', 'pbackup'],
  description: 'Backup/restore SELURUH database via Gmail (Owner only): send, status, restore',
  usage: `${p}premiumbackup <send|status|restore>`,
  slashOptions: [{ name: 'aksi', description: 'send / status (restore hanya lewat prefix command)', required: false }],
  example: `${p}premiumbackup send\n${p}premiumbackup status\n${p}premiumbackup restore (lampirkan file .json.gz backup)`,
  cooldown: 10,

  async execute(message, args) {
    if (message.author.id !== config.discord.ownerId) {
      return message.reply({ embeds: [createErrorEmbed('Akses Ditolak', 'Command ini hanya untuk Owner bot.')] });
    }

    const action = (args[0] || 'send').toLowerCase();

    if (action === 'status') {
      const s = getBackupStatus();
      const c = s.counts;
      return message.reply({
        embeds: [
          createSuccessEmbed(
            'Status Backup Database',
            `📬 **Gmail tujuan:** ${s.configured ? `\`${s.to}\`` : '❌ belum dikonfigurasi (.env)'}\n` +
              `🕒 **Backup terakhir:** ${s.state.lastSentAt ? `<t:${Math.floor(new Date(s.state.lastSentAt).getTime() / 1000)}:R>` : 'belum pernah'}\n\n` +
              `**Data saat ini:**\n${Object.entries(c).map(([t, n]) => `• ${t}: ${n}`).join('\n')}`
          ),
        ],
      });
    }

    if (action === 'send') {
      const res = await sendPremiumBackup({ reason: 'manual (owner)', force: true });
      if (!res.ok) {
        return message.reply({ embeds: [createErrorEmbed('Backup Gagal', `\`${res.error}\``)] });
      }
      return message.reply({
        embeds: [createSuccessEmbed('Backup Terkirim 📬', `Seluruh database dikirim ke **${config.backup.emailTo}**.\n📎 \`${res.filename}\``)],
      });
    }

    if (action === 'restore') {
      const attachment = message.attachments?.first?.();
      if (!attachment) {
        return message.reply({
          embeds: [
            createWarningEmbed(
              'Lampirkan File Backup',
              `Download file \`.json.gz\` dari email backup, lalu kirim pesan:\n\`${p}premiumbackup restore\` **dengan file itu terlampir**.\n\n(Restore tidak bisa lewat slash command — pakai prefix.)`
            ),
          ],
        });
      }
      if (attachment.size > 25 * 1024 * 1024) {
        return message.reply({ embeds: [createErrorEmbed('File Terlalu Besar', 'Maksimal 25 MB.')] });
      }

      try {
        const { data } = await axios.get(attachment.url, { responseType: 'arraybuffer', timeout: 30000 });
        const result = restorePremiumData(parseBackupBuffer(Buffer.from(data)));
        const lines = Object.entries(result).map(([t, r]) => `• ${t}: ${r.diproses} diproses${r.dilewati ? `, ${r.dilewati} dilewati` : ''}`);
        return message.reply({ embeds: [createSuccessEmbed('Restore Selesai ♻️', lines.join('\n'))] });
      } catch (err) {
        return message.reply({ embeds: [createErrorEmbed('Restore Gagal', `\`${err.message}\``)] });
      }
    }

    return message.reply({
      embeds: [createWarningEmbed('Aksi Tidak Dikenal', `Pakai: \`${p}premiumbackup <send|status|restore>\``)],
    });
  },
};
