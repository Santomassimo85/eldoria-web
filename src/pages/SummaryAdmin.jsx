// src/pages/SummaryAdmin.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../firebase"; // Assicurati che il percorso sia corretto
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useRef } from "react";
import HtmlToolbar from "../components/HtmlToolbar";

const MASTER_EMAIL = "santomassimo85@gmail.com";

// Stato iniziale del form (inclusa la data)
const initialFormData = {
  title: "",
  subTitle: "",
  party: "AMEA",
  content: "",
  order: "",
  date: "", // CAMPO DATA IN GIOCO
};

export default function SummaryAdmin() {
  const textAreaRef = useRef(null); // Aggiungi questo
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(initialFormData);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return (
      <p style={{ textAlign: "center", paddingTop: "100px" }}>
        Accesso negato: solo DM.
      </p>
    );
  }

  // --- CARICAMENTO RIASSUNTI ESISTENTI ---
  const fetchSummaries = async () => {
    setLoading(true);
    try {
      const summariesCollection = collection(db, "summaries");
      const summarySnapshot = await getDocs(summariesCollection);
      const summariesList = summarySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      setSummaries(summariesList);
    } catch (error) {
      setStatus(`❌ Errore nel caricamento: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  // --- GESTIONE FORM E SUBMIT ---
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setIsEditing(false);
    setEditingId(null);
    setStatus("");
  };

  // --- LOGICA DI ELIMINAZIONE ---
  const handleDelete = async (summaryId) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo riassunto?"))
      return;
    try {
      await deleteDoc(doc(db, "summaries", summaryId));
      setStatus(`✅ Riassunto eliminato con successo!`);
      fetchSummaries();
    } catch (error) {
      setStatus(`❌ Errore nell'eliminazione: ${error.message}`);
    }
  };

  // --- LOGICA DI CREAZIONE ---
  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      const summariesCollection = collection(db, "summaries");
      const docId = `${formData.party}_${Date.now()}`;

      await setDoc(doc(summariesCollection, docId), {
        ...formData,
        createdAt: new Date().toISOString(),
        order: Number(formData.order) || summaries.length + 1,
      });

      setStatus(`✅ Riassunto '${formData.title}' creato con successo!`);
      handleReset();
      setLoading(false);
      fetchSummaries();
    } catch (error) {
      setStatus(`❌ Errore nella creazione del riassunto: ${error.message}`);
      setLoading(false);
    }
  };

  // --- CARICA DATI NEL FORM PER LA MODIFICA ---
  const handleEdit = async (summaryId) => {
    setLoading(true);
    setStatus("");
    try {
      const summaryRef = doc(db, "summaries", summaryId);
      const summarySnap = await getDoc(summaryRef);

      if (summarySnap.exists()) {
        const data = summarySnap.data();
        setFormData(data);
        setIsEditing(true);
        setEditingId(summaryId);
      } else {
        setStatus("❌ Documento non trovato per la modifica.");
      }
    } catch (error) {
      setStatus(`❌ Errore nel caricamento per la modifica: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- SALVA LE MODIFICHE ---
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingId) return;

    setLoading(true);
    setStatus("");

    try {
      const summaryRef = doc(db, "summaries", editingId);

      await updateDoc(summaryRef, {
        title: formData.title,
        subTitle: formData.subTitle,
        party: formData.party,
        content: formData.content,
        order: Number(formData.order),
        date: formData.date, // SALVATAGGIO CAMPO DATA
        updatedAt: new Date().toISOString(),
      });

      setStatus(`✅ Riassunto '${formData.title}' aggiornato con successo!`);
      handleReset();
      setLoading(false);
      fetchSummaries();
    } catch (error) {
      setStatus(`❌ Errore nell'aggiornamento: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <section className="admin-summary-page">
      <Link to="/dm-admin" className="back-button">
        ← Dashboard Admin
      </Link>
      <h1>
        {isEditing
          ? "Modifica Riassunto Sessione"
          : "Aggiungi Riassunto Sessione"}
      </h1>

      {status && (
        <p
          className={`admin-status ${status.startsWith("✅") ? "success" : "error"}`}
        >
          {status}
        </p>
      )}

      <form
        onSubmit={isEditing ? handleUpdate : handleCreate}
        className="admin-form"
      >
        <div className="form-group">
          <label>Titolo:</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Sottotitolo (Obia):</label>
          <input
            type="text"
            name="subTitle"
            value={formData.subTitle}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group half-width">
          <label>Party:</label> <br />
          <select name="party" value={formData.party} onChange={handleChange}>
            <option value="AMEA">AMEA (Garroth, Tanagar, Caius, Sylva)</option>
            <option value="LAC">LAC (Horn, Thoki, Cleofe)</option>
            <option value="Unico">Storia del Mondo</option>
          </select>
        </div>

        {/* CAMPO DATA IN GIOCO */}
        <div className="form-group half-width">
          <label>Data (in gioco):</label>
          <input
            type="text"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group half-width">
          <label>Ordine (Numero):</label>
          <input
            type="number"
            name="order"
            value={formData.order}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Contenuto (HTML consentito):</label> <br />
          <HtmlToolbar
            textAreaRef={textAreaRef}
            formData={formData}
            setFormData={setFormData}
            fieldName="content"
          />
          <textarea
          ref={textAreaRef} // <--- QUESTO È FONDAMENTALE
            name="content"
            value={formData.content}
            onChange={handleChange}
            rows="10"
            required
          />
        </div>

        <div className="admin-form-actions">
          <button type="submit" className="admin-button" disabled={loading}>
            {loading
              ? "Caricamento..."
              : isEditing
                ? "Salva Modifiche"
                : "Crea Riassunto"}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={handleReset}
              className="admin-button reset-button"
            >
              Annulla Modifica
            </button>
          )}
        </div>
      </form>

      <hr style={{ margin: "40px 0" }} />

      <h3>Riassunti Esistenti:</h3>
      <div className="admin-item-list">
        {loading && !summaries.length ? (
          <p>Caricamento riassunti...</p>
        ) : (
          summaries.map((s) => (
            <div key={s.id} className="admin-item-row summary-row">
              <span>
                [{s.order}] {s.title} ({s.party})
              </span>
              <div className="admin-actions">
                <button
                  onClick={() => handleEdit(s.id)}
                  className="admin-edit-button"
                >
                  Modifica
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="admin-delete-button"
                >
                  X
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
