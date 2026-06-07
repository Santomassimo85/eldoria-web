// src/components/AmbientFX.jsx
// Layer di sfondo animato CONTINUO, una variante per pagina.
// Le particelle ricevono posizione/tempo via CSS custom props (inline),
// così il CSS resta compatto e ogni effetto è facilmente regolabile.
//   fire      → braci che salgono (Bottega Arena)
//   water     → bolle d'acqua che risalgono (NPC)
//   leaves    → foglie al vento che cadono (Party)
//   cosmos    → stelle che brillano + nebulosa che deriva (Geo)
//   fireflies → lucciole/polvere dorata che fluttuano (Bacheca)
import "./AmbientFX.css";

const COUNTS = { fire: 18, water: 14, leaves: 14, cosmos: 36, fireflies: 20 };

// pseudo-random deterministico per indice (niente flicker tra render)
const rand = (i, seed) => {
    const x = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
    return x - Math.floor(x);
};

export default function AmbientFX({ variant = "fire" }) {
    const n = COUNTS[variant] || 16;
    const anchored = variant === "cosmos" || variant === "fireflies";

    const particles = Array.from({ length: n }, (_, i) => {
        const r1 = rand(i, 1.7);
        const r2 = rand(i, 3.1);
        const r3 = rand(i, 5.3);
        const r4 = rand(i, 7.9);

        const dur = +(12 + r2 * 22).toFixed(2);   // 12..34s
        const style = {
            left: `${(r1 * 100).toFixed(2)}%`,
            animationDuration: `${dur}s`,
            animationDelay: `${(-r3 * dur).toFixed(2)}s`, // negativo → già in volo al load
            "--afx-size": (0.5 + r4).toFixed(2),           // moltiplicatore 0.5..1.5
            "--afx-dx": `${((r2 - 0.5) * 80).toFixed(1)}px`, // drift orizzontale
        };
        if (anchored) style.top = `${(rand(i, 9.2) * 100).toFixed(2)}%`;

        return <span key={i} className="afx-p" style={style} />;
    });

    return (
        <div className={`ambient-fx ambient-fx--${variant}`} aria-hidden="true">
            {particles}
        </div>
    );
}
