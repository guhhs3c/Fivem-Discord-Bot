import { SlashCommandBuilder } from 'discord.js';

// Discord slash command name/description harus lowercase & max 100 char,
// dan cuma boleh huruf/angka/dash/underscore.
function toSlashName(name) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'cmd';
}

function toSlashDescription(desc) {
  const clean = (desc || 'Tidak ada deskripsi.').trim();
  return clean.length > 100 ? `${clean.slice(0, 97)}...` : clean;
}

/**
 * Ubah Collection command (client.commands, tanpa duplikat alias)
 * jadi array data slash command siap di-deploy ke Discord API.
 */
export function buildSlashCommandsData(commands) {
  const seen = new Set();
  const data = [];

  for (const command of commands.values()) {
    if (!command?.name || seen.has(command.name)) continue;
    seen.add(command.name);

    const builder = new SlashCommandBuilder()
      .setName(toSlashName(command.name))
      .setDescription(toSlashDescription(command.description));

    for (const opt of command.slashOptions || []) {
      builder.addStringOption((option) =>
        option
          .setName(opt.name)
          .setDescription(toSlashDescription(opt.description || opt.name))
          .setRequired(Boolean(opt.required))
          .setChoices(...(opt.choices || []))
      );
    }

    data.push(builder.toJSON());
  }

  return data;
}
