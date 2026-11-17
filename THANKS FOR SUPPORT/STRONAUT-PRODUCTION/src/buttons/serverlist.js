import { getDb } from '../database/db.js';
import { createErrorEmbed } from '../utils/embed.js';
import { buildEmbed, buildRow } from '../commands/server/serverlist.js';

export default {
  customId: 'serverlist',

  async execute(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const currentPage = parseInt(parts[2]) || 1;

    await interaction.deferUpdate();

    const db = getDb();
    const servers = db.prepare(`SELECT * FROM servers WHERE is_active = 1 ORDER BY name ASC`).all();

    if (!servers.length) {
      return interaction.editReply({ embeds: [createErrorEmbed('Tidak Ada Server', 'Database kosong.')], components: [] });
    }

    let idx = currentPage - 1;
    if (action === 'next') idx = Math.min(servers.length - 1, currentPage);
    else if (action === 'prev') idx = Math.max(0, currentPage - 2);

    await interaction.editReply({
      embeds: [buildEmbed(servers, idx)],
      components: [buildRow(servers, idx)],
    });
  },
};
