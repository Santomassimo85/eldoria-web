// src/components/CineToolbar.jsx
// Toolbar di ricerca riutilizzabile per le pagine cinematografiche.
// Ricerca testuale + (opzionale) chip di filtro + contatore risultati.
// Lo stile vive in src/styles/cinematic.css (.cine-toolbar …).
export default function CineToolbar({
    query,
    onQuery,
    placeholder = "Cerca…",
    chips = [],            // [{ key, label }]
    activeChip = null,     // null = "tutti"
    onChip,
    allLabel = "Tutti",
    count,
    countNoun = "risultati",
}) {
    return (
        <div className="cine-toolbar">
            <div className="cine-search">
                <span className="cine-search-icon" aria-hidden="true">🔍</span>
                <input
                    type="text"
                    className="cine-search-input"
                    value={query}
                    onChange={(e) => onQuery(e.target.value)}
                    placeholder={placeholder}
                    aria-label={placeholder}
                />
                {query && (
                    <button
                        type="button"
                        className="cine-search-clear"
                        onClick={() => onQuery("")}
                        aria-label="Cancella ricerca"
                    >
                        ✕
                    </button>
                )}
            </div>

            {chips.length > 0 && (
                <div className="cine-chips" role="group" aria-label="Filtri">
                    <button
                        type="button"
                        className={`cine-chip ${activeChip == null ? "active" : ""}`}
                        onClick={() => onChip(null)}
                    >
                        {allLabel}
                    </button>
                    {chips.map((c) => (
                        <button
                            key={c.key}
                            type="button"
                            className={`cine-chip ${activeChip === c.key ? "active" : ""}`}
                            onClick={() => onChip(activeChip === c.key ? null : c.key)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            )}

            {count != null && (
                <span className="cine-result-count">
                    {count} {countNoun}
                </span>
            )}
        </div>
    );
}
