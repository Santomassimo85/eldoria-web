# Arena AI — "play like a human" progress

Tracking the multi-step work that makes the Arena AI behave like a real
player: cast spells/skills, and make its own TS when targeted.

Last updated: 2026-05-20

---

## Goal (user request)

> In arena fight with AI, AI should be like a player. So if a mage or
> some classes use a skill/spell or everything that requires a TS from
> the AI, AI should do that.
>
> Voglio che sia simulato quasi perfettamente un giocatore bravo umano.
> Almeno 70%. E ricorda che l'AI deve anche poter subire i TS — se
> qualcuno le casta addosso qualcosa deve fare anche lei il TS per
> salvarsi.

User also chose (in the kick-off questions):
- **Class scope**: all spellcasters
- **Decision logic**: smart (best expected damage / impact)
- **TS visibility**: yes, same `showD20Roll` popup for the human's saves

---

## Done

### 1. AI auto-resolves pending TS when targeted (`Arena.jsx`)

PHASE 0 added at the very top of `aiTakeAction`. Mirrors the human's
`rollSavingThrow` flow but driven by the AI itself.

- `pendingControlSave` → AI rolls `d20 + ability mod (+ saveBuff)` vs
  `pendingControlDC`. Uses `showD20Roll` so the human sees the d20.
  - **Pass**: clears `pendingControlSave`, `pendingControlDC`,
    `pendingControlSaveAbility`, zeros `controlLostTurns`. Watcher
    re-fires `aiTakeAction` → AI takes a normal action.
  - **Fail (regular control)**: decrements `controlLostTurns`. If
    budget remains, keeps the TS armed for next turn. Passes turn back
    to the human.
  - **Fail (Corona della Pazzia)**: AI self-damages with its equipped
    weapon, clears pending state, passes turn back.
- `pendingSaveDot` → AI rolls TS. Fail sets `poisonDoT`,
  `poisonDoTTurns`, `poisonDoTDice` on the AI. Pass clears the pending.
- `poisonDoT` tick: if not yet resolved this turn (token compare with
  `turnExpiry`), the AI takes the dice of poison damage at start of
  turn, decrements `poisonDoTTurns`, may end the match if it kills.
- `controlLostTurns > 0` without `pendingControlSave`: skip turn, decrement
  budget, pass turn back (rare edge case).

### 2. AI casts spells (SPELL PHASE in `aiTakeAction`)

Inserted between the buff phase and the weapon attack phase. Pure
add — falls through to the existing weapon attack code when no spell
scores high enough.

- Scans `aiSnap.selectedActions` for entries with `type: "spell"`.
- Skips spells with no uses left (`actionUsesLeft[name]` or `maxUses`).
- For each candidate, scores by `kind`:
  - `shield_buff` — score 7, gated by `shieldSkillTurns==0` and `hpPct<0.85`
  - `save_buff` — score 6, gated by no active save buff
  - `heal` (or "cura" in info) — score 12 if `hpPct<0.55`
  - `control` — score `14 * failChance + 4`, gated by target not already controlled
  - `save_dot` — `avg(dice) * turns * failChance`, gated by target not already poisoned
  - `save_damage` (TS-based damage spell, per `isSaveDamageSpell`) —
    `(avg(damage) + spellMod) * failChance`
- Weapon baseline = best weapon's `avg(damage) + statMod`.
- Caster bias: +3 for `mago/wizard/strego/sorcerer/warlock/cleric/
  chierico/druid/druido/bard/bardo`.
- Best candidate wins ⇒ cast it.
- Execution paths:
  - `shield_buff`: sets `shieldSkillTurns` / `shieldSkillBonus`, ends turn.
  - `save_buff`: sets `saveBuffAttacks` / `saveBuffBonus`, ends turn.
  - `heal`: applies `rollDmg(damage) + spellMod` capped to `maxHp`, ends turn.
  - `control`: sets `pendingControlSave: true`, `pendingControlDC`,
    `pendingControlSaveAbility`, `controlLostTurns: 2` on the human.
    Ends turn.
  - `save_dot`: sets `pendingSaveDot: {ability, dc, dice, turns, name, icon}`
    on the human. Ends turn.
  - `save_damage`: rolls the human's TS NOW with visible `showD20Roll`,
    deals damage on fail. Respects multi-action (rogue/monk only;
    irrelevant for wizard).
- Decrements `actionUsesLeft[spell.name]`, increments `aiAttacksMade`,
  sets `aiBuffActivated: true`.

### 3. New spellcaster AI preset (`AI_HARD_PRESETS`)

Added `archetype: "wizard-fire"` — Arconte Pyrios:
- Class: `Wizard` (INT=5 → spell DC 18)
- Weapons: `Pugnale` 1d4 (dex) — fallback when slots dry up
- Spells (wired into snapshot's `selectedActions` via the new
  `[...weapons, ...spells]` merge):
  - Dardo di Fuoco (trucchetto 1d10, ×4)
  - Tocco Gelido (trucchetto 1d8, ×4)
  - Sonno (control, ×4) — TS SAG, 2 turn lockout
  - Mani Brucianti (lv1, 3d6, ×4)
  - Scudo (shield_buff, +1 CA / 3 turni, ×2)
  - Raggio Rovente (lv2, 6d6, ×2)

---

## Not yet covered (follow-up scope)

These spell `special` types / class abilities are NOT wired into the
AI's SPELL PHASE yet. If the AI's `selectedActions` includes one, the
AI just skips it.

### Spell specials
- `vampiric` — damage + heal caster
- `blind_debuff` — −3 to enemy hit rolls
- `invisibility` — self can't be attacked next turn (timing tricky)
- `corona_pazzia` — TS SAG or attack self with weapon

### Class skills
- `smite` (Paladin) — extra dice on weapon hit
- `lay_of_hands` (Paladin) — pool heal
- `magical_cunning` (Warlock) — skip turn to recover slot
- `patto_demoniaco` (Warlock) — sacrifice HP for +damage
- `recupero_arcano` (Wizard) — recover slots
- `concentrate` — +damage prep
- `magic_detect` / `aid_buff` (Paladin) — already triggered as turn-1 buff, but not as a chosen action

### Pets / Demons / Constructs
- `pet_wolf`, `pet_spider`, `pet_eagle`, `pet_drago` (Ranger)
- `demon_mephit`, `demon_succubus`, `demon_greater` (Warlock)
- `construct_golem`, `construct_snake` (Artificer)

### Druid
- `wild_shape` (form change)

### More AI presets to add
- Cleric (WIS-based heal-focused build)
- Sorcerer/Warlock (CHA-based)
- Druid (with at least one wild shape form)
- Bard (mixed support)
- Ranger with pet + bow combo

---

## Key files & insertion points

- `src/pages/Arena.jsx`
  - `AI_HARD_PRESETS` (line ~634): preset list; new `wizard-fire`
    entry around line 695–719.
  - `makeAiSnapshotAndPlayer` (line ~722): `selectedActions` now
    merges `preset.weapons` and `preset.spells`.
  - `aiTakeAction` (line ~2724):
    - PHASE 0 (TS resolution + poison tick) inserted right after the
      early-return guards.
    - SPELL PHASE inserted right before the `// ── ATTACK PHASE ──`
      comment.
- Memory note: `memory/project_arena_ai_player_like.md`

---

## How to resume

1. Pick a follow-up from the "Not yet covered" list above.
2. To add a new spell `special` kind: extend the `_candidates`
   building block in the SPELL PHASE and add an `else if (_picked.kind
   === ...)` execution branch.
3. To add a new caster preset: append to `AI_HARD_PRESETS` with
   `weapons` + `spells` arrays. Make sure `class` matches the prefix
   checked by `getSpellcastingAbility` so the AI gets the right ability
   mod for DC.
4. To debug a stuck AI turn: check whether `pendingControlSave`,
   `pendingSaveDot`, `poisonDoT`, or `controlLostTurns > 0` is set on
   the AI player object — PHASE 0 should be handling them.

---

## Open questions / decisions to revisit

- **Multi-action for spells**: currently only `save_damage` keeps the
  turn going for rogue/monk; all other spell kinds end the turn. Is
  that right for all classes? Worth revisiting once a multi-action
  caster preset is added.
- **`controlLostTurns: 2` on the human after AI casts control**:
  matches the human's casting flow. Confirm playtest feels fair.
- **Spell DC fail-chance heuristic**: assumes target's TS mod ≈ 0.
  Could be refined by reading the actual target snap's mod for the
  parsed TS ability.
- **Caster bias = +3**: tuneable. If wizards burn spells too eagerly
  (or too cautiously) playtesting, adjust this constant.
