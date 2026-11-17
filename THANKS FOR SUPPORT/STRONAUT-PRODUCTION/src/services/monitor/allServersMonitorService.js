import { getServerStatus } from '../fivem/serverService.js';
import { createAllServersMonitorEmbed } from '../../utils/embed.js';
import { getDb } from '../../database/db.js';

// monitorId -> setInterval handle
const activeAllServersMonitors = new Map();

export function getActiveAllServersMonitors() {
  return activeAllServersMonitors;
}

function deactivateInDb(monitorId) {
  try {
    getDb().prepare(`UPDATE all_servers_monitors SET is_active = 0 WHERE id = ?`).run(monitorId);
  } catch {
    // ignore
  }
}

async function fetchAllStatuses() {
  const rows = getDb().prepare(`SELECT * FROM servers WHERE is_active = 1 ORDER BY name ASC`).all();

  const results = await Promise.allSettled(
    rows.map((row) => {
      const input = (row.alias || '').split(',')[0]?.trim() || row.name;
      return getServerStatus(input);
    })
  );

  return rows.map((row, i) => ({
    row,
    status: results[i].status === 'fulfilled' ? results[i].value : null,
  }));
}

async function tick(client, monitor) {
  try {
    const channel = await client.channels.fetch(monitor.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased?.()) {
      stopAllServersMonitor(monitor.id);
      return;
    }

    const message = await channel.messages.fetch(monitor.message_id).catch(() => null);
    if (!message) {
      // Pesan monitor sudah dihapus manual di Discord — hentikan loop-nya.
      stopAllServersMonitor(monitor.id);
      return;
    }

    const statuses = await fetchAllStatuses();
    const embed = createAllServersMonitorEmbed(statuses, monitor.interval_sec);
    await message.edit({ embeds: [embed] });
  } catch (err) {
    console.error(`[AllServersMonitor #${monitor.id}] Gagal update:`, err.message);
  }
}

/**
 * Mulai (atau restart) interval edit-pesan untuk monitor "semua server".
 * monitor: { id, channel_id, message_id, interval_sec }
 */
export function startAllServersMonitor(client, monitor) {
  if (activeAllServersMonitors.has(monitor.id)) {
    clearInterval(activeAllServersMonitors.get(monitor.id));
  }
  const timer = setInterval(() => tick(client, monitor), monitor.interval_sec * 1000);
  activeAllServersMonitors.set(monitor.id, timer);
}

export function stopAllServersMonitor(monitorId) {
  if (activeAllServersMonitors.has(monitorId)) {
    clearInterval(activeAllServersMonitors.get(monitorId));
    activeAllServersMonitors.delete(monitorId);
  }
  deactivateInDb(monitorId);
}

/**
 * Dipanggil sekali saat bot boot — lanjutkan semua monitor "semua server"
 * yang masih aktif di DB (misalnya setelah restart).
 */
export async function resumeAllServersMonitors(client) {
  try {
    const rows = getDb().prepare(`SELECT * FROM all_servers_monitors WHERE is_active = 1`).all();
    for (const row of rows) {
      startAllServersMonitor(client, row);
    }
    if (rows.length) {
      console.log(`[AllServersMonitor] Melanjutkan ${rows.length} monitor aktif`);
    }
  } catch (err) {
    console.error('[AllServersMonitor] Gagal resume monitors:', err.message);
  }
}