import subprocess
import asyncio
import time
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes

TELEGRAM_TOKEN = "8601357522:AAEsLIp0W6v9AkuZt1f3bmoqZsDfUQMBWsA"
AUTHORIZED_USER_ID = 1842122464  # Metti il tuo Telegram user ID (vedi sotto come trovarlo)
PROJECT_PATH = r"C:\Users\KalEl\Desktop\PortfolioOrpheus\eldoria-web"  # La tua cartella progetto

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != AUTHORIZED_USER_ID:
        await update.message.reply_text("❌ Non autorizzato!")
        return

    user_message = update.message.text
    await update.message.reply_text(f"⚙️ Eseguo: {user_message}\n⏳ Attendere...")

    start_time = time.time()  # ← inizia timer

    try:
        result = subprocess.run(
            [r"C:\Users\KalEl\AppData\Roaming\npm\claude.CMD", 
             "--dangerously-skip-permissions", "--print", user_message],
            cwd=PROJECT_PATH,
            capture_output=True,
            text=True,
            timeout=300
        )

        elapsed = round(time.time() - start_time, 1)  # ← tempo impiegato

        output = result.stdout or result.stderr or "Nessun output"

        # Cerca i token nell'output (Claude Code li stampa alla fine)
        token_info = ""
        for line in output.split("\n"):
            if "token" in line.lower() or "cost" in line.lower():
                token_info += f"\n{line}"

        # Rimuovi le righe token dall'output principale
        clean_output = "\n".join([
            line for line in output.split("\n") 
            if "token" not in line.lower() and "cost" not in line.lower()
        ])

        if len(clean_output) > 3500:
            clean_output = clean_output[:3500] + "\n\n... (troncato)"

        # Messaggio finale con tutte le info
        response = (
            f"✅ Completato!\n"
            f"⏱️ Tempo: {elapsed}s\n"
            f"{token_info if token_info else ''}\n"
            f"{'─' * 20}\n"
            f"{clean_output}"
        )

        await update.message.reply_text(response)

    except subprocess.TimeoutExpired:
        elapsed = round(time.time() - start_time, 1)
        await update.message.reply_text(f"⏱️ Timeout dopo {elapsed}s — task troppo lungo!")
    except Exception as e:
        await update.message.reply_text(f"❌ Errore: {str(e)}")

if __name__ == "__main__":
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    print("🤖 Bot avviato! In ascolto su Telegram...")
    app.run_polling()