import { getServerStatus } from './serverService.js';

/**
 * Find players by name (fuzzy match).
 */
export async function findPlayerByName(serverInput, nama) {
  const status = await getServerStatus(serverInput);
  if (!status.online) throw new Error(`Server offline atau tidak bisa diakses`);

  const query = nama.toLowerCase();
  const found = status.players.filter(p =>
    p.name && p.name.toLowerCase().includes(query)
  );

  return {
    found,
    serverData: status.serverData,
    endpoint: status.endpoint,
    dbRow: status.dbRow,
  };
}

/**
 * Find a player by server ID.
 */
export async function findPlayerById(serverInput, id) {
  const status = await getServerStatus(serverInput);
  if (!status.online) throw new Error(`Server offline atau tidak bisa diakses`);

  const numId = parseInt(id);
  const player = status.players.find(p => p.id === numId);

  return {
    player: player || null,
    serverData: status.serverData,
    endpoint: status.endpoint,
    dbRow: status.dbRow,
  };
}

/**
 * Get all players from a server.
 */
export async function getAllPlayers(serverInput) {
  const status = await getServerStatus(serverInput);
  if (!status.online) throw new Error(`Server offline atau tidak bisa diakses`);

  return {
    players: status.players,
    serverData: status.serverData,
    endpoint: status.endpoint,
    dbRow: status.dbRow,
  };
}
