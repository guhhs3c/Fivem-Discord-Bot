// =======================================================
// Deploy slash commands ke Discord
// -------------------------------------------------------
// Jalankan manual kalau mau paksa re-register (mis. abis nambah/
// ubah command). Bot juga otomatis register ulang tiap kali start
// (lihat src/index.js), jadi script ini opsional.
//
// Guild-scoped (GUILD_ID diisi di .env) → langsung muncul (~instan).
// Global (GUILD_ID kosong)              → bisa sampai ~1 jam nyebar.
//
// Cara pakai: npm run deploy
// =======================================================
import 'dotenv/config';
import { REST, Routes, Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { config } from './config/config.js';
import { buildSlashCommandsData } from './utils/slashBuilder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadCommands() {
  const commands = new Collection();
  const categoriesDir = path.join(__dirname, 'commands');
  const categories = readdirSync(categoriesDir);

  for (const category of categories) {
    const files = readdirSync(path.join(categoriesDir, category)).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const mod = await import(`./commands/${category}/${file}`);
      const command = mod.default;
      if (!command?.name) continue;
      commands.set(command.name, command);
    }
  }

  return commands;
}

async function main() {
  if (!config.bot.token || !config.bot.clientId) {
    console.error('[Deploy] DISCORD_TOKEN dan/atau CLIENT_ID belum diisi di .env!');
    process.exit(1);
  }

  const commands = await loadCommands();
  const body = buildSlashCommandsData(commands);

  const rest = new REST({ version: '10' }).setToken(config.bot.token);

  const route = config.discord.guildId
    ? Routes.applicationGuildCommands(config.bot.clientId, config.discord.guildId)
    : Routes.applicationCommands(config.bot.clientId);

  console.log(`[Deploy] Mendaftarkan ${body.length} slash command (${config.discord.guildId ? `guild ${config.discord.guildId}` : 'global'})...`);

  const result = await rest.put(route, { body });
  console.log(`[Deploy] Selesai. ${result.length} slash command aktif.`);
}

main().catch((err) => {
  console.error('[Deploy] Gagal:', err);
  process.exit(1);
});