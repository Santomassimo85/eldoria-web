/*
 * Eldoria · Orecchio — plugin di Obsidian (si installa da solo quando parte
 * tools/obsidian-ascolto.mjs). Ogni secondo chiede al programma dell'Orecchio
 * (127.0.0.1) cosa ha sentito e:
 *   - apre la nota in una scheda con le API di Obsidian (non col link obsidian://,
 *     che a volte lasciava la scheda vuota);
 *   - riempie il pannello laterale "Orecchio" con i link di ciò che ha sentito
 *     (per le categorie: tutte le note dell'indice, con l'anteprima al passaggio).
 */
const { Plugin, ItemView, Notice, requestUrl } = require("obsidian");

const VIEW = "eldoria-orecchio";
const PORT = 5199;
const MAX_ROWS = 25;

class OrecchioView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW; }
  getDisplayText() { return "Orecchio del Master"; }
  getIcon() { return "ear"; }
  async onOpen() { this.render(); }

  render() {
    const el = this.containerEl.children[1];
    el.empty();
    el.addClass("orecchio-view");
    const head = el.createDiv({ cls: "orecchio-head" });
    head.createSpan({ cls: "orecchio-dot" + (this.plugin.connected ? " is-on" : "") });
    head.createSpan({ text: this.plugin.connected ? "In ascolto dalla pagina dell'Orecchio" : "Orecchio spento: lancia orecchio-obsidian.bat" });
    if (this.plugin.rows.length) {
      const clear = head.createEl("button", { text: "Svuota", cls: "orecchio-clear" });
      clear.onclick = () => { this.plugin.rows = []; this.render(); };
    }
    if (!this.plugin.rows.length) {
      el.createDiv({ cls: "orecchio-empty", text: "Quando l'Orecchio sente npc, taverna, luoghi, incarichi o un nome, qui compaiono i link." });
      return;
    }
    for (const row of this.plugin.rows) {
      const box = el.createDiv({ cls: "orecchio-row" });
      const top = box.createDiv({ cls: "orecchio-top" });
      top.createSpan({ cls: "orecchio-time", text: row.time });
      const main = top.createEl("a", { cls: "orecchio-title internal-link", text: row.label });
      this.linkify(main, row.path);
      top.createSpan({ cls: "orecchio-kind", text: row.kind });
      if (row.heard) box.createDiv({ cls: "orecchio-heard", text: `“${row.heard}”` });
      if (row.items?.length) {
        const ul = box.createEl("ul", { cls: "orecchio-items" });
        for (const it of row.items) this.linkify(ul.createEl("li").createEl("a", { cls: "internal-link", text: it.basename }), it.path);
      }
    }
  }

  linkify(a, path) {
    a.setAttr("data-href", path);
    a.onclick = (e) => { e.preventDefault(); this.plugin.openPath(path, true); };
    a.addEventListener("mouseover", (event) => {
      this.app.workspace.trigger("hover-link", { event, source: VIEW, hoverParent: this, targetEl: a, linktext: path });
    });
  }
}

module.exports = class OrecchioPlugin extends Plugin {
  async onload() {
    this.rows = [];
    this.since = 0;
    this.connected = false;
    this.registerView(VIEW, (leaf) => new OrecchioView(leaf, this));
    this.registerHoverLinkSource(VIEW, { display: "Orecchio del Master", defaultMod: false });
    this.addRibbonIcon("ear", "Orecchio del Master", () => this.showView());
    this.addCommand({ id: "mostra-pannello", name: "Mostra il pannello", callback: () => this.showView() });
    this.status = this.addStatusBarItem();
    this.app.workspace.onLayoutReady(() => this.loop());
  }

  onunload() { this.stopped = true; }

  async loop() {
    while (!this.stopped) {
      let wait = 1000;
      try {
        const r = await requestUrl({ url: `http://127.0.0.1:${PORT}/events?since=${this.since}`, throw: false });
        if (r.status !== 200) throw new Error(String(r.status));
        const data = r.json;
        if (data.reset) this.since = 0;
        for (const ev of data.events || []) { this.since = Math.max(this.since, ev.id); await this.handle(ev); }
        this.setConnected(true);
      } catch {
        this.setConnected(false);
        wait = 4000;
      }
      await new Promise((res) => setTimeout(res, wait));
    }
  }

  setConnected(on) {
    if (on === this.connected) return;
    this.connected = on;
    this.status.setText(on ? "👂 Orecchio" : "");
    this.refresh();
  }

  async handle(ev) {
    const file = this.app.vault.getAbstractFileByPath(ev.path);
    if (!file) { new Notice(`Orecchio: nota non trovata (${ev.path})`); return; }
    let items = null;
    if (ev.kind === "Categoria") {
      const links = this.app.metadataCache.getFileCache(file)?.links || [];
      items = links
        .map((l) => this.app.metadataCache.getFirstLinkpathDest(l.link, file.path))
        .filter(Boolean);
    }
    const time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    this.rows.unshift({ time, label: ev.label, kind: ev.kind, heard: ev.heard, path: file.path, items });
    this.rows = this.rows.slice(0, MAX_ROWS);
    if (ev.open !== false) await this.openPath(file.path, ev.newTab !== false);
    this.refresh(true);
  }

  async openPath(path, newTab) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return;
    // se è già aperta in una scheda, ci torna invece di duplicarla
    let leaf = null;
    this.app.workspace.iterateAllLeaves((l) => { if (!leaf && l.view?.file?.path === path) leaf = l; });
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(newTab ? "tab" : false);
      await leaf.openFile(file);
    }
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  async showView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  refresh(reveal) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW);
    if (!leaves.length && reveal) { this.showView(); return; }
    for (const l of leaves) l.view.render?.();
  }
};
