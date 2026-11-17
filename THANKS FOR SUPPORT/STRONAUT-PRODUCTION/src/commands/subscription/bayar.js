import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { config } from '../../config/config.js';
import { SEPARATOR, createErrorEmbed } from '../../utils/embed.js';
import { getGuildSubscriptionStatus } from '../../utils/subscription.js';
import { getDb } from '../../database/db.js';
import { isPaymentConfigured } from '../../services/payment/pakasir.js';
import { createOrder } from '../../services/payment/premiumPayment.js';
import { getPlans, getPlan, getDefaultPlan, PREMIUM_FEATURES } from '../../utils/premiumPlans.js';

function formatRupiah(n) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

const p = config.bot.prefix;

function featureList() {
  return PREMIUM_FEATURES
    .map((f) => `✅ ${f.cmds.map((c) => `\`${p}${c}\``).join(' & ')} - ${f.desc}`)
    .join('\n') + '\n';
}

function webNote() {
  const url = config.dashboard.siteUrl;
  return url ? `\n🌐 Lebih suka lewat website? Beli / klaim kode di ${url}/premium.html\n` : '';
}

function otherPlansNote(plan) {
  const others = getPlans().filter((x) => x.id !== plan.id);
  if (!others.length) return '';
  return `\n📦 **Paket lain:** ` +
    others.map((x) => `\`${p}bayar ${x.id}\` (${x.days} hari · ${formatRupiah(x.price)})`).join(' • ') + `\n`;
}

function extendNoteFor(guildId) {
  return getGuildSubscriptionStatus(guildId)
    ? `\n> ℹ️ Server ini masih punya subscription aktif — pembayaran ini akan **ditambahkan** dari sisa waktu yang ada.\n`
    : '';
}

// ─── Mode OTOMATIS (Pakasir QRIS dinamis) ────────────────────────────────────
async function executeAuto(message, plan) {
  const durationDays = plan.days;

  let result;
  try {
    result = await createOrder({
      guildId: message.guild.id,
      channelId: message.channel.id,
      userId: message.author.id,
      username: message.author.username,
      plan,
      source: 'discord',
      guildName: message.guild.name,
    });
  } catch (err) {
    console.error('[Bayar] Gagal membuat order:', err);
    return message.reply({
      embeds: [createErrorEmbed('Gagal Membuat Pembayaran', 'Gateway pembayaran sedang bermasalah. Coba lagi sebentar lagi, atau hubungi Owner.')],
    });
  }

  const { order } = result;
  const expiryTs = Math.floor(new Date(order.expires_at).getTime() / 1000);

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('💎 STRONAUT Premium')
    .setDescription(
      `${SEPARATOR}\n\n` +
      `Premium berlaku untuk **seluruh member di server ini** selama **${durationDays} hari**. Command dasar tetap gratis.\n\n` +
      `💰 **Total Bayar**\n${formatRupiah(order.total_pay || order.amount)}\n\n` +
      `🎯 **Fitur Premium**\n${featureList()}\n` +
      `💳 **Cara Bayar (QRIS Otomatis)**\n` +
      `1️⃣ Scan QR di bawah pakai GoPay / OVO / DANA / ShopeePay / Bank apa saja\n` +
      `2️⃣ Bayar **tepat sesuai nominal** di atas\n` +
      `3️⃣ Selesai! Premium aktif **otomatis** dalam beberapa detik 🎉\n` +
      extendNoteFor(message.guild.id) + otherPlansNote(plan) + webNote() + `\n` +
      `⏳ QR berlaku sampai <t:${expiryTs}:R>. Setelah itu ketik \`${p}bayar\` lagi untuk QR baru.\n\n` +
      `${SEPARATOR}`
    )
    .setFooter({ text: `${config.bot.name} • Ref: ${order.reference}` })
    .setTimestamp();

  // Pakasir hanya memberi string QRIS, jadi kita render sendiri jadi gambar PNG.
  const files = [];
  try {
    const { default: QRCode } = await import('qrcode');
    const png = await QRCode.toBuffer(order.qr_string, { width: 512, margin: 2 });
    files.push(new AttachmentBuilder(png, { name: 'qris.png' }));
    embed.setImage('attachment://qris.png');
  } catch (err) {
    console.error('[Bayar] Gagal render QR (npm i qrcode?):', err.message);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cekbayar|${order.merchant_ref}`)
      .setLabel('Cek Pembayaran')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary),
  );
  if (order.checkout_url) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Halaman Bayar')
        .setStyle(ButtonStyle.Link)
        .setURL(order.checkout_url),
    );
  }

  await message.reply({ embeds: [embed], components: [row], files });
}

// ─── Mode MANUAL lama (fallback kalau Pakasir belum diisi di .env) ───────────
async function executeManual(message, plan) {
  if (!config.payment.qrisImageUrl) {
    return message.reply({
      embeds: [createErrorEmbed(
        'Pembayaran Belum Dikonfigurasi',
        `Pembayaran belum di-setup Owner bot.\n` +
        `Owner: isi \`PAKASIR_SLUG\` dan \`PAKASIR_API_KEY\` (otomatis) ` +
        `atau \`QRIS_IMAGE_URL\` (manual) di \`.env\`.`
      )],
    });
  }

  const { price, days: durationDays } = plan;
  const reference = `STRO-${message.guild.id}-${Date.now()}`;

  getDb().prepare(`
    INSERT INTO transactions (reference, merchant_ref, guild_id, channel_id, user_id, amount, duration_days, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'UNPAID')
  `).run(reference, reference, message.guild.id, message.channel.id, message.author.id, price, durationDays);

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('💎 STRONAUT Premium')
    .setDescription(
      `${SEPARATOR}\n\n` +
      `Premium berlaku untuk **seluruh member di server ini** selama **${durationDays} hari**. Command dasar tetap gratis.\n\n` +
      `💰 **Harga**\n${formatRupiah(price)}\n\n` +
      `🎯 **Fitur Premium**\n${featureList()}\n` +
      `💳 **Cara Bayar (QRIS - Manual)**\n` +
      `1️⃣ Scan QR code di bawah pakai GoPay / OVO / DANA / ShopeePay / Bank apa saja\n` +
      `2️⃣ Transfer sesuai nominal yang kamu mau\n` +
      `3️⃣ Klik tombol **Saya Sudah Bayar** di bawah\n` +
      `4️⃣ Owner cek & approve → premium aktif 🎉\n` +
      extendNoteFor(message.guild.id) + `\n` +
      `ℹ️ **Info Penting**\n` +
      `• Konfirmasi dicek **manual oleh Owner**, mohon bersabar sebentar setelah klik "Saya Sudah Bayar".\n` +
      `• Punya kode redeem? Pakai \`${p}redeem <kode>\` (butuh permission Manage Server).\n\n` +
      `${SEPARATOR}`
    )
    .setImage(config.payment.qrisImageUrl)
    .setFooter({ text: `${config.bot.name} • Ref: ${reference}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`konfirmbayar|${reference}`)
      .setLabel('Saya Sudah Bayar')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
  );

  await message.reply({ embeds: [embed], components: [row] });
}

export default {
  name: 'bayar',
  aliases: ['donate', 'donasi', 'qris', 'langganan'],
  description: 'Berlangganan STRONAUT Premium via QRIS (aktif otomatis)',
  usage: `${p}bayar [paket]`,
  slashOptions: [
    { name: 'paket', description: 'ID paket (kosongkan = paket utama)', required: false },
  ],
  example: `${p}bayar\n${p}bayar p90`,
  cooldown: 10,

  async execute(message, args = []) {
    if (!message.guild) {
      return message.reply({
        embeds: [createErrorEmbed('Khusus di Server', 'Command ini cuma bisa dipakai di dalam server Discord, bukan DM.')],
      });
    }

    // Paket sama persis dengan yang dijual di website (utils/premiumPlans.js).
    let plan = getDefaultPlan();
    if (args[0]) {
      plan = getPlan(args[0]);
      if (!plan) {
        const list = getPlans().map((x) => `\`${x.id}\` — ${x.name} (${formatRupiah(x.price)})`).join('\n');
        return message.reply({
          embeds: [createErrorEmbed('Paket Tidak Ditemukan', `Pilihan paket:\n${list}\n\nContoh: \`${p}bayar ${getDefaultPlan().id}\``)],
        });
      }
    }

    return isPaymentConfigured() ? executeAuto(message, plan) : executeManual(message, plan);
  },
};
