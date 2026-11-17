import { EmbedBuilder } from 'discord.js';
import { config } from '../../config/config.js';
import { SEPARATOR } from '../../utils/embed.js';
import { getDb } from '../../database/db.js';
import { getServerStatus } from '../../services/fivem/serverService.js';
import { askSnifoxAI, wasLastAskCacheHit } from '../../utils/snifoxAI.js';
import { getAskUsageToday, incrementAskUsage, nextResetLabel } from '../../utils/askQuota.js';

// =======================================================
// Command: !ask
//
// "Asisten" tanya-jawab seputar bot STRONAUT ini sendiri.
// Alur jawaban (2 lapis, BUKAN AI umum yang bebas jawab apa aja):
//
//   1. Rule-based intent matching (selalu jalan duluan) — cocokkan
//      kata kunci ke fungsi tertentu, jawab pakai data real-time
//      (database / FiveM API). Ini paling akurat & gratis.
//
//   2. Kalau intent gak ketemu DAN SNIFOX_API_KEY diisi di .env →
//      fallback ke SnifoxAI (AI Gateway, https://snifoxai.com), dikunci
//      ketat cuma boleh jawab seputar bot ini (lihat utils/snifoxAI.js).
//      Kalau API-nya gagal/timeout, fallback terakhir tetap pesan
//      "gak nemu jawabannya" seperti biasa — bot gak akan crash.
//
//      Quota harian AI (config.ask.dailyLimit, GLOBAL gabungan semua user)
//      HANYA berkurang kalau pertanyaan beneran nyampe ke SnifoxAI di lapis
//      2 — pertanyaan yang udah kejawab di lapis 1 (rule-based, misal
//      "server yang online", "server yang offline", "player di server X")
//      GAK ngurangin quota AI sama sekali.
// =======================================================

const P = config.bot.prefix;

function baseEmbed(title) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(title)
    .setFooter({ text: `${config.bot.name} • v${config.bot.version} • !ask` })
    .setTimestamp();
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Cache regex per keyword biar gak di-compile ulang tiap panggilan.
const keywordRegexCache = new Map();

function getKeywordRegex(kw) {
  let re = keywordRegexCache.get(kw);
  if (!re) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // \b di awal & akhir keyword: cocokkan KATA UTUH (atau frasa utuh buat
    // keyword multi-kata seperti "server online"), bukan sekadar substring.
    // Ini penting karena substring biasa bikin "lag" ke-trigger di dalam
    // kata "lagi", "pelanggan", dst — false positive yang bikin !ask salah
    // rute ke intent yang gak relevan.
    re = new RegExp(`\\b${escaped}\\b`);
    keywordRegexCache.set(kw, re);
  }
  return re;
}

function matchesAny(text, keywords) {
  return keywords.some((kw) => getKeywordRegex(kw).test(text));
}

// ─── Intent: daftar / status server yang online ─────────────────────────────
async function intentServerOnline(message) {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM servers WHERE is_active = 1 ORDER BY name ASC`).all();

  if (!rows.length) {
    return baseEmbed('📡 Server Online Hari Ini')
      .setColor(config.colors.warning)
      .setDescription(
        `${SEPARATOR}\n\n` +
        `Belum ada server yang terdaftar di database bot ini.\n` +
        `Owner/admin bisa tambahkan lewat \`${P}setserver\`, atau kamu bisa ajukan lewat \`${P}requestserver\`.\n\n${SEPARATOR}`
      );
  }

  const results = await Promise.allSettled(
    rows.map((row) => {
      // PENTING: row.alias bisa berisi beberapa alias dipisah koma (mis. "serverkeren,sk").
      // getServerStatus() cuma bisa resolve SATU token alias/nama sekaligus (lihat
      // resolveEndpoint() di services/fivem/serverService.js), jadi harus dipecah dulu
      // dan ambil token pertama — sama seperti pola di allServersMonitorService.js &
      // settextstatusall.js. Kalau langsung dikasih string mentah "serverkeren,sk",
      // resolveEndpoint gagal cocokkan alias-nya dan server keliatan OFFLINE padahal online.
      const input = (row.alias || '').split(',')[0]?.trim() || row.name;
      return getServerStatus(input);
    })
  );

  const statuses = rows.map((row, i) => {
    const r = results[i];
    const status = r.status === 'fulfilled' ? r.value : { online: false };
    return { row, status };
  });

  const totalOnline = statuses.filter((s) => s.status?.online).length;
  const totalPlayers = statuses.reduce((sum, s) => sum + (s.status?.online ? s.status.playerCount : 0), 0);

  const lines = statuses.map(({ row, status }) => {
    if (!status?.online) return `🔴 **${row.name || 'Server'}** — Offline`;
    return `🟢 **${row.name || 'Server'}** — \`${status.playerCount}/${status.maxPlayers}\` players`;
  });

  return baseEmbed('📡 Server Online Hari Ini')
    .setColor(totalOnline > 0 ? config.colors.success : config.colors.danger)
    .setDescription(
      `${SEPARATOR}\n\n` +
      lines.join('\n') +
      `\n\n${SEPARATOR}\n\n` +
      `**${totalOnline}/${statuses.length}** server sedang online • **${totalPlayers}** total player saat ini\n\n` +
      `Mau lihat detail satu server? Coba \`${P}checkstatus <server>\` atau \`${P}serverstatus <server>\`.`
    );
}

// ─── Intent: info command / cara pakai ──────────────────────────────────────
function intentCommandHelp(message, client, rawText) {
  // Cari nama command yang disebut di pertanyaan (misal "cara pakai checkstatus")
  const words = rawText.split(/\s+/).map((w) => w.replace(/^!/, ''));
  let found = null;
  for (const w of words) {
    if (client.commands.has(w)) {
      found = client.commands.get(w);
      break;
    }
  }

  if (found) {
    return baseEmbed(`📖 Command: ${P}${found.name}`)
      .setDescription(
        `${SEPARATOR}\n\n` +
        `**Deskripsi:** ${found.description || 'Tidak ada deskripsi.'}\n` +
        (found.aliases?.length ? `**Alias:** ${found.aliases.map((a) => `\`${P}${a}\``).join(', ')}\n` : '') +
        (found.usage ? `**Cara pakai:** \`${found.usage}\`\n` : '') +
        (found.example ? `**Contoh:** \`${found.example}\`\n` : '') +
        `\n${SEPARATOR}`
      );
  }

  return baseEmbed('📖 Daftar Command')
    .setDescription(
      `${SEPARATOR}\n\n` +
      `Command dasar **${config.bot.name}** gratis untuk semua orang. Fitur bertanda 💎 (mis. \`${P}player\`, \`${P}allplayer\`) khusus server **Premium** — lihat \`${P}help\` → *Fitur Premium*.\n\n` +
      `Ketik \`${P}help\` untuk lihat menu lengkap per kategori (player, server, gaming tools, dll), ` +
      `atau tanya spesifik ke aku, contoh: \`${P}ask cara pakai checkstatus\`.\n\n${SEPARATOR}`
    );
}

// ─── Intent: info umum tentang bot ───────────────────────────────────────────
function intentAbout() {
  return baseEmbed(`🤖 Tentang ${config.bot.name}`)
    .setDescription(
      `${SEPARATOR}\n\n` +
      `**${config.bot.name}** (v${config.bot.version}) adalah bot Discord serba guna untuk komunitas gaming Indonesia — ` +
      `FiveM, SA-MP, Steam, Minecraft, dan lainnya.\n\n` +
      `Prefix bot: \`${P}\`\n` +
      `Command dasar gratis di server manapun bot ini di-invite; fitur 💎 Premium (player, allplayer, loop, dll) khusus server berlangganan.\n\n` +
      `Ketik \`${P}help\` untuk lihat semua command, atau \`${P}ask <pertanyaan>\` buat nanya hal spesifik soal bot ini.\n\n${SEPARATOR}`
    );
}

// ─── Intent: latency / ping ──────────────────────────────────────────────────
function intentPing(client) {
  return baseEmbed('🏓 Latency Bot')
    .setDescription(
      `${SEPARATOR}\n\n` +
      `🌐 **WebSocket:** \`${client.ws.ping}ms\`\n\n` +
      `Mau data lebih lengkap (CPU, RAM, uptime host)? Coba \`${P}ping\`.\n\n${SEPARATOR}`
    );
}

// ─── Intent: prefix ──────────────────────────────────────────────────────────
function intentPrefix() {
  return baseEmbed('🔤 Prefix Bot')
    .setDescription(`${SEPARATOR}\n\nPrefix command bot ini adalah \`${P}\`.\nContoh: \`${P}help\`, \`${P}ping\`, \`${P}checkstatus\`.\n\n${SEPARATOR}`);
}

// ─── Intent: donasi / bayar ──────────────────────────────────────────────────
function intentDonasi() {
  return baseEmbed('☕ Donasi / Support')
    .setDescription(
      `${SEPARATOR}\n\n` +
      `Command dasar **${config.bot.name}** gratis, sedangkan fitur 💎 Premium (player, allplayer, loop, playingtime, ddoscheck, dll) khusus server berlangganan.\n` +
      `Untuk berlangganan atau mendukung pengembangan bot, ketik \`${P}bayar\`.\n\n${SEPARATOR}`
    );
}

// ─── Intent: server list terdaftar ───────────────────────────────────────────
function intentServerList() {
  return baseEmbed('🗂️ Server Terdaftar')
    .setDescription(
      `${SEPARATOR}\n\n` +
      `Ketik \`${P}serverlist\` buat lihat semua server FiveM yang terdaftar di database bot ini (beserta alias-nya).\n` +
      `Mau tanya status onlinenya sekarang? Coba \`${P}ask server yang online hari ini\`.\n\n${SEPARATOR}`
    );
}

// ─── Intent: support server discord ──────────────────────────────────────────
function intentSupport() {
  return baseEmbed('🆘 Support Server')
    .setDescription(`${SEPARATOR}\n\nButuh bantuan manusia? Gabung Support Server: ${config.discord.supportServer}\n\n${SEPARATOR}`);
}

// ─── Ringkasan command asli bot, buat dikasih ke AI sebagai "sumber kebenaran" ──
// Di-cache karena daftar command gak berubah selama bot jalan — jadi gak perlu
// looping ulang client.commands setiap kali ada yang !ask (lebih cepat & ringan).
let cachedBotContext = null;

function buildBotContext(client) {
  if (cachedBotContext) return cachedBotContext;

  const seen = new Set();
  const lines = [`Nama bot: ${config.bot.name} (v${config.bot.version}) — Prefix: ${P}`];

  for (const cmd of client.commands.values()) {
    if (!cmd?.name || seen.has(cmd.name)) continue;
    seen.add(cmd.name);
    lines.push(`- ${P}${cmd.name}${cmd.aliases?.length ? ` (alias: ${cmd.aliases.map((a) => P + a).join(', ')})` : ''}: ${cmd.description || 'tidak ada deskripsi'}${cmd.usage ? ` | Cara pakai: ${cmd.usage}` : ''}`);
  }

  lines.push(`Semua command di atas GRATIS untuk semua orang, tidak ada yang dikunci.`);
  cachedBotContext = lines.join('\n');
  return cachedBotContext;
}

// ─── Router intent ────────────────────────────────────────────────────────────
async function routeIntent(message, client, rawText) {
  const text = normalize(rawText);

  if (matchesAny(text, ['server online', 'server yang online', 'server aktif', 'status semua server', 'server mana yang online', 'ada server online'])) {
    return intentServerOnline(message);
  }

  if (matchesAny(text, ['server list', 'daftar server', 'server terdaftar', 'list server'])) {
    return intentServerList();
  }

  if (matchesAny(text, ['ping', 'latency', 'lag', 'lemot'])) {
    return intentPing(client);
  }

  if (matchesAny(text, ['prefix'])) {
    return intentPrefix();
  }

  if (matchesAny(text, ['donasi', 'donate', 'bayar', 'langganan', 'subscribe', 'traktir'])) {
    return intentDonasi();
  }

  if (matchesAny(text, ['support server', 'bantuan', 'kontak owner', 'hubungi owner', 'gabung discord'])) {
    return intentSupport();
  }

  if (matchesAny(text, ['siapa kamu', 'kamu siapa', 'apa itu stronaut', 'bot ini apa', 'fitur apa saja', 'bisa apa aja', 'kamu bisa apa'])) {
    return intentAbout();
  }

  if (matchesAny(text, ['command', 'perintah', 'cara pakai', 'cara pake', 'gimana pake', 'gimana cara', 'cara gunain', 'help'])) {
    return intentCommandHelp(message, client, text);
  }

  // Kalau nama command disebut langsung (mis. "!ask checkstatus"), tetap coba cocokkan.
  const directMatch = intentCommandHelp(message, client, text);
  const words = text.split(/\s+/);
  if (words.some((w) => client.commands.has(w.replace(/^!/, '')))) {
    return directMatch;
  }

  return null; // fallback
}

export default {
  name: 'ask',
  aliases: ['tanya', 'faq'],
  description: `Tanya apa saja — tentang ${config.bot.name}, FiveM, gaming, coding, atau pertanyaan umum`,
  usage: `${P}ask <pertanyaan>`,
  slashOptions: [
    { name: 'pertanyaan', description: 'Pertanyaan kamu tentang apa saja', required: true },
  ],
  example: `${P}ask server yang online hari ini`,
  cooldown: 5,

  async execute(message, args, client) {
    const question = (args || []).join(' ').trim();

    if (!question) {
      return message.reply({
        embeds: [
          baseEmbed('🤔 Ask STRONAUT')
            .setDescription(
              `${SEPARATOR}\n\n` +
              `Tanya apa saja! Contoh:\n\n` +
              `• \`${P}ask server yang online hari ini\`\n` +
              `• \`${P}ask cara pakai checkstatus\`\n` +
              `• \`${P}ask apa itu ${config.bot.name}\`\n` +
              `• \`${P}ask berapa latency bot\`\n` +
              `• \`${P}ask apa itu FiveM?\`\n` +
              `• \`${P}ask jelaskan cara kerja server FiveM\`\n` +
              `• \`${P}ask apa aja command yang tersedia\`\n\n` +
              `💡 Pertanyaan umum akan dijawab oleh AI selama quota AI masih tersedia.\n\n${SEPARATOR}`
            ),
        ],
      });
    }

    const loading = await message.reply({ content: '🤔 Bentar, lagi mikir...' });

    let embed;
    try {
      embed = await routeIntent(message, client, question);
    } catch (err) {
      embed = baseEmbed('⚠️ Ada Masalah')
        .setColor(config.colors.danger)
        .setDescription(`${SEPARATOR}\n\nGagal memproses pertanyaan: \`${err.message}\`\n\n${SEPARATOR}`);
    }

    // Fallback lapis 2: SnifoxAI — cuma dicoba kalau rule-based gak nemu
    // apa-apa DAN SNIFOX_API_KEY diisi di .env. Pertanyaan yang kejawab
    // rule-based (server online/offline, cara pakai command, dll) TIDAK
    // mengurangi quota AI sama sekali — quota cuma kepotong kalau beneran
    // nyampe ke SnifoxAI di bawah ini.
    if (!embed && config.ai.enabled) {
      const usedSoFar = getAskUsageToday();

      if (usedSoFar >= config.ask.dailyLimit) {
        embed = baseEmbed('⏳ Limit AI Harian Tercapai')
          .setColor(config.colors.warning)
          .setDescription(
            `${SEPARATOR}\n\n` +
            `Fitur AI buat \`${P}ask\` udah dipakai **${config.ask.dailyLimit}x** hari ini (gabungan semua user).\n` +
            `Pertanyaan seputar bot yang bisa dijawab langsung (server online/offline, cara pakai command, dll) tetap jalan normal tanpa batas.\n` +
            `AI reset lagi jam **${nextResetLabel()}**.\n\n${SEPARATOR}`
          );
      } else {
        try {
          const aiReply = await askSnifoxAI(question, buildBotContext(client));
          const usedAfter = wasLastAskCacheHit()
            ? usedSoFar
            : incrementAskUsage();

          if (aiReply) {
           embed = baseEmbed('🤖 Jawaban AI')
  .setDescription(`${SEPARATOR}\n\n${aiReply}\n\n${SEPARATOR}`)
              .setFooter({
                text: `${config.bot.name} • v${config.bot.version} • Dijawab oleh SnifoxAI (${config.ai.model}) • Sisa kuota AI: ${Math.max(config.ask.dailyLimit - usedAfter, 0)}/${config.ask.dailyLimit}`,
              });
          }
        } catch (err) {
          // SnifoxAI down / API key salah / timeout — diam-diam fallback ke
          // pesan default di bawah, jangan bikin command error ke user.
          console.warn(`[ask] SnifoxAI fallback gagal: ${err.message}`);
        }
      }
    }

    if (!embed) {
      embed = baseEmbed('🤷 Gak Nemu Jawabannya')
        .setColor(config.colors.warning)
        .setDescription(
          `${SEPARATOR}\n\n` +
          `Maaf, AI belum bisa menemukan jawaban untuk pertanyaan itu.\n\n` +
          `Coba \`${P}help\` untuk lihat semua command, atau tanya lebih spesifik, contoh:\n` +
          `\`${P}ask server yang online hari ini\`\n\n${SEPARATOR}`
        );
    }

    await loading.edit({ content: null, embeds: [embed] });
  },
};