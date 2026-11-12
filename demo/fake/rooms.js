/* DEMO: "torna al gruppo" / "esci" = torna al menu della demo. */
const back = () => { window.dispatchEvent(new CustomEvent("demo:menu")); return Promise.resolve(); };
export const leaveRoom = back;
export const backToRoom = back;
