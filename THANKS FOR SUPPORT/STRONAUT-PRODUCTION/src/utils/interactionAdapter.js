// =======================================================
// Interaction → "Message-like" adapter
// -------------------------------------------------------
// Semua command lama ditulis dengan signature:
//     execute(message, args, client)
// Supaya SEMUA command otomatis bisa dipakai lewat slash
// command tanpa perlu ditulis ulang satu-satu, kita bungkus
// ChatInputCommandInteraction jadi object yang punya method
// & properti seperti Message (reply, author, member, guild,
// channel, delete, dst).
// =======================================================

/**
 * Bangun array `args` (string[]) dari options slash command,
 * meniru cara prefix command split string dengan spasi supaya
 * command lama (args[0], args.join(' '), dst) tetap jalan tanpa
 * perlu ditulis ulang.
 *
 * Tiap item `slashOptions` bisa punya:
 *   - name      : nama option di Discord
 *   - flag      : kalau diisi, value dikirim sebagai `--flag <value>`
 *                 (buat command lama yang parsing flag CLI, mis. fivem-market)
 *   - boolFlag  : kalau true, value "ya" cuma nambahin `--flag` tanpa value
 */
export function buildArgsFromInteraction(interaction, slashOptions = []) {
  const args = [];
  for (const opt of slashOptions) {
    const value = interaction.options.get(opt.name)?.value;
    if (value === undefined || value === null || value === '') continue;

    if (opt.boolFlag) {
      if (String(value).toLowerCase() === 'ya') args.push(`--${opt.flag || opt.name}`);
      continue;
    }

    if (opt.flag) args.push(`--${opt.flag}`);

    String(value)
      .trim()
      .split(/\s+/)
      .forEach((token) => args.push(token));
  }
  return args;
}

/**
 * Bungkus ChatInputCommandInteraction jadi shim mirip Message.
 * `deferred` = true kalau interaction sudah di-deferReply() sebelumnya.
 */
export function createMessageShim(interaction) {
  let firstReplySent = interaction.replied || interaction.deferred;

  const shim = {
    // properti umum yang dipakai command lama
    isSlash: true,
    author: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    guildId: interaction.guildId,
    channel: interaction.channel,
    channelId: interaction.channelId,
    client: interaction.client,
    content: '',
    id: interaction.id,
    createdTimestamp: interaction.createdTimestamp,

    // message.reply({...}) / message.reply('text')
    async reply(options) {
      const payload = typeof options === 'string' ? { content: options } : { ...options };

      if (interaction.deferred || interaction.replied || firstReplySent) {
        firstReplySent = true;
        return interaction.editReply(payload);
      }

      firstReplySent = true;
      await interaction.reply({ ...payload, fetchReply: true });
      return interaction.fetchReply();
    },

    // Beberapa command panggil message.delete() setelah selesai
    // (misalnya buat hapus pesan trigger). Untuk slash command
    // tidak ada "pesan trigger" yang perlu dihapus, jadi no-op aman.
    async delete() {
      return null;
    },
  };

  return shim;
}
