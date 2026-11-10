var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/data/worldBossSchedule.js
var worldBossSchedule_exports = {};
__export(worldBossSchedule_exports, {
  WORLD_BOSS_TIME_ZONE: () => WORLD_BOSS_TIME_ZONE,
  worldBossNightPaused: () => worldBossNightPaused,
  worldBossNightWindow: () => worldBossNightWindow
});
module.exports = __toCommonJS(worldBossSchedule_exports);
var WORLD_BOSS_TIME_ZONE = "Europe/Rome";
var clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: WORLD_BOSS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});
var parts = (ms) => Object.fromEntries(clock.formatToParts(ms).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
function localHour(year, month, day, hour) {
  const target = Date.UTC(year, month - 1, day, hour);
  let ms = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(ms);
    ms += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return ms;
}
function worldBossNightWindow(now = Date.now()) {
  const p = parts(now);
  const start = localHour(p.year, p.month, p.day, 1);
  const end = localHour(p.year, p.month, p.day, 5);
  const paused = now >= start && now < end;
  if (now < end) return { start, end, paused };
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return {
    start: localHour(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 1),
    end: localHour(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 5),
    paused: false
  };
}
var worldBossNightPaused = (now = Date.now()) => worldBossNightWindow(now).paused;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WORLD_BOSS_TIME_ZONE,
  worldBossNightPaused,
  worldBossNightWindow
});
