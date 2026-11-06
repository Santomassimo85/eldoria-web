/* EMOJI → ICONE DI GAME-ICONS.NET (2026-11-06), per TUTTO il sito.
   Il runtime JSX (src/jsx/) sostituisce da solo ogni emoji di questa mappa nei testi mostrati.
   Voce: "emoji": "nome-icona" oppure "nome-icona|tono" (T qui sotto; senza tono = colore del testo).
   I disegni stanno in public/gi/<nome>.svg, generati da `node tools/build-game-icons.mjs`:
   dopo aver aggiunto una voce, rilanciarlo. Le faccine da chat non ci sono apposta (restano emoji). */
export const T = {
  fire: "#ff8a3d", cold: "#7fd6ff", volt: "#ffe14d", gold: "#f2c14e", red: "#ff6b5a", green: "#7fe39a",
  poison: "#9be05a", violet: "#c58bff", blue: "#6ab8ff", pink: "#ff9fe0", silver: "#cfd6de", brown: "#c99a66",
  water: "#5fb8ff", dark: "#9a8fb0",
};

export const EMOJI_ICONS = {
  // combattimento
  "⚔": "crossed-swords", "🗡": "plain-dagger", "🛡": "checked-shield|silver", "🏹": "bow-arrow", "🪓": "wood-axe",
  "🔨": "claw-hammer", "⚒": "anvil", "🤺": "fencer", "🥊": "boxing-glove", "🥋": "black-belt", "🔫": "pistol-gun",
  "⛏": "mining", "👊": "fist", "✊": "fist", "💪": "biceps|gold", "🦵": "leg", "🏃": "run", "🥷": "ninja-head",
  "🎯": "bullseye|red", "💥": "bright-explosion|fire", "🌀": "vortex|cold", "💢": "enrage|red", "💣": "unlit-bomb",
  "🩸": "blood|red", "🩹": "bandage-roll|green", "⛓": "crossed-chains|silver", "🔗": "linked-rings|silver",
  "🕸": "spider-web", "🪤": "wolf-trap", "🔱": "trident|gold", "⚰": "coffin", "🪦": "tombstone", "🦴": "crossed-bones",
  // elementi e stati
  "🔥": "flame|fire", "⚡": "power-lightning|volt", "❄": "snowflake-2|cold", "🧊": "ice-cube|cold", "💧": "water-drop|water",
  "💦": "droplets|water", "🌊": "big-wave|water", "🌪": "tornado|silver", "💨": "wind-slap|silver", "🌬": "wind-slap|cold",
  "🌫": "fog|silver", "🌩": "lightning-storm|volt", "⛈": "lightning-storm|volt", "🌧": "heavy-rain|water", "🌨": "snowing|cold",
  "☄": "comet-spark|fire", "🌋": "volcano|fire", "☀": "sun|gold", "🌞": "sun|gold", "🔆": "sun|gold", "🌙": "moon|gold", "🌕": "moon|gold",
  "🌑": "evil-moon|violet", "🌘": "evil-moon|violet", "🌒": "evil-moon|violet", "🌗": "evil-moon|violet", "🌌": "galaxy|violet",
  "🌈": "rainbow-star|pink", "🌅": "sunrise|fire", "🌄": "sunrise|fire", "🌤": "sun-cloud|gold", "⛰": "mountains|brown", "🗻": "mountains|cold",
  "☠": "skull-crossed-bones|poison", "💀": "death-skull", "☣": "biohazard|poison", "🤢": "vomiting|poison", "🧪": "round-bottom-flask|poison",
  "⚗": "fizzing-flask|violet", "💫": "star-swirl|gold", "💤": "night-sleep|blue", "😴": "night-sleep|blue", "😵": "knockout|gold",
  "😱": "screaming|violet", "😈": "imp-laugh|red", "👿": "imp-laugh|red", "😠": "enrage|red", "😡": "enrage|red", "😤": "enrage|red",
  "🥵": "heat-haze|fire", "🥶": "frozen-body|cold", "🗿": "stone-bust|silver", "🪨": "stone-pile|brown", "🧱": "brick-wall|brown",
  "✨": "sparkles|gold", "🌟": "polar-star|gold", "⭐": "round-star|gold", "✴": "polar-star|gold", "🌠": "comet-spark|gold", "💠": "diamonds|blue",
  "🔮": "crystal-ball|violet", "🪄": "fairy-wand|violet", "👁": "eyeball|violet", "🧿": "eyeball|blue", "🧠": "brain|pink", "🌿": "three-leaves|green",
  "🍃": "falling-leaf|green", "🍂": "falling-leaf|fire", "🍁": "maple-leaf|fire", "🌱": "sprout|green", "🌳": "oak|green", "🌲": "pine-tree|green",
  "🌵": "cactus|green", "🍄": "mushroom|red", "🌸": "lotus-flower|pink", "🌼": "daisy|gold", "🌹": "rose|red", "🌷": "rose|pink", "🪷": "lotus|pink",
  "🍀": "clover|green", "🌾": "wheat|gold", "🪵": "log|brown", "🌰": "acorn|brown", "🪶": "feather|silver", "🪽": "feathered-wing|silver",
  // cuori
  "❤": "hearts|red", "♥": "hearts|red", "💚": "hearts|green", "💙": "hearts|blue", "💜": "hearts|violet", "🧡": "hearts|fire", "🖤": "hearts|dark",
  "💖": "hearts|pink", "💗": "hearts|pink", "💞": "hearts|pink", "💋": "lips|red", "🫦": "lips|red",
  // creature
  "🐉": "dragon-head|red", "🐲": "dragon-head|green", "👹": "oni|red", "👺": "oni|red", "👻": "ghost|cold", "🧟": "shambling-zombie|green",
  "🧌": "troll|green", "🧙": "wizard-face|violet", "🧝": "woman-elf-face|green", "🧚": "fairy|pink", "🧜": "mermaid|water", "🧞": "djinn|blue",
  "👼": "angel-outfit|gold", "😇": "angel-outfit|gold", "🐾": "paw-print", "🐺": "wolf-head|silver", "🐀": "rat|brown", "🐍": "snake|green",
  "🦎": "gecko|green", "🐊": "croc-jaws|green", "🐢": "turtle|green", "🐸": "frog|green", "🕷": "spider-face|dark", "🦂": "scorpion|fire",
  "🐜": "ant|brown", "🐝": "bee|gold", "🦟": "amber-mosquito|gold", "🐛": "caterpillar|green", "🐌": "snail|brown", "🪲": "beetle-shell|green", "🪱": "earth-worm|pink",
  "🐙": "octopus|violet", "🦑": "squid|pink", "🦈": "shark-jaws|blue", "🐠": "tropical-fish|fire", "🦀": "crab|red", "🦞": "crab|red", "🪼": "jellyfish|pink", "🐚": "spiral-shell|pink",
  "🦅": "eagle-emblem|gold", "🦉": "owl|brown", "🐦": "swallow|blue", "🕊": "dove|silver", "🐔": "chicken|gold", "🦃": "chicken|brown", "🦇": "bat|dark",
  "🐻": "bear-head|brown", "🦁": "lion|gold", "🐅": "tiger-head|fire", "🐆": "tiger-head|gold", "🐈": "cat|silver", "🐕": "sitting-dog|brown", "🐗": "boar|brown",
  "🦌": "deer|brown", "🐐": "goat|silver", "🐂": "bull|brown", "🐴": "horse-head|brown", "🐎": "horse-head|brown", "🦄": "unicorn|pink", "🦍": "gorilla|dark",
  "🦏": "rhinoceros-horn|silver", "🐰": "rabbit|silver", "🐇": "rabbit|silver", "🦡": "badger|silver", "🦖": "dinosaur-rex|green", "🦕": "dinosaur-bones|green",
  "🐣": "egg-eye|gold", "🥚": "big-egg|gold", "🙈": "monkey|brown",
  // persone e corpo
  "👤": "person", "🧑": "person", "🧍": "person", "👥": "two-shadows", "👬": "two-shadows", "🦸": "person", "🧓": "person", "🤸": "acrobatic",
  "🧘": "meditation|gold", "🏇": "cavalry", "👣": "footprint", "🙏": "prayer|gold", "✋": "hand", "🖐": "hand", "🫳": "hand", "🤲": "hand", "🤝": "shaking-hands|gold",
  "🦷": "tooth", "👂": "human-ear", "🧤": "gloves", "👢": "boots|brown", "👕": "shirt", "👘": "robe|violet", "🧥": "robe|brown", "🦺": "leather-vest|brown", "🎩": "top-hat",
  // tesori, gioco, premi
  "👑": "crown|gold", "🏆": "trophy|gold", "🏅": "medal|gold", "🥇": "medal|gold", "🥈": "medal|silver", "🥉": "medal|brown", "🎲": "dice-twenty-faces-twenty|gold",
  "🎴": "card-random|gold", "🃏": "card-joker|pink", "🎰": "rolling-dices|gold", "🎡": "ship-wheel|gold", "🪙": "two-coins|gold", "💰": "coins|gold", "👛": "coins|gold", "💎": "cut-diamond|blue",
  "💍": "ring|gold", "📿": "prayer-beads|gold", "🎁": "present|gold", "🎒": "knapsack|brown", "🗝": "key|gold", "🔑": "key|gold", "🔒": "padlock|gold", "🔐": "padlock|gold", "🔓": "padlock-open|gold",
  "🏷": "price-tag|gold", "🎟": "ticket|gold", "🧩": "jigsaw-piece|blue", "🏟": "arena|gold", "🏰": "castle|silver", "🗼": "watchtower|silver", "🏛": "greek-temple|silver",
  "⛪": "church|silver", "🏠": "house|brown", "🏪": "shop|gold", "🏙": "castle|silver", "🏭": "factory|silver", "🚪": "wooden-door|brown", "🕳": "hole|dark", "🏮": "paper-lantern|fire",
  "🕯": "candle-flame|fire", "⚖": "scales|gold", "⚜": "fleur-de-lys|gold", "✝": "holy-symbol|gold", "⚱": "amphora|brown", "🛢": "barrel|brown", "🧲": "magnet|red", "🪞": "mirror-mirror|cold",
  // musica e spettacolo
  "🎭": "drama-masks|gold", "🎵": "musical-notes|gold", "🎶": "musical-notes|gold", "🎼": "g-clef|gold", "🎺": "trumpet|gold", "📯": "hunting-horn|gold", "🎧": "headphones", "🎙": "microphone", "🎬": "film-projector", "🎞": "film-strip", "📸": "photo-camera", "🖼": "mona-lisa|brown", "🎨": "palette|pink",
  // cibo
  "🍷": "wine-glass|red", "🍺": "beer-stein|gold", "🍻": "beer-stein|gold", "🥃": "beer-stein|fire", "☕": "coffee-cup|brown", "🍵": "teapot|green", "🍲": "cauldron|brown", "🥘": "cauldron|brown", "🍳": "saucepan", "🍞": "bread|brown",
  "🍖": "meat|red", "🍗": "meat|brown", "🍜": "hot-meal|fire", "🍰": "cake-slice|pink", "🎂": "cake-slice|pink", "🍮": "cake-slice|gold", "🍬": "wrapped-sweet|pink", "🍯": "honey-jar|gold", "🫙": "honey-jar|silver", "🍒": "cherry|red", "🫐": "berries-bowl|blue", "🧂": "salt-shaker",
  // scritti e strumenti del sito
  "📜": "scroll-unfurled|gold", "📖": "open-book|gold", "📕": "book-cover|red", "📚": "bookshelf|brown", "📝": "notebook", "🗒": "notebook", "🧾": "notebook", "📋": "notebook", "✒": "quill-ink", "🖋": "quill-ink", "✍": "quill-ink", "✏": "pencil", "🖌": "paint-brush|pink",
  "🗺": "treasure-map|brown", "🧭": "compass|gold", "📍": "position-marker|red", "📌": "position-marker|red", "📏": "pencil-ruler", "🔭": "telescope", "🗓": "calendar", "📅": "calendar", "🕒": "pocket-watch", "🕓": "pocket-watch", "⏰": "alarm-clock", "⏱": "stopwatch", "⏳": "hourglass|gold", "⌛": "hourglass|gold",
  "✉": "envelope", "📨": "envelope", "📧": "envelope", "📤": "envelope", "📥": "envelope", "📦": "cardboard-box|brown", "📁": "open-folder|gold", "🗂": "files", "💾": "save|blue", "🗑": "trash-can", "🧹": "broom", "🧽": "soap|cold", "♻": "recycle|green", "🔄": "cycle", "🔁": "cycle",
  "⚙": "cog", "🛠": "spanner", "🔧": "spanner", "🔩": "screw", "🧰": "toolbox", "🔍": "magnifying-glass", "🔎": "magnifying-glass", "💡": "light-bulb|gold", "🤖": "robot-golem|blue", "🔔": "ringing-bell|gold", "📢": "megaphone", "📣": "megaphone", "🔊": "speaker", "🔈": "speaker", "🔇": "speaker-off",
  "💬": "talk", "🗨": "talk", "🗯": "talk", "📊": "histogram", "📈": "histogram", "🛒": "shopping-cart", "🛍": "shopping-bag", "🧵": "sewing-string", "🧬": "dna2", "💉": "syringe", "💊": "pill", "🌍": "world|blue", "🌐": "world|blue", "📰": "newspaper", "🗞": "newspaper",
  "⏸": "pause-button", "⏩": "fast-forward-button", "⏭": "fast-forward-button", "🏳": "flying-flag", "🏴": "flag-objective|dark", "🚩": "flag-objective|red",
  "🎓": "graduate-cap|gold", "🪝": "fishing-hook", "🫧": "bubbles|cold", "🧺": "basket|brown", "🥄": "ladle", "♨": "heat-haze|fire", "🧯": "fire-extinguisher|red", "ℹ": "info|blue",
  // esiti e segni
  "✅": "check-mark|green", "❌": "cancel|red", "🚫": "cancel|red", "⛔": "cancel|red", "🛑": "cancel|red", "⚠": "hazard-sign|gold", "❓": "uncertainty|gold", "❔": "uncertainty|gold",
  "🔴": "plain-circle|red", "🟢": "plain-circle|green", "🟡": "plain-circle|gold", "🔵": "plain-circle|blue", "🟣": "plain-circle|violet", "🟠": "plain-circle|fire", "⚪": "plain-circle|silver", "⚫": "plain-circle|dark", "⭕": "plain-circle|red",
  "🟥": "plain-square|red", "🟦": "plain-square|blue", "🟩": "plain-square|green", "🟫": "plain-square|brown", "⬛": "plain-square|dark", "🔺": "triangle-target|red", "🔻": "triangle-target|red", "🔷": "diamonds|blue",
};

/* Nomi usati (per il generatore) */
export const ALL_EMOJI_ICON_NAMES = [...new Set(Object.values(EMOJI_ICONS).map((v) => v.split("|")[0]))];
