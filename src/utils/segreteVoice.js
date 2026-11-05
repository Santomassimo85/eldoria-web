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
import { collection, doc, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, where } from "firebase/firestore";
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
const BEAT_MS = 15000;
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
  }

  emit() {
    if (this.closed) return;
    const conns = {};
    const via = {};
    Object.entries(this.conns).forEach(([u, c]) => { conns[u] = c.slow && c.state !== "connected" ? "failed" : c.state || "new"; if (c.via) via[u] = c.via; });
    this.onState?.({ conns, via, turn: !!this.turn, levels: { ...this.levels } });
  }

  async join() {
    const icePromise = loadIce();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    this.track = this.stream.getAudioTracks()[0];
    const ice = await icePromise;
    this.ice = ice.servers; this.turn = ice.turn;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = AC ? new AC() : null;
    this.watchLevel(this.uid, this.stream);
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

  beat() {
    return setDoc(doc(peersCol(this.roomId), this.uid), { name: this.name || "", sid: this.sid, at: Date.now(), muted: this.muted }).catch(() => {});
  }

  setMicOn(on) {
    if (this.track) this.track.enabled = !!on;
    const muted = !on;
    if (muted !== this.muted) {
      this.muted = muted;
      updateDoc(doc(peersCol(this.roomId), this.uid), { muted }).catch(() => {});
    }
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
    const conn = { pc, key, remoteSid, caller, answered: false, pendingIce: [], state: "connecting" };
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
      if (e.candidate) addDoc(collection(linkRef, "cand"), { from: this.uid, key, c: e.candidate.toJSON() }).catch(() => {});
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
    const key = `${this.sid}_${peer.sid}`;
    const conn = this.makePc(peer.uid, key, peer.sid, true);
    try {
      const offer = await conn.pc.createOffer();
      await conn.pc.setLocalDescription(offer);
      await setDoc(doc(linksCol(this.roomId), pairId(this.uid, peer.uid)), {
        caller: this.uid, callee: peer.uid, callerSid: this.sid, calleeSid: peer.sid,
        offer: { type: offer.type, sdp: offer.sdp }, answer: null, at: Date.now(),
      });
    } catch { conn.state = "failed"; this.emit(); }
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
      if (conn && conn.key === `${d.callerSid}_${d.calleeSid}` && !conn.answered) {
        conn.answered = true;
        try { await conn.pc.setRemoteDescription(d.answer); this.flushIce(conn); } catch { /* niente */ }
      }
      return;
    }
    // chiamata in arrivo per questa sessione
    if (d.callee === this.uid && d.calleeSid === this.sid && d.offer && !d.answer) {
      const key = `${d.callerSid}_${d.calleeSid}`;
      if (this.conns[d.caller]?.key === key) return;
      if (this.conns[d.caller]) this.drop(d.caller);
      const conn = this.makePc(d.caller, key, d.callerSid, false);
      try {
        await conn.pc.setRemoteDescription(d.offer);
        this.flushIce(conn);
        const answer = await conn.pc.createAnswer();
        await conn.pc.setLocalDescription(answer);
        await updateDoc(doc(linksCol(this.roomId), id), { answer: { type: answer.type, sdp: answer.sdp } });
      } catch { conn.state = "failed"; this.emit(); }
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
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioBox?.remove();
    this.ctx?.close?.().catch(() => {});
    await deleteDoc(doc(peersCol(this.roomId), this.uid)).catch(() => {});
  }
}
