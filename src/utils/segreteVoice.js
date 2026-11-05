/* CHAT VOCALE DELLE SEGRETE (2026-11-05)
   WebRTC a maglia fra i membri del gruppo (max 4 = 6 collegamenti), audio solo.
   Firestore fa da "centralino" (regole: solo chi è nel gruppo):
     dungeon_voice/{roomId}/peers/{uid}   = { name, sid, at, muted }   presenza (battito ogni 15 s)
     dungeon_voice/{roomId}/links/{a__b}  = { caller, callee, callerSid, calleeSid, offer, answer }
     dungeon_voice/{roomId}/links/{a__b}/cand/{id} = { from, key, c }  candidati ICE
   Chi ha l'uid "minore" chiama, l'altro risponde. `sid` = sessione di chi entra: se qualcuno
   esce e rientra (o ricarica) il sid cambia e il collegamento si rifà da capo.
   Server ICE (2026-11-05): li dà `segreteDo` op "voiceIce" (STUN + TURN di Cloudflare se le chiavi
   sono configurate: senza TURN i telefoni su rete mobile spesso restano su "collego").
   Un collegamento che non si apre entro CONNECT_TIMEOUT_MS si rifà da capo (lo rifà chi chiama). */
import { collection, doc, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, where, Bytes } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";

const STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
const CONNECT_TIMEOUT_MS = 15000;
async function loadIce() {
  try {
    const call = httpsCallable(functions, "segreteDo");
    const r = await Promise.race([call({ op: "voiceIce" }), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 6000))]);
    const list = r?.data?.iceServers;
    return { servers: Array.isArray(list) && list.length ? list : STUN, turn: !!r?.data?.turn };
  } catch { return { servers: STUN, turn: false }; }
}
const BEAT_MS = 5000; // porta anche la diagnostica
export const PEER_STALE_MS = 45000;
/* Presenza senza fidarsi degli orologi (2026-11-05): `at` lo scrive il telefono di ognuno col
   SUO orologio, e due telefoni possono differire di minuti. Si guarda invece QUANDO, sul nostro
   orologio, `at` di quel peer è cambiato l'ultima volta (il battito arriva ogni 15 s). */
export function makeFreshness() {
  const seen = {};
  return (peers, now = Date.now()) => peers.filter((p) => {
    const k = `${p.sid}|${p.at}`;
    if (!seen[p.uid] || seen[p.uid].k !== k) seen[p.uid] = { k, t: now };
    return now - seen[p.uid].t < PEER_STALE_MS;
  });
}
const pairId = (a, b) => (a < b ? `${a}__${b}` : `${b}__${a}`);
const rid = () => Math.random().toString(36).slice(2, 10);

export const peersCol = (roomId) => collection(db, "dungeon_voice", roomId, "peers");
const linksCol = (roomId) => collection(db, "dungeon_voice", roomId, "links");
const audioCol = (roomId) => collection(db, "dungeon_voice", roomId, "audio");

/* VOCE VIA SERVER (2026-11-05): se il collegamento diretto WebRTC con qualcuno non è aperto
   (reti mobili, router che lo bloccano, niente TURN), la voce passa da Firestore a pezzetti:
   chi parla manda ~300 ms di audio a 12 kHz in μ-law (≈3,6 kB) in dungeon_voice/{room}/audio,
   chi ascolta li rimette in fila con un piccolo margine. Ritardo ~1 s ma funziona su qualsiasi
   rete. Chi manda cancella i suoi pezzetti dopo RELAY_KEEP_MS. */
const RELAY_RATE = 12000;
const RELAY_CHUNK = 3600; // campioni = 300 ms
const RELAY_KEEP_MS = 8000;
const RELAY_LEAD_S = 0.25; // margine di partenza della riproduzione
function muEncode(f) {
  const out = new Uint8Array(f.length);
  for (let i = 0; i < f.length; i++) {
    let x = Math.max(-1, Math.min(1, f[i])) * 32635;
    const sign = x < 0 ? 0x80 : 0;
    if (x < 0) x = -x;
    x += 132;
    let exp = 7;
    for (let m = 0x4000; (x & m) === 0 && exp > 0; m >>= 1) exp--;
    const mant = (x >> (exp + 3)) & 0x0f;
    out[i] = ~(sign | (exp << 4) | mant) & 0xff;
  }
  return out;
}
function muDecode(u) {
  const out = new Float32Array(u.length);
  for (let i = 0; i < u.length; i++) {
    const v = ~u[i] & 0xff;
    const sign = v & 0x80, exp = (v >> 4) & 7, mant = v & 0x0f;
    let x = ((mant << 3) + 132) << exp;
    x -= 132;
    out[i] = (sign ? -x : x) / 32635;
  }
  return out;
}

export class VoiceMesh {
  constructor({ roomId, uid, name, onState }) {
    Object.assign(this, { roomId, uid, name, onState });
    this.sid = rid();
    this.conns = {}; // otherUid → { pc, key, remoteSid, caller, answered, pendingIce, unsubCand, audio, state }
    this.unsubs = [];
    this.levels = {};
    this.muted = false;
    this.closed = false;
    this.fresh = makeFreshness();
    this.tries = {};
  }

  emit() {
    if (this.closed) return;
    const conns = {};
    const via = {};
    Object.entries(this.conns).forEach(([u, c]) => { conns[u] = c.slow && c.state !== "connected" ? "failed" : c.state || "new"; if (c.via) via[u] = c.via; });
    const levels = { ...this.levels };
    const now = Date.now();
    Object.entries(this.relayLevel || {}).forEach(([u, l]) => { if (!this.direct(u) && now < l.until + 150) levels[u] = l.v; });
    // con chi non c'è il diretto, la voce passa dal server: per l'interfaccia è "collegato via server"
    Object.keys(this.peerSids || {}).forEach((u) => { if (!this.direct(u)) { conns[u] = "relay"; via[u] = "server"; } });
    this.onState?.({ conns, via, turn: !!this.turn, levels });
  }

  async join() {
    // l'AudioContext va creato SUBITO, dentro il tocco (iPhone/Android lo lasciano sospeso se nasce dopo un await)
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = AC ? new AC() : null;
    this.ctx?.resume?.().catch(() => {});
    const icePromise = loadIce();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    this.track = this.stream.getAudioTracks()[0];
    const ice = await icePromise;
    this.ice = ice.servers; this.turn = ice.turn;
    this.watchLevel(this.uid, this.stream);
    this.startRelay();
    this.audioBox = document.createElement("div");
    this.audioBox.style.display = "none";
    document.body.appendChild(this.audioBox);

    await this.beat();
    this.beatT = setInterval(() => this.beat(), BEAT_MS);
    this.unsubs.push(onSnapshot(peersCol(this.roomId), (s) => this.reconcile(s.docs.map((d) => ({ uid: d.id, ...d.data() })))));
    this.unsubs.push(onSnapshot(linksCol(this.roomId), (s) => s.docs.forEach((d) => this.onLink(d.id, d.data()))));
    this.levelT = setInterval(() => this.emit(), 200);
    this.staleT = setInterval(() => { if (this.lastPeers) this.reconcile(this.lastPeers); }, 10000);
    this.onHide = () => { if (document.visibilityState === "visible") this.ctx?.resume?.(); };
    document.addEventListener("visibilitychange", this.onHide);
  }

  /* ── voce via server ── */
  // serve il server con questo peer? sì finché il collegamento diretto non è aperto
  direct(u) { return this.conns[u]?.state === "connected"; }
  needRelay() { return Object.keys(this.peerSids || {}).some((u) => !this.direct(u)); }

  startRelay() {
    if (!this.ctx) return;
    this.relayBuf = [];
    this.relayN = 0;
    this.relaySeq = 0;
    this.relaySent = [];
    this.relayPlay = {};
    this.relayLevel = {};
    this.relayUsed = {};
    try {
      const src = this.ctx.createMediaStreamSource(this.stream);
      const proc = this.ctx.createScriptProcessor(4096, 1, 1);
      const mute = this.ctx.createGain(); mute.gain.value = 0;
      src.connect(proc); proc.connect(mute); mute.connect(this.ctx.destination);
      const ratio = this.ctx.sampleRate / RELAY_RATE;
      proc.onaudioprocess = (e) => {
        if (this.closed || !this.track?.enabled || !this.needRelay()) { this.relayBuf = []; this.relayN = 0; return; }
        const inp = e.inputBuffer.getChannelData(0);
        const n = Math.floor(inp.length / ratio);
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) out[i] = inp[Math.floor(i * ratio)];
        this.relayBuf.push(out); this.relayN += n;
        if (this.relayN >= RELAY_CHUNK) {
          const all = new Float32Array(this.relayN);
          let o = 0; this.relayBuf.forEach((b) => { all.set(b, o); o += b.length; });
          this.relayBuf = []; this.relayN = 0;
          this.sendChunk(all);
        }
      };
      this.relayNodes = [src, proc, mute];
    } catch (er) { this.relayErr = String(er?.message || er); }
    let first = true;
    this.unsubs.push(onSnapshot(audioCol(this.roomId), (snap) => {
      if (first) { first = false; return; } // i pezzetti vecchi non si riproducono
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const d = ch.doc.data();
        if (!d || d.from === this.uid || d.sid === this.sid) return;
        if (this.direct(d.from)) return; // con lui c'è il collegamento diretto: niente doppione
        this.playChunk(d.from, d);
      });
    }, (er) => { this.relayErr = `ascolto:${er?.code || er?.message || er}`; }));
  }

  sendChunk(samples) {
    const now = Date.now();
    addDoc(audioCol(this.roomId), {
      from: this.uid, sid: this.sid, n: ++this.relaySeq, sr: RELAY_RATE, d: Bytes.fromUint8Array(muEncode(samples)),
    }).then((ref) => { this.relaySent.push({ ref, at: now }); })
      .catch((er) => { this.relayErr = `invio:${er?.code || er?.message || er}`; });
    // pulizia dei pezzetti vecchi
    while (this.relaySent.length && now - this.relaySent[0].at > RELAY_KEEP_MS) deleteDoc(this.relaySent.shift().ref).catch(() => {});
  }

  playChunk(from, d) {
    if (!this.ctx || this.speakersOff) return;
    try {
      const u = d.d?.toUint8Array ? d.d.toUint8Array() : new Uint8Array(d.d || []);
      if (!u.length) return;
      const f = muDecode(u);
      const sr = Number(d.sr) || RELAY_RATE;
      const buf = this.ctx.createBuffer(1, f.length, sr);
      buf.getChannelData(0).set(f);
      const node = this.ctx.createBufferSource();
      node.buffer = buf;
      node.connect(this.ctx.destination);
      const t = this.ctx.currentTime;
      const p = this.relayPlay[from] || (this.relayPlay[from] = { next: 0 });
      // troppo indietro o troppo avanti (pausa, rete lenta): si riparte dal margine
      if (p.next < t || p.next > t + 2) p.next = t + RELAY_LEAD_S;
      node.start(p.next);
      p.next += buf.duration;
      let sum = 0; for (let i = 0; i < f.length; i += 4) sum += f[i] * f[i];
      this.relayLevel[from] = { v: Math.sqrt(sum / (f.length / 4)), t: Date.now(), until: Date.now() + (p.next - t) * 1000 };
      this.relayUsed[from] = Date.now();
    } catch (er) { this.relayErr = `play:${er?.message || er}`; }
  }

  // riga di diagnostica per ogni collegamento (si vede nel pannello di TUTTI: campo `diag` del peer)
  diagOf() {
    const out = {};
    const fmt = (o) => Object.entries(o).map(([k, v]) => `${k[0]}${v}`).join("") || "-";
    Object.entries(this.conns).forEach(([u, c]) => {
      out[u] = `${c.caller ? "chiama" : "risponde"}#${c.tries} ${c.pc.connectionState}/${c.pc.iceConnectionState} sig:${c.pc.signalingState} miei:${fmt(c.loc)} suoi:${fmt(c.rem)}${c.answered ? " ✓risp" : ""}${c.via ? ` ${c.via}` : ""}${c.err ? ` ERR ${c.err}` : ""}`.slice(0, 220);
    });
    if (this.relayErr) out._relay = `ERR ${this.relayErr}`.slice(0, 160);
    Object.entries(this.relayUsed || {}).forEach(([u, t]) => { out[u] = `${out[u] || ""} · server ${Math.round((Date.now() - t) / 1000)}s fa`; });
    return out;
  }

  beat() {
    return setDoc(doc(peersCol(this.roomId), this.uid), { name: this.name || "", sid: this.sid, at: Date.now(), muted: this.muted, diag: this.diagOf(), turn: !!this.turn, ua: navigator.userAgent.slice(0, 120) }).catch(() => {});
  }

  setMicOn(on) {
    if (this.track) this.track.enabled = !!on;
    const muted = !on;
    if (muted !== this.muted) {
      this.muted = muted;
      updateDoc(doc(peersCol(this.roomId), this.uid), { muted }).catch(() => {});
    }
  }

  // alcuni telefoni bloccano l'audio partito senza un tocco: ogni tocco sui tasti della voce lo risblocca
  unlockAudio() {
    this.ctx?.resume?.().catch(() => {});
    Object.values(this.conns).forEach((c) => { if (c.audio?.paused) c.audio.play?.().catch(() => {}); });
  }

  setSpeakersOn(on) {
    this.speakersOff = !on;
    Object.values(this.conns).forEach((c) => { if (c.audio) c.audio.muted = !on; });
  }

  reconcile(peers) {
    if (this.closed) return;
    const now = Date.now();
    this.lastPeers = peers;
    const live = this.fresh(peers, now).filter((p) => p.uid !== this.uid && p.sid);
    this.peerSids = Object.fromEntries(live.map((p) => [p.uid, p.sid]));
    // chi non c'è più: chiudi
    Object.keys(this.conns).forEach((u) => { if (!live.some((p) => p.uid === u)) this.drop(u); });
    live.forEach((p) => {
      const c = this.conns[p.uid];
      if (c && c.remoteSid === p.sid && c.state !== "failed") return;
      if (c) this.drop(p.uid);
      if (this.uid < p.uid) this.call(p);
    });
    this.emit();
  }

  makePc(other, key, remoteSid, caller) {
    const pc = new RTCPeerConnection({ iceServers: this.ice || STUN });
    const conn = { pc, key, remoteSid, caller, answered: false, pendingIce: [], state: "connecting", loc: {}, rem: {}, tries: (this.tries[other] = (this.tries[other] || 0) + 1), err: "" };
    // guardiano: se dopo CONNECT_TIMEOUT_MS non è collegato, chi chiama rifà tutto (offerta nuova)
    conn.watch = setTimeout(() => {
      if (this.conns[other] !== conn || conn.state === "connected") return;
      conn.slow = true;
      console.warn("[voce] collegamento con", other, "fermo su", pc.connectionState, "/", pc.iceConnectionState, "· riprovo");
      if (caller) { this.drop(other); this.retry(other); }
      this.emit();
    }, CONNECT_TIMEOUT_MS);
    this.conns[other] = conn;
    this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream));
    const linkRef = doc(linksCol(this.roomId), pairId(this.uid, other));
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const ty = e.candidate.type || "?";
      conn.loc[ty] = (conn.loc[ty] || 0) + 1;
      addDoc(collection(linkRef, "cand"), { from: this.uid, key, c: e.candidate.toJSON() }).catch((er) => { conn.err = `cand:${er?.code || er?.message || er}`; });
    };
    pc.ontrack = (e) => {
      if (conn.audio) return;
      const a = document.createElement("audio");
      a.autoplay = true; a.playsInline = true; a.muted = !!this.speakersOff;
      a.srcObject = e.streams[0] || new MediaStream([e.track]);
      this.audioBox.appendChild(a);
      a.play?.().catch(() => {});
      conn.audio = a;
      this.watchLevel(other, a.srcObject);
    };
    pc.onconnectionstatechange = () => {
      conn.state = pc.connectionState;
      if (pc.connectionState === "connected") {
        conn.slow = false;
        // diretto o via ponte (TURN)? lo dice la coppia di candidati scelta
        pc.getStats().then((st) => {
          let pair = null;
          st.forEach((r) => { if (r.type === "candidate-pair" && (r.nominated || r.selected) && r.state === "succeeded") pair = r; });
          const loc = pair && st.get(pair.localCandidateId);
          const rem = pair && st.get(pair.remoteCandidateId);
          conn.via = loc?.candidateType === "relay" || rem?.candidateType === "relay" ? "ponte" : "diretto";
          this.emit();
        }).catch(() => {});
      }
      if (pc.connectionState === "failed" && caller) setTimeout(() => { if (this.conns[other] === conn) { this.drop(other); this.retry(other); } }, 1500);
      this.emit();
    };
    conn.unsubCand = onSnapshot(query(collection(linkRef, "cand"), where("key", "==", key)), (s) => {
      s.docChanges().forEach((ch) => {
        const d = ch.doc.data();
        if (ch.type !== "added" || d.from === this.uid) return;
        const ty = / typ (\w+)/.exec(d.c?.candidate || "")?.[1] || "?";
        conn.rem[ty] = (conn.rem[ty] || 0) + 1;
        if (pc.remoteDescription) pc.addIceCandidate(d.c).catch(() => {});
        else conn.pendingIce.push(d.c);
      });
    });
    return conn;
  }

  flushIce(conn) {
    conn.pendingIce.forEach((c) => conn.pc.addIceCandidate(c).catch(() => {}));
    conn.pendingIce = [];
  }

  async call(peer) {
    // chiave NUOVA a ogni tentativo (2026-11-05): prima era sid_sid e dopo un tentativo fallito
    // l'altro telefono ignorava la nuova offerta ("già vista") → "collego" per sempre
    const key = `${this.sid}_${peer.sid}_${rid()}`;
    const conn = this.makePc(peer.uid, key, peer.sid, true);
    try {
      const offer = await conn.pc.createOffer();
      await conn.pc.setLocalDescription(offer);
      await setDoc(doc(linksCol(this.roomId), pairId(this.uid, peer.uid)), {
        caller: this.uid, callee: peer.uid, callerSid: this.sid, calleeSid: peer.sid, key,
        offer: { type: offer.type, sdp: offer.sdp }, answer: null, at: Date.now(),
      });
    } catch (er) { conn.state = "failed"; conn.err = `offer:${er?.message || er}`; this.emit(); }
  }

  // collegamento fallito: chi chiama riprova col sid noto dell'altro
  retry(other) {
    const sid = this.peerSids?.[other];
    if (sid && this.uid < other && !this.closed) this.call({ uid: other, sid });
  }

  async onLink(id, d) {
    if (this.closed || !d) return;
    // risposta a una NOSTRA chiamata
    if (d.caller === this.uid && d.callerSid === this.sid && d.answer) {
      const conn = this.conns[d.callee];
      if (conn && conn.key === d.key && !conn.answered) {
        conn.answered = true;
        try { await conn.pc.setRemoteDescription(d.answer); this.flushIce(conn); } catch (er) { conn.err = `remote:${er?.message || er}`; }
      }
      return;
    }
    // chiamata in arrivo per questa sessione
    if (d.callee === this.uid && d.calleeSid === this.sid && d.offer && !d.answer) {
      const key = d.key;
      if (!key || this.conns[d.caller]?.key === key) return;
      if (this.conns[d.caller]) this.drop(d.caller);
      const conn = this.makePc(d.caller, key, d.callerSid, false);
      try {
        await conn.pc.setRemoteDescription(d.offer);
        this.flushIce(conn);
        const answer = await conn.pc.createAnswer();
        await conn.pc.setLocalDescription(answer);
        await updateDoc(doc(linksCol(this.roomId), id), { answer: { type: answer.type, sdp: answer.sdp } });
      } catch (er) { conn.state = "failed"; conn.err = `answer:${er?.message || er}`; this.emit(); }
    }
  }

  watchLevel(who, stream) {
    if (!this.ctx) return;
    try {
      const src = this.ctx.createMediaStreamSource(stream);
      const an = this.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const read = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        return Math.sqrt(sum / buf.length);
      };
      (this.meters = this.meters || {})[who] = read;
      clearInterval(this.meterT);
      this.meterT = setInterval(() => {
        Object.entries(this.meters).forEach(([u, r]) => {
          const mine = u === this.uid;
          this.levels[u] = mine && this.track && !this.track.enabled ? 0 : r();
        });
      }, 120);
    } catch { /* niente */ }
  }

  drop(other) {
    const c = this.conns[other];
    if (!c) return;
    c.unsubCand?.();
    clearTimeout(c.watch);
    try { c.pc.close(); } catch { /* niente */ }
    c.audio?.remove();
    delete this.conns[other];
    if (this.meters) delete this.meters[other];
    delete this.levels[other];
  }

  async leave() {
    this.closed = true;
    clearInterval(this.beatT); clearInterval(this.levelT); clearInterval(this.meterT); clearInterval(this.staleT);
    document.removeEventListener("visibilitychange", this.onHide);
    this.unsubs.forEach((u) => u());
    Object.keys(this.conns).forEach((u) => this.drop(u));
    (this.relayNodes || []).forEach((n) => { try { n.disconnect(); } catch { /* niente */ } });
    (this.relaySent || []).forEach((x) => deleteDoc(x.ref).catch(() => {}));
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioBox?.remove();
    this.ctx?.close?.().catch(() => {});
    await deleteDoc(doc(peersCol(this.roomId), this.uid)).catch(() => {});
  }
}
