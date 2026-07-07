// Accesso agli strumenti DM: master principale + co-master.
// Unica fonte di verità per chi può usare i pannelli/strumenti del Master.
// (Lo Scriba resta gestito a parte: solo il master principale.)
export const MASTER_EMAIL = "santomassimo85@gmail.com";
export const CO_MASTER_EMAILS = ["ripperti96@gmail.com"];

// true se l'email è il master principale o un co-master.
export const isDmUser = (email) =>
  email === MASTER_EMAIL || CO_MASTER_EMAILS.includes(email);
