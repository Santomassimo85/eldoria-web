import { useState, useEffect, useRef, useMemo } from "react";
import "./DateTimePicker.css";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const pad = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DDTHH:MM" ⇄ Date (treated as local time, like <input type="datetime-local">)
const parseValue = (v) => {
  if (!v) return null;
  const [date, time = "00:00"] = v.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, h || 0, mi || 0);
};

const formatValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const formatDisplay = (date) => {
  if (!date) return "";
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const startOfMonth = (y, m) => new Date(y, m, 1);
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const isSameDay = (a, b) =>
  a && b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Drop-in replacement for `<input type="datetime-local">`.
 * Same value contract: "YYYY-MM-DDTHH:MM" string.
 */
export default function DateTimePicker({
  value,
  onChange,
  required = false,
  className = "",
  placeholder = "Seleziona data e ora",
  presets = "auction", // "auction" | "opening" | "session" | "none"
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => parseValue(value), [value]);
  const initial = selected || new Date();

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [hour, setHour] = useState(selected ? selected.getHours() : 22);
  const [minute, setMinute] = useState(selected ? selected.getMinutes() : 0);

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
      setHour(selected.getHours());
      setMinute(selected.getMinutes());
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const emit = (date) => onChange?.(formatValue(date));

  const pickDate = (day) => {
    const d = new Date(viewYear, viewMonth, day, hour, minute);
    emit(d);
  };

  const pickTime = (h, m) => {
    setHour(h);
    setMinute(m);
    const base = selected || new Date(viewYear, viewMonth, new Date().getDate());
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
    emit(d);
  };

  const shiftMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  };

  const stepHour = (delta) => {
    const next = (hour + delta + 24) % 24;
    pickTime(next, minute);
  };
  const stepMinute = (delta) => {
    let nm = minute + delta;
    let nh = hour;
    if (nm >= 60) { nm -= 60; nh = (nh + 1) % 24; }
    if (nm < 0)   { nm += 60; nh = (nh - 1 + 24) % 24; }
    pickTime(nh, nm);
  };

  // ── Presets ─────────────────────────────────────────────────
  const presetButtons = useMemo(() => {
    const now = new Date();
    const at = (offsetDays, h = 22, m = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offsetDays);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const nextWeekday = (target, h = 22, m = 0) => {
      // target: 0=Sunday … 6=Saturday
      const d = new Date(now);
      const diff = (target - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(h, m, 0, 0);
      return d;
    };

    if (presets === "none") return [];
    if (presets === "opening") {
      return [
        { label: "Stasera 22:00", date: at(0, 22, 0) },
        { label: "Domani 22:00", date: at(1, 22, 0) },
        { label: "Sabato 22:00", date: nextWeekday(6, 22, 0) },
        { label: "+7 giorni",    date: at(7, 22, 0) },
      ];
    }
    if (presets === "session") {
      return [
        { label: "Stasera 21:00",  date: at(0, 21, 0) },
        { label: "Domani 21:00",   date: at(1, 21, 0) },
        { label: "Sabato 21:00",   date: nextWeekday(6, 21, 0) },
        { label: "Domenica 21:00", date: nextWeekday(0, 21, 0) },
      ];
    }
    // auction defaults
    return [
      { label: "+24h",        date: at(1, hour || 22, minute) },
      { label: "+3 giorni",   date: at(3, hour || 22, minute) },
      { label: "+7 giorni",   date: at(7, hour || 22, minute) },
      { label: "Sabato 22:00", date: nextWeekday(6, 22, 0) },
    ];
  }, [presets, hour, minute]);

  // ── Calendar grid ───────────────────────────────────────────
  const calendarCells = useMemo(() => {
    const first = startOfMonth(viewYear, viewMonth);
    const firstDow = (first.getDay() + 6) % 7; // Mon = 0
    const total = daysInMonth(viewYear, viewMonth);
    const prevTotal = daysInMonth(viewYear, viewMonth - 1 < 0 ? 11 : viewMonth - 1);
    const cells = [];
    for (let i = 0; i < firstDow; i++) {
      cells.push({ day: prevTotal - firstDow + i + 1, muted: true, monthDelta: -1 });
    }
    for (let d = 1; d <= total; d++) {
      cells.push({ day: d, muted: false, monthDelta: 0 });
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const nextDay = cells.length - firstDow - total + 1;
      cells.push({ day: nextDay, muted: true, monthDelta: 1 });
      if (cells.length >= 42) break;
    }
    return cells;
  }, [viewYear, viewMonth]);

  const today = new Date();
  const display = formatDisplay(selected);

  return (
    <div className={`dtp-wrap ${className} ${open ? "is-open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className={`dtp-trigger ${selected ? "has-value" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="dtp-trigger-icon" aria-hidden="true">📅</span>
        <span className="dtp-trigger-value">
          {display || <span className="dtp-trigger-placeholder">{placeholder}</span>}
        </span>
        {selected && (
          <span
            className="dtp-trigger-clear"
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange?.(""); }}
            title="Cancella"
          >
            ✕
          </span>
        )}
        <span className="dtp-trigger-caret" aria-hidden="true">▾</span>
      </button>

      {/* Hidden field for native form `required` validation */}
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value || ""}
          onChange={() => {}}
          className="dtp-required-shim"
        />
      )}

      {open && (
        <div className="dtp-pop" role="dialog">
          {presetButtons.length > 0 && (
            <div className="dtp-presets">
              {presetButtons.map(p => (
                <button
                  key={p.label}
                  type="button"
                  className="dtp-preset"
                  onClick={() => emit(p.date)}
                  title={formatDisplay(p.date)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div className="dtp-body">
            <div className="dtp-cal">
              <div className="dtp-cal-head">
                <button type="button" className="dtp-nav" onClick={() => shiftMonth(-1)} aria-label="Mese precedente">‹</button>
                <div className="dtp-cal-title">
                  {MONTHS[viewMonth]} {viewYear}
                </div>
                <button type="button" className="dtp-nav" onClick={() => shiftMonth(1)} aria-label="Mese successivo">›</button>
              </div>

              <div className="dtp-cal-dows">
                {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
              </div>

              <div className="dtp-cal-grid">
                {calendarCells.map((c, i) => {
                  const cellDate = new Date(viewYear, viewMonth + c.monthDelta, c.day);
                  const isToday = isSameDay(cellDate, today);
                  const isSel   = isSameDay(cellDate, selected);
                  return (
                    <button
                      type="button"
                      key={i}
                      className={`dtp-day ${c.muted ? "muted" : ""} ${isToday ? "today" : ""} ${isSel ? "sel" : ""}`}
                      onClick={() => {
                        if (c.monthDelta !== 0) {
                          setViewMonth(viewMonth + c.monthDelta);
                          if (viewMonth + c.monthDelta < 0) { setViewMonth(11); setViewYear(viewYear - 1); }
                          if (viewMonth + c.monthDelta > 11) { setViewMonth(0); setViewYear(viewYear + 1); }
                        }
                        const target = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), hour, minute);
                        emit(target);
                      }}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dtp-time">
              <div className="dtp-time-label">Ora</div>
              <div className="dtp-time-row">
                <div className="dtp-stepper">
                  <button type="button" onClick={() => stepHour(1)}  aria-label="Ora +">▲</button>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={pad(hour)}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(23, Number(e.target.value || 0)));
                      pickTime(v, minute);
                    }}
                  />
                  <button type="button" onClick={() => stepHour(-1)} aria-label="Ora −">▼</button>
                </div>
                <span className="dtp-colon">:</span>
                <div className="dtp-stepper">
                  <button type="button" onClick={() => stepMinute(5)}  aria-label="Min +5">▲</button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={pad(minute)}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(59, Number(e.target.value || 0)));
                      pickTime(hour, v);
                    }}
                  />
                  <button type="button" onClick={() => stepMinute(-5)} aria-label="Min −5">▼</button>
                </div>
              </div>

              <div className="dtp-quick-times">
                {["18:00", "20:00", "21:00", "22:00", "23:00"].map(t => {
                  const [h, m] = t.split(":").map(Number);
                  const on = h === hour && m === minute;
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`dtp-quick-time ${on ? "on" : ""}`}
                      onClick={() => pickTime(h, m)}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="dtp-foot">
            <button
              type="button"
              className="dtp-foot-btn"
              onClick={() => onChange?.("")}
            >
              Cancella
            </button>
            <button
              type="button"
              className="dtp-foot-btn primary"
              onClick={() => setOpen(false)}
            >
              Fatto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
