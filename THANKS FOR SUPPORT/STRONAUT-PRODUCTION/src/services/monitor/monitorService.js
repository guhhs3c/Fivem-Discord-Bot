import { getServerStatus } from '../fivem/serverService.js';
import { createMonitorEmbed } from '../../utils/embed.js';
import { getDb } from '../../database/db.js';

// monitorId -> setInterval handle
const activeMonitors = new Map();

export function getActiveMonitors() {
  return activeMonitors;
}

function deactivateInDb(monitorId) {
  try {
    getDb().prepare(`UPDATE monitors SET is_active = 0 WHERE id = ?`).run(monitorId);
  } catch {
    // ignore
  }
}

async function tick(client, monitor) {
  try {
    const channel = await client.channels.fetch(monitor.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased?.()) {
      stopMonitor(monitor.id);
      return;
    }

    const message = await channel.messages.fetch(monitor.message_id).catch(() => null);
    if (!message) {
      // Pesan monitor sudah dihapus manual di Discord — hentikan loop-nya.
      stopMonitor(monitor.id);
      return;
    }

    const status = await getServerStatus(monitor.server_input);
    const embed = createMonitorEmbed(status, monitor.server_input, monitor.interval_sec);
    await message.edit({ embeds: [embed] });
  } catch (err) {
    console.error(`[Monitor #${monitor.id}] Gagal update:`, err.message);
  }
}

/**
 * Mulai (atau restart) interval edit-pesan untuk satu monitor.
 * monitor: { id, channel_id, message_id, server_input, interval_sec }
 */
export function startMonitor(client, monitor) {
  if (activeMonitors.has(monitor.id)) {
    clearInterval(activeMonitors.get(monitor.id));
  }
  const timer = setInterval(() => tick(client, monitor), monitor.interval_sec * 1000);
  activeMonitors.set(monitor.id, timer);
}

export function stopMonitor(monitorId) {
  if (activeMonitors.has(monitorId)) {
    clearInterval(activeMonitors.get(monitorId));
    activeMonitors.delete(monitorId);
  }
  deactivateInDb(monitorId);
}

/**
 * Dipanggil sekali saat bot boot — lanjutkan semua monitor yang masih aktif di DB
 * (misalnya setelah restart) supaya pesan yang sama tetap ke-update, bukan bikin pesan baru.
 */
export async function resumeAllMonitors(client) {
  try {
    const rows = getDb().prepare(`SELECT * FROM monitors WHERE is_active = 1`).all();
    for (const row of rows) {
      startMonitor(client, row);
    }
    if (rows.length) {
      console.log(`[Monitor] Melanjutkan ${rows.length} live monitor aktif`);
    }
  } catch (err) {
    console.error('[Monitor] Gagal resume monitors:', err.message);
  }
}
