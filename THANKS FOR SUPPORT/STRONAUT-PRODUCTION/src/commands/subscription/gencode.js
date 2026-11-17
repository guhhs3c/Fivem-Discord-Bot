import { createErrorEmbed, createSuccessEmbed } from '../../utils/embed.js';
import { generateRedeemCode } from '../../utils/donor.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';
import { getDefaultPlan } from '../../utils/premiumPlans.js';

export default {
  name: 'gencode',
  aliases: ['generatecode', 'buatkode'],
  description: 'Generate kode redeem langganan (Owner only) — untuk aktivasi manual per-guild',
  usage: `${config.bot.prefix}gencode [durasi_hari]`,
  slashOptions: [
    { name: 'durasi_hari', description: `Durasi langganan dalam hari (kosongkan = default ${getDefaultPlan().days} hari, isi 0 = lifetime)`, required: false },
  ],
  example: `${config.bot.prefix}gencode 30\n${config.bot.prefix}gencode`,
  cooldown: 3,

  async execute(message, args) {
    if (message.author.id !== config.discord.ownerId) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Command ini hanya untuk Owner bot.')],
      });
    }

    const durationDays =
      args[0] !== undefined && !isNaN(parseInt(args[0]))
        ? Math.max(0, parseInt(args[0]))
        : getDefaultPlan().days;

    const db = getDb();

    let code;
    do {
      code = generateRedeemCode();
    } while (db.prepare(`SELECT 1 FROM redeem_codes WHERE code = ?`).get(code));

    db.prepare(
      `INSERT INTO redeem_codes (code, duration_days, created_by) VALUES (?, ?, ?)`
    ).run(code, durationDays, message.author.tag);

    const durationText = durationDays > 0 ? `${durationDays} hari` : 'Lifetime (selamanya) ♾️';

    const codeEmbed = createSuccessEmbed(
      'Kode Redeem Dibuat ✅',
      `\`\`\`${code}\`\`\`\n` +
        `⏳ **Durasi:** ${durationText}\n\n` +
        `Kirim kode ini ke donatur, terus suruh klaim pakai:\n` +
        `\`${config.bot.prefix}redeem ${code}\``
    );

    // Kirim ke DM owner biar kode gak nongol di channel publik.
    try {
      await message.author.send({ embeds: [codeEmbed] });
      if (message.guild) {
        await message.reply({
          embeds: [createSuccessEmbed('Kode Terkirim 📩', 'Kode redeem sudah dikirim ke DM kamu.')],
        });
      }
    } catch {
      // DM ketutup → fallback tampilin di channel (owner yang tanggung jawab keamanannya).
      await message.reply({ embeds: [codeEmbed] });
    }
  },
};
