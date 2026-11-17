import { EmbedBuilder } from 'discord.js';
import { config } from '../../config/config.js';
import { SEPARATOR } from '../../utils/embed.js';

// =======================================================
// Command: !kbbr
// KBR / Kamus Bahasa Roleplay
// =======================================================

const kbbr = [
  { istilah: 'Boneka', arti: 'Character/karakter kita di dalam game.', aliases: ['Character'] },
  { istilah: 'Tidur', arti: 'OFF — istilah untuk saat kita tidak aktif.', aliases: ['Off'] },
  { istilah: 'Bangun', arti: 'Bangun — istilah untuk saat kita online.', aliases: ['On'] },
  { istilah: 'Kampung', arti: 'Kota sebelumnya — istilah untuk menyebut server yang dimainkan sebelumnya.', aliases: ['kampung'] },
  { istilah: 'Lapor Dewa', arti: 'Melapor ke Admin/Owner server (di luar peran IC).', aliases: ['dewa'] },
  { istilah: 'Cuci Muka', arti: 'Relog / keluar-masuk game lagi.', aliases: ['cumuk'] },
  { istilah: 'Ngedrone/ngevlog', arti: 'Streaming — istilah jika sedang streaming.', aliases: ['LiveStreaming'] },
  { istilah: 'Paspor', arti: 'Username CFX.RE — istilah untuk display name.', aliases: ['pencet'] },
  { istilah: 'Skincare', arti: 'PED — istilah untuk Ped custom.', aliases: ['PED'] },
  { istilah: 'Import', arti: 'Donasi — istilah untuk menyebut saat melakukan donasi.', aliases: ['Donasi'] },
  { istilah: 'Kedip', arti: 'Render ulang (re-render).', aliases: ['render'] },
  { istilah: 'Kesantet', arti: 'CRASH — istilah untuk crash.', aliases: ['crash'] },
  { istilah: 'Kuping', arti: 'Headset — istilah untuk headset.', aliases: ['Headset'] },
  { istilah: 'Tenggorokan', arti: 'Mic — istilah untuk mic.', aliases: ['Mic'] },
  { istilah: 'Batuk', arti: 'Fix MIC.', aliases: ['fix mic'] },
  { istilah: 'Kedipan', arti: 'FPS (Frame Per Second).', aliases: ['fps'] },
  { istilah: 'Pelangi', arti: 'Packet Loss — koneksi internet putus-putus.', aliases: ['pl', 'packet loss'] },
  { istilah: 'Kota Badai', arti: 'Server sedang maintenance/restart.', aliases: ['maintenance', 'restart'] },
  { istilah: 'Otak Besar', arti: 'Player yang menggunakan PC.', aliases: ['pc'] },
  { istilah: 'Otak Kecil', arti: 'Player yang menggunakan laptop.', aliases: ['laptop'] },
  { istilah: 'Kantong', arti: 'ID player.', aliases: ['id'] },
  { istilah: 'Keluar Kota', arti: 'Keluar dari game/server.', aliases: ['logout'] },
  { istilah: 'Masuk Kota', arti: 'Masuk ke dalam game/server.', aliases: ['login'] },
  { istilah: 'AFK', arti: 'Melamun (Away From Keyboard).', aliases: [] },
  { istilah: 'Berat', arti: 'Ngelag / FPS drop.', aliases: ['lag'] },
  { istilah: 'Website', arti: 'Discord.', aliases: ['discord'] },
  { istilah: 'Di Atas', arti: 'Di OOC (Out of Character).', aliases: ['ooc'] },
  { istilah: 'Sir', arti: 'Panggilan untuk karakter laki-laki (Pak/Bang/Mas).', aliases: ['cewek'] },
  { istilah: 'Mem', arti: 'Panggilan untuk karakter perempuan (Buk/Mbak/Kak).', aliases: ['cowok'] },
  { istilah: 'Tompel', arti: 'Tulisan "NEW" yang muncul di atas kepala karakter baru.', aliases: ['new tag'] },
  { istilah: 'Keram', arti: 'Kondisi belum bisa menggunakan senjata.', aliases: [] },
  { istilah: 'Boren', arti: 'Bocah Kemaren — orang yang baru bermain roleplay dan cenderung rusuh.', aliases: ['bocah kemaren'] },
  { istilah: 'Kaca Mata', arti: 'Grafik/settingan visual game.', aliases: ['grafik'] },
  { istilah: 'Mikir', arti: 'Sedang ngerender (loading tampilan).', aliases: ['ngerender'] },
  { istilah: 'Bug', arti: 'Kumbang — istilah becandaan untuk error/glitch dalam game.', aliases: ['BUG'] },
  { istilah: 'Emot', arti: 'Mantra — istilah untuk ekspresi emosional dalam game.', aliases: ['Mantra'] },
  { istilah: 'Otot', arti: 'Memencet — istilah untuk memencet tombol.', aliases: ['pencet'] },
  { istilah: 'Cheater', arti: 'Alien — istilah untuk cheater.', aliases: ['alien'] },
  { istilah: 'Otot Mata', arti: 'ALT — istilah untuk pencet tombol ALT.', aliases: ['ALT'] },
  { istilah: 'Tikus', arti: 'Mouse — istilah untuk mouse.', aliases: ['Mouse'] },
];

const COLOR = 0x9b59b6;

function cariIstilah(query) {
  const q = query.toLowerCase().trim();

  return kbbr.find((item) => {
    const istilah = item.istilah.toLowerCase();

    return (
      istilah === q ||
      item.aliases.some((alias) => alias.toLowerCase() === q) ||
      istilah.includes(q)
    );
  });
}

function footerText(extra) {
  return `${config.bot.name} • v${config.bot.version}${extra ? ` • ${extra}` : ''}`;
}

export default {
  name: 'kbbr',
  description: 'KBBR (Kamus Besar Bahasa Roleplay) - istilah gaul roleplay FiveM',
  slashOptions: [
    { name: 'istilah', description: 'Istilah yang mau dicari (kosongkan untuk lihat semua)', required: false },
  ],

  async execute(message, args) {
    const query = args.join(' ').trim();

    // ===================================================
    // TANPA ARGUMEN — daftar lengkap, dipecah per halaman
    // ===================================================
    if (!query) {
      const chunks = [];
      let current = '';

      for (const item of kbbr) {
        const alias = item.aliases.length
          ? `\n> 🏷️ ${item.aliases.map((a) => `\`${a}\``).join(' • ')}`
          : '';
        const line = `**${item.istilah}**\n> ${item.arti}${alias}`;

        if ((current + '\n\n' + line).length > 3500) {
          if (current) chunks.push(current);
          current = line;
        } else {
          current = current ? `${current}\n\n${line}` : line;
        }
      }
      if (current) chunks.push(current);

      const embeds = chunks.map((chunk, index) => {
        const embed = new EmbedBuilder()
          .setColor(COLOR)
          .setTitle(index === 0 ? '📖 KBBR — Kamus Bahasa Roleplay' : `📖 KBBR — Halaman ${index + 1}/${chunks.length}`)
          .setDescription(`${SEPARATOR}\n\n${chunk}\n\n${SEPARATOR}`)
          .setFooter({ text: footerText(`Halaman ${index + 1}/${chunks.length} • ${kbbr.length} istilah`) })
          .setTimestamp();

        if (index === 0) {
          embed.setAuthor({ name: '📚 Kamus Besar Bahasa Roleplay' });
          embed.addFields({
            name: '💡 Cara Pakai',
            value:
              '`/kbbr istilah:<kata>` atau `!kbbr <kata>` untuk cari arti spesifik.\n' +
              'Contoh: `!kbbr boneka` atau `!kbbr cumuk`',
          });
        }
        if (index === chunks.length - 1) {
          embed.addFields({ name: '🔎 Tips', value: 'Kamu juga bisa mencari pakai alias/singkatan istilahnya.' });
        }

        return embed;
      });

      return message.reply({ embeds });
    }

    // ===================================================
    // PENCARIAN ISTILAH
    // ===================================================
    const hasil = cariIstilah(query);

    if (!hasil) {
      const embedTidakDitemukan = new EmbedBuilder()
        .setColor(config.colors.danger)
        .setTitle('❌ Istilah Tidak Ditemukan')
        .setDescription(`${SEPARATOR}\n\nIstilah **\`${query}\`** tidak ada di KBBR.\n\n${SEPARATOR}`)
        .addFields(
          { name: '📖 Lihat Semua Istilah', value: 'Gunakan `/kbbr` atau `!kbbr` tanpa argumen.' },
          { name: '💡 Contoh Pencarian', value: '`!kbbr boneka`\n`!kbbr cumuk`\n`!kbbr bug`' },
        )
        .setFooter({ text: footerText('KBBR') })
        .setTimestamp();

      return message.reply({ embeds: [embedTidakDitemukan] });
    }

    // ===================================================
    // HASIL PENCARIAN
    // ===================================================
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setAuthor({ name: '📖 KBBR — Kamus Bahasa Roleplay' })
      .setTitle(hasil.istilah)
      .setDescription(`${SEPARATOR}\n\n> ${hasil.arti}\n\n${SEPARATOR}`)
      .setFooter({ text: footerText('KBBR') })
      .setTimestamp();

    if (hasil.aliases.length) {
      embed.addFields({ name: '🏷️ Alias / Singkatan', value: hasil.aliases.map((a) => `\`${a}\``).join(' • '), inline: true });
    }
    embed.addFields({ name: '🔍 Cara Mencari', value: `\`!kbbr ${hasil.istilah}\``, inline: true });

    return message.reply({ embeds: [embed] });
  },
};