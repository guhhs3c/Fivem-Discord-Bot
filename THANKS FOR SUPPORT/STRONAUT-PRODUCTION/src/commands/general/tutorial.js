import { EmbedBuilder } from 'discord.js';

// =======================================================
// Command: !tutorial
// Kegunaan: Menampilkan tutorial FiveM berdasarkan kategori
// Contoh pemakaian:
//   !tutorial                 -> menampilkan daftar kategori
//   !tutorial fivem           -> cara install FiveM
//   !tutorial crosshair       -> cara pasang crosshair
//   !tutorial citizen         -> cara pasang Citizen (CitizenFX)
//   !tutorial mods            -> cara pasang mods
// =======================================================

// Data tutorial, silakan ubah/tambah sesuai kebutuhan server kamu
const tutorials = {
  fivem: {
    title: '🎮 Cara Install FiveM',
    color: 0x00b0f4,
    steps: [
      '1. Buka situs resmi **fivem.net** lalu klik tombol **Download**.',
      '2. Jalankan file installer yang sudah di-download.',
      '3. Ikuti proses instalasi sampai selesai (Next > Next > Install).',
      '4. Buka aplikasi **FiveM** setelah instalasi selesai.',
      '5. Tunggu proses update client selesai (biasanya cukup lama saat pertama kali).',
      '6. Setelah selesai, kamu bisa langsung connect ke server FiveM favoritmu.',
    ],
  },
  crosshair: {
    title: '🎯 Cara Pasang Crosshair di FiveM',
    color: 0xff5050,
    steps: [
      '1. Pencet tombol f8 di dalam game FiveM untuk membuka console.',
      '2. ketik (cl_customcrosshair 1;) lalu enter = Untuk menghidupkan crosshair',
      '2. Cari contoh crosshair yg anda inginkan.',
      '3. Lalu copy crosshair tersebut.',
      '4. setelah itu, paste crosshair tersebut ke dalam console server FiveM.',
      '5. lalu enter.',
    ],
  },
  citizen: {
    title: '🧩 Cara Pasang Citizen ',
    color: 0x9b59b6,
    steps: [
      '1. Pastikan FiveM sudah terinstall dengan benar di komputer kamu.',
      '2. Buka folder instalasi FiveM, biasanya di `%localappdata%/FiveM`(atau bisa klick kanan>file location).',
      '3. Pastikan folder `FiveM Application Data`  sudah otomatis terbuat.',
      '4. Jika sudah ,biasanya setiap citizen sudah ter folder,anda tinggal copy paste folder sesuai nama folder tersebut`.',
      '5. sebelum anda paste ,alangkah baiknya di dalate dulu folder yg mau anda paste,jika tidak,bisa di replace saja.',
      '6. Masuk ke server dan cek apakah citizen sudah muncul di dalam game.',
    ],
  },
  mods: {
    title: '🛠️ Cara Pasang Mods di FiveM',
    color: 0x2ecc71,
    steps: [
      '1. Download mod yang ingin dipasang (pastikan sumbernya terpercaya).',
      '2. Extract file mod tersebut.',
      '3. Buka folder instalasi FiveM, biasanya di `%localappdata%/FiveM`(atau bisa klick kanan>file location).',
      '4. Jika belum ada folder ber nama `Mods`, buat folder baru dengan nama `Mods` di dalam secara manual .',
      '5. Jika mod langsung berbentuk folder mods langsung,anda bisa langsung paste saja.',
      '6. Dan Masuk ke server dan cek apakah mod sudah muncul di dalam game.',
    ],
  },
  roleplay: {
    title: '🎭 Cara Bermain Roleplay di FiveM',
    color: 0x3498db,
    steps: [
      '1. **Pahami arti RP** — kamu memerankan karakter fiksi, bukan diri sendiri. Semua tindakan/dialog harus "in-character" (IC).',
      '2. **Buat backstory karakter** — nama, umur, pekerjaan, sifat, latar belakang. Ini membantu kamu konsisten saat roleplay.',
      '3. **Gunakan chat/voice dengan sopan** — jangan pakai bahasa OOC (out of character) di dalam RP kecuali darurat, gunakan `/ooc` atau `/b` (local OOC) untuk itu.',
      '4. **Reaksi harus realistis** — misalnya kalau ditodong senjata, karakefmu wajar takut/nurut, bukan langsung lawan tanpa alasan (menghindari NLR/FailRP).',
      '5. **Gunakan emote & animasi** — perkaya RP dengan `/me` (aksi) dan `/do` (deskripsi keadaan) supaya interaksi lebih hidup.',
      '6. **Ikuti alur cerita server** — banyak server RP Indonesia punya faksi (kepolisian, EMS, geng, dll), pahami peran masing-masing sebelum terlibat.',
      '7. **Selalu update aturan server** — tiap server RP Indonesia (contoh: gaya Malahayati, Erangel RP, dll) bisa punya rules berbeda, cek channel rules/Discord resmi mereka.',
    ],
  },
  rules: {
    title: '📜 Aturan Dasar (Rules) Roleplay FiveM',
    color: 0xe67e22,
    steps: [
      '1. **No FailRP** — dilarang bertindak tidak masuk akal / tidak sesuai realita (contoh: lompat dari gedung tanpa alasan IC).',
      '2. **No RDM (Random Death Match)** — dilarang membunuh/menyerang pemain lain tanpa alasan RP yang jelas.',
      '3. **No VDM (Vehicle Death Match)** — dilarang menabrakkan kendaraan ke pemain lain sebagai alat serang tanpa alasan RP.',
      '4. **NLR (New Life Rule)** — setelah karakter "mati"/respawn, kamu tidak boleh mengingat kejadian sebelum kematian tersebut.',
      '5. **No Metagaming** — dilarang memakai informasi dari luar RP (misal dari Discord/voice chat lain) untuk keuntungan IC.',
      '6. **No Powergaming** — dilarang memaksakan aksi ke pemain lain tanpa memberi kesempatan mereka bereaksi (contoh: `/me mengikat tanganmu` tanpa persetujuan/skill check).',
      '7. **Hormati Staff & Sesama Player** — dilarang toxic, SARA, atau spam di chat manapun (IC/OOC).',
      '8. **Ikuti prosedur faksi** — jika bermain sebagai polisi/EMS/geng, ikuti SOP yang berlaku di server tersebut.',
      '⚠️ Catatan: rules di atas adalah standar umum komunitas FiveM RP. Selalu cek ulang rules resmi di server yang kamu mainkan karena bisa berbeda-beda.',
    ],
  },
  goodside: {
    title: '🟢 Cara Crafting Goodside (Legal)',
    color: 0x2ecc71,
    steps: [
      '1. Pilih pekerjaan legal di server (contoh: tukang kayu, nelayan, petani, tambang, mekanik).',
      '2. Datangi lokasi crafting/workbench yang biasanya ditandai marker khusus di map (cek `/joblist` atau tanya di Discord server).',
      '3. Kumpulkan bahan mentah sesuai job (misal kayu, batu, ikan, hasil tambang) dengan cara farming di lokasi yang ditentukan.',
      '4. Bawa bahan mentah ke tempat pengolahan/crafting station goodside.',
      '5. Ikuti minigame/skill check yang muncul (biasanya tekan tombol sesuai instruksi di layar).',
      '6. Barang hasil crafting bisa dijual ke NPC/toko resmi atau pemain lain untuk mendapatkan uang legal (whitemoney).',
      '7. Tingkatkan level job kamu secara bertahap agar bisa craft item goodside yang lebih menguntungkan.',
    ],
  },
  badside: {
    title: '🔴 Cara Crafting Badside (Ilegal)',
    color: 0xc0392b,
    steps: [
      '1. Pahami risiko RP: aktivitas badside (misalnya crafting barang ilegal) bisa berujung dikejar kepolisian dalam RP — ini bagian dari cerita, bukan cheat.',
      '2. Cari lokasi rahasia/hidden crafting spot yang biasa dipakai geng ilegal di server (biasanya tersembunyi, jauh dari kota).',
      '3. Kumpulkan bahan baku ilegal sesuai jenis crafting (contoh: bahan kimia untuk item terlarang, part senjata, dsb) sesuai script server masing-masing.',
      '4. Gunakan crafting table/proses khusus di lokasi tersebut, biasanya butuh waktu proses dan berisiko tertangkap polisi RP.',
      '5. Selalu siapkan "cover story" IC jika ada patroli kepolisian datang — ini bagian dari RP, bukan untuk menghindari konsekuensi asli.',
      '6. Hasil crafting badside biasanya dijual lewat jalur RP tersembunyi (dealer, buyer NPC, atau pemain lain) untuk mendapat uang ilegal (blackmoney/dirty money).',
      '⚠️ Catatan: konten badside di sini murni konteks role-play fiksi dalam game FiveM, bukan panduan aktivitas ilegal di dunia nyata. Detail teknis (item/command spesifik) berbeda-beda tiap server, cek panduan job resmi servernya.',
    ],
  },
  kerja: {
    title: '💼 Cara Bekerja (Job) di Roleplay FiveM',
    color: 0xf39c12,
    steps: [
      '1. Buka menu job biasanya dengan perintah `/job`, `/duty`, atau lewat NPC/marker tertentu di map.',
      '2. Pilih job yang sesuai minat karaktermu: legal (goodside) seperti taxi, delivery, tambang, atau job faksi seperti polisi/EMS.',
      '3. Untuk job faksi (polisi, EMS, mekanik resmi), biasanya perlu whitelist/seleksi terlebih dahulu — cek Discord server untuk cara daftar.',
      '4. Setelah "on duty", ikuti tugas yang diberikan (misal antar penumpang, tangani laporan darurat, perbaiki kendaraan pemain).',
      '5. Selesaikan tugas dengan roleplay yang natural, bukan asal klik — ini yang membedakan RP server dari server biasa.',
      '6. Dapatkan gaji dari hasil kerja (biasanya otomatis masuk ke bank karakter setelah selesai duty atau per tugas selesai).',
      '7. Naikkan rank/level pekerjaan seiring waktu untuk membuka akses tugas dan penghasilan yang lebih besar.',
    ],
  },

paspor: {
    title: '📋 Cara Memasang Paspor di Roleplay FiveM',
    color: 0xf39c12,
    steps: [
      '1. Buka fivem terlebih dahulu',
      '2. Lalu cari bagian pojok kanan atas bergambar gear.',
      '3. lalu klik pada bagian "Player Name" di bagian bawah account.',
      '4. Setelah itu pastikan paspor yg anda gunakan sesuai dengan fraksi yg anda ikuti, jika tidak sesuai maka paspor tidak akan sesuai dan terjadi miskomunikasi ke admin.',
      '5. Paspor bisa tanyakan ke petinggi fraksi atau admin server, jika paspor tidak sesuai maka akan di tolak.',
      '6. Contoh paspor EMS-(nama) atau POLICE-(nama) atau GANG-(nama) sesuai fraksi yg diikuti.',
      '7. Jika sudah sesuai maka paspor akan diterima dan bisa digunakan untuk keperluan roleplay.',
    ],
  },
};

export default {
  name: 'tutorial',
  description: 'Menampilkan tutorial seputar FiveM (fivem, crosshair, citizen, mods,paspor, roleplay, rules, goodside, badside, kerja)',
  slashOptions: [
    { name: 'kategori', description: 'Kategori tutorial (kosongkan untuk lihat daftar)', required: false },
  ],
  async execute(message, args) {
    const kategori = args[0]?.toLowerCase();

    // Jika tidak ada kategori, tampilkan daftar kategori yang tersedia
    if (!kategori) {
      const listEmbed = new EmbedBuilder()
        .setTitle('📚 Daftar Tutorial FiveM')
        .setDescription(
          'Gunakan `!tutorial <kategori>` untuk melihat tutorialnya.\n\n' +
          '**⚙️ Instalasi:**\n' +
          '`fivem` — Cara install FiveM\n' +
          '`crosshair` — Cara pasang crosshair\n' +
          '`citizen` — Cara pasang Citizen\n' +
          '`mods` — Cara pasang mods\n\n' +
          '**🎭 Roleplay:**\n' +
          '`roleplay` — Cara bermain roleplay\n' +
          '`rules` — Aturan dasar RP\n' +
          '`goodside` — Cara crafting goodside (legal)\n' +
          '`badside` — Cara crafting badside (ilegal)\n' +
          '`kerja` — Cara bekerja (job) dalam RP\n' +
          '`paspor` — memasang paspor sesuai fraksi yg di ikuti\n' +
          'Contoh: `!tutorial roleplay`'
        )
        .setColor(0xf1c40f)
        .setFooter({ text: 'Tutorial Bot • FiveM Help' });

      return message.reply({ embeds: [listEmbed] });
    }

    const data = tutorials[kategori];

    if (!data) {
      return message.reply(
        `❌ Kategori \`${kategori}\` tidak ditemukan.\n` +
        `Kategori yang tersedia: \`fivem\`, \`crosshair\`, \`citizen\`, \`mods\`, \`roleplay\`, \`rules\`, \`goodside\`, \`badside\`, \`kerja\`.\n` +
        `Ketik \`!tutorial\` untuk melihat daftar lengkapnya.`
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(data.title)
      .setDescription(data.steps.join('\n'))
      .setColor(data.color)
      .setFooter({ text: 'Tutorial Bot • FiveM Help' });

    return message.reply({ embeds: [embed] });
  },
};
