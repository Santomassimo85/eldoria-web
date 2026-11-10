export const WORLD_BOSS_TIME_ZONE = "Europe/Rome";
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: WORLD_BOSS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const parts = (ms) => Object.fromEntries(clock.formatToParts(ms).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
function localHour(year, month, day, hour) {
  const target = Date.UTC(year, month - 1, day, hour);
  let ms = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(ms);
    ms += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return ms;
}
export function worldBossNightWindow(now = Date.now()) {
  const p = parts(now);
  const start = localHour(p.year, p.month, p.day, 1);
  const end = localHour(p.year, p.month, p.day, 5);
  const paused = now >= start && now < end;
  if (now < end) return { start, end, paused };
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return {
    start: localHour(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 1),
    end: localHour(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 5), paused: false,
  };
}
export const worldBossNightPaused = (now = Date.now()) => worldBossNightWindow(now).paused;
