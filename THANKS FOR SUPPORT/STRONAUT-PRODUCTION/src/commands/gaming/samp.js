import { EmbedBuilder } from 'discord.js';
import dgram from 'dgram';
import { createErrorEmbed, createLoadingEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

function querySamp(host, port) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Timeout — server tidak merespons'));
    }, 5000);

    const ip = host.split('.').map(Number);
    const portBytes = [port & 0xFF, (port >> 8) & 0xFF];
    const packet = Buffer.from([
      0x53, 0x41, 0x4D, 0x50, // "SAMP"
      ...ip, ...portBytes,
      0x69, // 'i' = info query
    ]);

    socket.on('message', (msg) => {
      clearTimeout(timeout);
      socket.close();
      try {
        let offset = 11;
        const online = msg[offset]; offset += 1;
        const players = msg.readUInt16LE(offset); offset += 2;
        const maxPlayers = msg.readUInt16LE(offset); offset += 2;
        const hostLen = msg.readUInt32LE(offset); offset += 4;
        const hostname = msg.slice(offset, offset + hostLen).toString(); offset += hostLen;
        const gmLen = msg.readUInt32LE(offset); offset += 4;
        const gamemode = msg.slice(offset, offset + gmLen).toString(); offset += gmLen;
        resolve({ online: true, hostname, players, maxPlayers, gamemode, host, port });
      } catch {
        reject(new Error('Gagal parse response SA-MP'));
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      socket.close();
      reject(err);
    });

    socket.send(packet, 0, packet.length, port, host);
  });
}

export default {
  name: 'samp',
  aliases: ['sa-mp', 'openmp'],
  description: 'Query server SA-MP / Open.MP',
  usage: `${config.bot.prefix}samp <ip> [port]`,
  slashOptions: [
    { name: 'ip', description: 'IP address server SA-MP/Open.MP', required: true },
    { name: 'port', description: 'Port server (default 7777)', required: false },
  ],
  example: `${config.bot.prefix}samp 1.2.3.4 7777`,
  cooldown: 8,

  async execute(message, args) {
    if (!args[0]) {
      return message.reply({ embeds: [createErrorEmbed('Kurang Argumen', `**Penggunaan:** \`${config.bot.prefix}samp <ip> [port]\``)] });
    }

    const host = args[0];
    const port = parseInt(args[1]) || 7777;
    const loadingMsg = await message.reply({ embeds: [createLoadingEmbed(`Query SA-MP server \`${host}:${port}\`...`)] });

    try {
      const data = await querySamp(host, port);
      const filled = data.maxPlayers ? Math.min(10, Math.round((data.players / data.maxPlayers) * 10)) : 0;
      const bar = '`' + '█'.repeat(filled) + '░'.repeat(10 - filled) + '`';

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`🟢 ${data.hostname}`)
        .setDescription(`${SEPARATOR}`)
        .addFields(
          { name: `👥 Players — ${data.players}/${data.maxPlayers}`, value: bar, inline: false },
          { name: '🎮 Gamemode', value: `\`${data.gamemode || 'N/A'}\``, inline: true },
          { name: '📡 Connect', value: `\`${host}:${port}\``, inline: true },
        )
        .setFooter({ text: `${config.bot.name} • SA-MP Query` })
        .setTimestamp();

      await loadingMsg.edit({ embeds: [embed] });
    } catch (err) {
      await loadingMsg.edit({ embeds: [createErrorEmbed('Server Offline / Tidak Bisa Diakses', err.message)] });
    }
  },
};
