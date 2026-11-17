import { EmbedBuilder } from 'discord.js';
import { config } from '../config/config.js';
import { SEPARATOR } from '../utils/embed.js';
import { getDefaultPlan } from '../utils/premiumPlans.js';

export default {
  customId: 'help',

  async execute(interaction) {
    const parts = interaction.customId.split('|');
    const action = parts[1];

    if (action === 'bayar') {
      const { price, days: durationDays } = getDefaultPlan();
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('💳 Berlangganan STRONAUT Bot')
        .setDescription(
          `${SEPARATOR}\n\n` +
          `Akses fitur khusus langganan (\`${config.bot.prefix}cfxfinder\`, \`${config.bot.prefix}setmonitor\`, \`${config.bot.prefix}settextstatusall\`, \`${config.bot.prefix}loop\`) mulai dari **Rp ${price.toLocaleString('id-ID')} / ${durationDays} hari**.\n\n` +
          `Ketik \`${config.bot.prefix}bayar\` di channel ini untuk membuat QRIS pembayaran (otomatis aktif setelah bayar).\n\n${SEPARATOR}`
        )
        .setFooter({ text: `${config.bot.name} • Support Kami` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
