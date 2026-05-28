import { useEffect } from "react";

/**
 * Aggiorna la CSS variable --cine-scroll su window.scrollY senza re-render.
 * Usata dal sistema cinematic (hero + divisori parallax) condiviso fra le pagine.
 */
export default function useParallaxScroll() {
    useEffect(() => {
        let raf = 0;
        const update = () => {
            document.documentElement.style.setProperty("--cine-scroll", String(window.scrollY));
            raf = 0;
        };
        const onScroll = () => {
            if (raf) return;
            raf = requestAnimationFrame(update);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        update();
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (raf) cancelAnimationFrame(raf);
            document.documentElement.style.removeProperty("--cine-scroll");
        };
    }, []);
}
