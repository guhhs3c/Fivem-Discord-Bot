import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../../config/config.js';
import { SEPARATOR } from '../../utils/embed.js';

export default {
  name: 'support',
  aliases: ['discord'],
  description: 'Link Discord support server',
  usage: `${config.bot.prefix}support`,
  example: `${config.bot.prefix}support`,
  cooldown: 10,

  async execute(message) {
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('🆘 Support Server')
      .setDescription(`${SEPARATOR}\n\nButuh bantuan? Bergabunglah ke **Support Server** kami!\n\n${SEPARATOR}`)
      .addFields(
        { name: '🔗 Invite Link', value: config.discord.supportServer },
        { name: '⏰ Response Time', value: '`< 24 jam`', inline: true },
        { name: '🌐 Bahasa', value: '`Bahasa Indonesia`', inline: true },
      )
      .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Join Support Server')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Link)
        .setURL(config.discord.supportServer),
    );

    await message.reply({ embeds: [embed], components: [row] });
  },
};
