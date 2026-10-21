import React from "react";
import {
  FOUNDRY_TYPES, FOUNDRY_DAMAGE_TYPES, FOUNDRY_ACTION_TYPES, FOUNDRY_WEAPON_PROPS,
  FOUNDRY_ARMOR_TYPES, FOUNDRY_ABILITIES, resolveFoundryType,
} from "../utils/foundryMap";

/* Campi "Dati per Foundry" di un oggetto: gli stessi del form del Mercato
   (MarketAdmin), sullo stesso sotto-oggetto `foundry` di EMPTY_FOUNDRY, così
   `marketItemToFoundryPayload` lo trasforma nell'Item dnd5e senza differenze.
   `item` = { type, foundry }, `onChange(foundry)` riceve il sotto-oggetto nuovo. */
export default function FoundryItemFields({ item, onChange }) {
  const f = item?.foundry || {};
  const fType = resolveFoundryType(item);
  const set = (k, v) => onChange({ ...f, [k]: v });
  const toggleProp = (p) => {
    const props = f.properties || [];
    set("properties", props.includes(p) ? props.filter((x) => x !== p) : [...props, p]);
  };

  return (
    <div className="fif">
      <div className="fif-row">
        <label className="fif-f fif-f--wide">
          <span>Tipo Foundry</span>
          <select className="admin-field-input" value={f.foundryType || ""} onChange={(e) => set("foundryType", e.target.value)}>
            <option value="">Automatico (da Tipo: {resolveFoundryType({ type: item?.type })})</option>
            {FOUNDRY_TYPES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </label>
        <label className="fif-f">
          <span>Peso (lb)</span>
          <input className="admin-field-input" type="number" value={f.weight ?? ""} onChange={(e) => set("weight", e.target.value)} placeholder="0" />
        </label>
        <label className="fif-f">
          <span>Quantità</span>
          <input className="admin-field-input" type="number" min="1" value={f.quantity ?? 1} onChange={(e) => set("quantity", e.target.value)} placeholder="1" />
        </label>
      </div>

      {fType === "weapon" && (<>
        <div className="fif-row">
          <label className="fif-f fif-f--wide">
            <span>Tipo d'attacco</span>
            <select className="admin-field-input" value={f.actionType ?? "mwak"} onChange={(e) => set("actionType", e.target.value)}>
              {FOUNDRY_ACTION_TYPES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </label>
          <label className="fif-f">
            <span>Bonus al colpire</span>
            <input className="admin-field-input" type="number" value={f.attackBonus ?? ""} onChange={(e) => set("attackBonus", e.target.value)} placeholder="0" />
          </label>
        </div>
        <div className="fif-row">
          <label className="fif-f">
            <span>Danno *</span>
            <input className="admin-field-input" value={f.damageFormula || ""} onChange={(e) => set("damageFormula", e.target.value)} placeholder="1d8+1" />
          </label>
          <label className="fif-f">
            <span>Tipo di danno</span>
            <select className="admin-field-input" value={f.damageType || "slashing"} onChange={(e) => set("damageType", e.target.value)}>
              {FOUNDRY_DAMAGE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="fif-f">
            <span>Danno extra</span>
            <input className="admin-field-input" value={f.damage2Formula || ""} onChange={(e) => set("damage2Formula", e.target.value)} placeholder="1d6" />
          </label>
          <label className="fif-f">
            <span>Tipo extra</span>
            <select className="admin-field-input" value={f.damage2Type || ""} onChange={(e) => set("damage2Type", e.target.value)}>
              <option value="">—</option>
              {FOUNDRY_DAMAGE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="fif-f">
            <span>Versatile</span>
            <input className="admin-field-input" value={f.versatileFormula || ""} onChange={(e) => set("versatileFormula", e.target.value)} placeholder="1d10" />
          </label>
        </div>
        <div className="fif-props">
          {FOUNDRY_WEAPON_PROPS.map((p) => (
            <button type="button" key={p.v} aria-pressed={(f.properties || []).includes(p.v)}
              className={`mkadm-foundry-chip ${(f.properties || []).includes(p.v) ? "on" : ""}`}
              onClick={() => toggleProp(p.v)}>{p.label}</button>
          ))}
          <label className="mkadm-foundry-check">
            <input type="checkbox" checked={f.proficient !== false} onChange={(e) => set("proficient", e.target.checked)} />
            Competente
          </label>
        </div>
      </>)}

      {fType === "equipment" && (
        <div className="fif-row">
          <label className="fif-f fif-f--wide">
            <span>Tipo armatura</span>
            <select className="admin-field-input" value={f.armorType || ""} onChange={(e) => set("armorType", e.target.value)}>
              {FOUNDRY_ARMOR_TYPES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </label>
          <label className="fif-f">
            <span>Valore CA</span>
            <input className="admin-field-input" type="number" value={f.armorValue ?? ""} onChange={(e) => set("armorValue", e.target.value)} placeholder="14" />
          </label>
        </div>
      )}

      {(fType === "weapon" || fType === "consumable") && (
        <div className="fif-row">
          <label className="fif-f">
            <span>Tiro salvezza</span>
            <select className="admin-field-input" value={f.saveAbility || ""} onChange={(e) => set("saveAbility", e.target.value)}>
              {FOUNDRY_ABILITIES.map((a) => <option key={a} value={a}>{a ? a.toUpperCase() : "—"}</option>)}
            </select>
          </label>
          <label className="fif-f">
            <span>CD</span>
            <input className="admin-field-input" type="number" value={f.saveDC ?? ""} onChange={(e) => set("saveDC", e.target.value)} placeholder="15" />
          </label>
        </div>
      )}
    </div>
  );
}
