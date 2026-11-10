// La stanza vocale ha una vita indipendente dal gruppo della spedizione.
export function voiceRoomDirectory(dungeons = [], saved = []) {
  const rooms = new Map(saved.map((r) => [r.id, r]));
  for (const dungeon of dungeons) {
    rooms.set(dungeon.id, { ...rooms.get(dungeon.id), ...dungeon, dungeonId: dungeon.id });
  }
  return [...rooms.values()].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}
