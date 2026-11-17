import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createErrorEmbed, createLoadingEmbed, createDdosCheckEmbed } from '../../utils/embed.js';
import { runDdosCheck } from '../../services/monitor/ddosDetectionService.js';
import { config } from '../../config/config.js';

export default {
  name: 'ddoscheck',
  premium: true,
  aliases: ['ddoscek', 'cekddos'],
  description: 'Cek indikasi DDoS/gangguan koneksi pada satu server FiveM (heuristik, bukan konfirmasi pasti)',
  usage: `${config.bot.prefix}ddoscheck <server>`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM yang mau dicek', required: true },
  ],
  example: `${config.bot.prefix}ddoscheck satumimpi\n${config.bot.prefix}ddoscheck play.server.com:30120`,
  cooldown: 20,

  async execute(message, args) {
    if (!args[0]) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}ddoscheck <server>\`\n` +
          `**Contoh:** \`${config.bot.prefix}ddoscheck satumimpi\` *(alias)*`
        )],
      });
    }

    const serverInput = args[0];
    const loadingMsg = await message.reply({
      embeds: [createLoadingEmbed(`Mengambil beberapa sampel koneksi ke **${serverInput}**, mohon tunggu...`)],
    });

    try {
      const result = await runDdosCheck(serverInput);
      const customId = `ddoscheck|${serverInput}`;
      const components = customId.length <= 100
        ? [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(customId)
              .setLabel('Cek Ulang')
              .setEmoji('🔄')
              .setStyle(ButtonStyle.Primary)
          )]
        : [];
      await loadingMsg.edit({
        embeds: [createDdosCheckEmbed(result, serverInput)],
        components,
      });
    } catch (err) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed('Gagal Cek', `❌ **${serverInput}**: ${err.message}`)],
        components: [],
      });
    }
  },
};
