// =======================================================
// Helper bersama untuk command DM: !dm, !dmall, !dmglobal
// -------------------------------------------------------
// - parse mention/ID user & role dari args
// - embed DM yang seragam (ada keterangan kenapa user menerima pesan)
// - pengirim DM massal: ada jeda, konfirmasi, tombol Stop, dan berhenti
//   otomatis kalau Discord mulai menolak berturut-turut (tanda kena limit).
// =======================================================
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { config } from '../config/config.js';

export const DM_DELAY_MS = 3000; // jeda antar DM
const MAX_CONSECUTIVE_FAIL = 5; // berhenti kalau gagal beruntun segini kali
const CONFIRM_TIMEOUT_MS = 60_000;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** "<@123>", "<@!123>" atau "123" -> "123" (selain itu null) */
export function parseUserId(token = '') {
  const m = String(token).match(/^<@!?(\d{15,25})>$/) || String(token).match(/^(\d{15,25})$/);
  return m ? m[1] : null;
}

/** "<@&123>" atau "123" -> "123" (selain itu null) */
export function parseRoleId(token = '') {
  const m = String(token).match(/^<@&(\d{15,25})>$/) || String(token).match(/^(\d{15,25})$/);
  return m ? m[1] : null;
}

/** Ambil "--role <x>" dari args. Return { args: sisa args, roleToken } */
export function extractRoleFlag(args) {
  const rest = [...args];
  const i = rest.findIndex((a) => a.toLowerCase() === '--role');
  if (i === -1) return { args: rest, roleToken: null };
  const roleToken = rest[i + 1] ?? null;
  rest.splice(i, roleToken ? 2 : 1);
  return { args: rest, roleToken };
}

export function isOwner(userId) {
  return Boolean(config.discord.ownerId) && userId === config.discord.ownerId;
}

export function buildDmEmbed(text, footerText) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setAuthor({ name: `📩 ${config.bot.name} — Pesan` })
    .setDescription(text)
    .setFooter({ text: footerText })
    .setTimestamp();
}

/** Kirim 1 DM. Return 'ok' | 'ditutup' | 'gagal' */
export async function sendOneDm(user, embed) {
  try {
    await user.send({ embeds: [embed] });
    return 'ok';
  } catch (err) {
    if (err.code === 50007) return 'ditutup'; // user menutup DM / blokir bot
    console.error(`[DM] gagal ke ${user.tag ?? user.id}: ${err.message} (code ${err.code})`);
    return 'gagal';
  }
}

/**
 * Alur DM massal lengkap: konfirmasi -> kirim dengan jeda -> laporan.
 *
 * @param {object} p
 * @param {object} p.message   message / shim slash dari command
 * @param {Array}  p.users     array GuildMember atau User (sudah difilter, tanpa bot)
 * @param {object} p.embed     embed yang dikirim ke tiap user
 * @param {string} p.scopeText contoh: "member server ini" / "user unik dari 3 server"
 * @param {string} p.customKey kunci unik untuk customId tombol
 */
export async function runBulkDm({ message, users, embed, scopeText, customKey }) {
  const estMenit = Math.max(1, Math.ceil((users.length * DM_DELAY_MS) / 60000));
  const idYa = `dmbulk_ya_${customKey}`;
  const idBatal = `dmbulk_batal_${customKey}`;
  const idStop = `dmbulk_stop_${customKey}`;

  const rowKonfirmasi = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(idYa).setLabel('Kirim').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(idBatal).setLabel('Batal').setStyle(ButtonStyle.Secondary)
  );

  const status = await message.reply({
    content:
      `Akan mengirim DM ke **${users.length}** ${scopeText}.\n` +
      `Estimasi ±${estMenit} menit. Jangan restart bot selama proses berjalan.\n\n**Pratinjau:**`,
    embeds: [embed],
    components: [rowKonfirmasi],
  });

  let klik;
  try {
    klik = await status.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === message.author.id && [idYa, idBatal].includes(i.customId),
      time: CONFIRM_TIMEOUT_MS,
    });
  } catch {
    return status.edit({ content: '⏱️ Waktu konfirmasi habis, dibatalkan.', embeds: [], components: [] });
  }

  if (klik.customId === idBatal) {
    return klik.update({ content: '🚫 Dibatalkan.', embeds: [], components: [] });
  }

  const rowStop = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(idStop).setLabel('Stop').setStyle(ButtonStyle.Danger)
  );
  await klik.update({ content: '🚀 Mulai mengirim...', embeds: [], components: [rowStop] });

  let berhenti = false;
  let alasanBerhenti = 'Dihentikan.';
  const kolektor = status.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === message.author.id && i.customId === idStop,
  });
  kolektor.on('collect', async (i) => {
    berhenti = true;
    await i.deferUpdate().catch(() => {});
  });

  const stat = { ok: 0, ditutup: 0, gagal: 0 };
  let diproses = 0;
  let gagalBeruntun = 0;

  for (const target of users) {
    if (berhenti) break;

    const user = target.user ?? target; // GuildMember -> User
    const hasil = await sendOneDm(user, embed);
    stat[hasil]++;
    diproses++;

    // "ditutup" itu normal; "gagal" beruntun = kemungkinan kena limit Discord
    gagalBeruntun = hasil === 'gagal' ? gagalBeruntun + 1 : 0;
    if (gagalBeruntun >= MAX_CONSECUTIVE_FAIL) {
      berhenti = true;
      alasanBerhenti = `⚠️ Dihentikan otomatis: ${MAX_CONSECUTIVE_FAIL} DM gagal berturut-turut (kemungkinan kena rate limit Discord). Tunggu beberapa jam sebelum mencoba lagi.`;
      break;
    }

    if (diproses % 10 === 0) {
      // pakai status.edit (bukan editReply) supaya tetap jalan > 15 menit
      await status
        .edit({
          content: `📤 Progres: ${diproses}/${users.length} (✅ ${stat.ok} • 🔒 ${stat.ditutup} • ❌ ${stat.gagal})`,
          components: [rowStop],
        })
        .catch(() => {});
    }
    await sleep(DM_DELAY_MS);
  }

  kolektor.stop();
  return status
    .edit({
      content:
        `${berhenti ? alasanBerhenti : '✅ Selesai!'}\n` +
        `• Terkirim: **${stat.ok}**\n` +
        `• DM ditutup: **${stat.ditutup}**\n` +
        `• Gagal: **${stat.gagal}**\n` +
        `• Diproses: **${diproses}/${users.length}**`,
      components: [],
    })
    .catch(() => {});
}
