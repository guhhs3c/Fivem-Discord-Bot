import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import axios from 'axios';
import { createErrorEmbed, createLoadingEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

const http = axios.create({ timeout: 10000 });

async function scrapeSteamProfile(input) {
  let url;
  if (/^\d{17}$/.test(input)) {
    url = `https://steamcommunity.com/profiles/${input}/?xml=1`;
  } else {
    url = `https://steamcommunity.com/id/${input}/?xml=1`;
  }
  const { data } = await http.get(url, { responseType: 'text' });
  const get = (tag) => {
    const m = data.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([^<]*)</${tag}>`));
    return m ? (m[1] || m[2] || '').trim() : null;
  };
  return {
    steamId64: get('steamID64'),
    steamId: get('steamID'),
    onlineState: get('onlineState'),
    stateMessage: get('stateMessage'),
    privacyState: get('privacyState'),
    vacBanned: get('vacBanned') === '1',
    tradeBanState: get('tradeBanState'),
    isLimited: get('isLimitedAccount') === '1',
    memberSince: get('memberSince'),
    avatarFull: get('avatarFull'),
    headline: get('headline'),
    location: get('location'),
    realname: get('realname'),
    profileUrl: get('customURL')
      ? `https://steamcommunity.com/id/${get('customURL')}`
      : `https://steamcommunity.com/profiles/${get('steamID64')}`,
  };
}

export default {
  name: 'steam',
  aliases: ['steamprofile', 'sp'],
  description: 'Profil Steam + VAC ban check',
  usage: `${config.bot.prefix}steam <steamid64/vanityurl>`,
  slashOptions: [
    { name: 'input', description: 'SteamID64 atau vanity URL', required: true },
  ],
  example: `${config.bot.prefix}steam 76561198000000000\n${config.bot.prefix}steam gabelogannewell`,
  cooldown: 10,

  async execute(message, args) {
    if (!args[0]) {
      return message.reply({ embeds: [createErrorEmbed('Kurang Argumen', `**Penggunaan:** \`${config.bot.prefix}steam <steamid64/vanityurl>\``)] });
    }

    const input = args[0].replace(/https?:\/\/steamcommunity\.com\/(id|profiles)\//i, '').replace(/\/$/, '');
    const loadingMsg = await message.reply({ embeds: [createLoadingEmbed(`Mencari profil Steam \`${input}\`...`)] });

    try {
      const profile = await scrapeSteamProfile(input);

      if (!profile.steamId64) {
        return loadingMsg.edit({ embeds: [createErrorEmbed('Profil Tidak Ditemukan', `Tidak bisa menemukan profil Steam \`${input}\`.`)] });
      }

      const privacyLabel = { public: '🌐 Public', friendsonly: '👥 Friends Only', private: '🔒 Private' }[profile.privacyState] || profile.privacyState || 'N/A';
      const onlineEmoji = profile.onlineState === 'online' ? '🟢' : profile.onlineState === 'in-game' ? '🎮' : '⚫';

      const embed = new EmbedBuilder()
        .setColor(profile.vacBanned ? config.colors.danger : config.colors.primary)
        .setTitle(`${onlineEmoji} ${profile.steamId || 'Steam Profile'}`)
        .setDescription(`${SEPARATOR}`)
        .setThumbnail(profile.avatarFull || null)
        .addFields(
          { name: '👤 Real Name', value: profile.realname || 'N/A', inline: true },
          { name: '📍 Lokasi', value: profile.location || 'N/A', inline: true },
          { name: '📅 Member Since', value: profile.memberSince || 'N/A', inline: true },
          { name: '🔒 Privacy', value: privacyLabel, inline: true },
          { name: '🚦 Status', value: profile.stateMessage || profile.onlineState || 'N/A', inline: true },
          { name: '🆔 SteamID64', value: profile.steamId64 ? `\`${profile.steamId64}\`` : 'N/A', inline: false },
          {
            name: '⚠️ Status Akun',
            value: [
              profile.vacBanned ? '🔴 **VAC BANNED**' : '✅ Tidak VAC Ban',
              profile.tradeBanState && profile.tradeBanState !== 'None' ? `🔴 Trade Ban: ${profile.tradeBanState}` : '✅ Trade OK',
              profile.isLimited ? '⚠️ Akun Limited' : '✅ Akun Normal',
            ].join('\n'),
            inline: false,
          },
        )
        .setFooter({ text: `${config.bot.name} • Steam Lookup` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Buka Profil Steam').setStyle(ButtonStyle.Link).setURL(profile.profileUrl),
      );

      await loadingMsg.edit({ embeds: [embed], components: [row] });
    } catch (err) {
      await loadingMsg.edit({ embeds: [createErrorEmbed('Gagal Fetch Profil', `\`${err.message}\``)] });
    }
  },
};
