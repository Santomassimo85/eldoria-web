# App Android — guscio Capacitor (2026-09-15)

L'APK **non contiene il sito**: è un guscio (Capacitor, cartella `android/`) che apre
`https://eldoria-web-delta.vercel.app` in una WebView e aggiunge le **notifiche push di
sistema** (Firebase Cloud Messaging nativo). Ogni deploy del sito è subito visibile
nell'app: l'APK va ricostruito **solo** quando cambia qualcosa in `android/` o in
`capacitor.config.json` (icona, nome, plugin, permessi).

Su iPhone e altri dispositivi resta tutto com'era: sito/PWA con web push (su iPhone
dopo "Aggiungi alla schermata Home").

## Dove si scarica
`https://eldoria-web-delta.vercel.app/app/crit-happens.apk` (file in `public/app/`).
Il link compare anche in **Notifiche** (`/notifications`) a chi apre il sito da un
browser Android. Installazione: consentire "origini sconosciute" quando Android lo chiede.

## Notifiche: come funzionano
- Interruttore in `/notifications` (`src/components/PushToggle.jsx`), **per dispositivo**
  (scelta in `localStorage`, chiave `ch_push_pref`). Stesso componente su web, PWA e app.
- Logica unica in `src/push/pushClient.js`: sul web usa FCM via service worker + VAPID,
  nell'app usa il plugin nativo `@capacitor/push-notifications`. In entrambi i casi il
  token finisce in `characters/{uid}.fcmTokens`; la Cloud Function `sendPush`
  (`functions/index.js`) manda a tutti i token, con blocco `notification` + `android`
  per l'app e `webpush` per il browser.
- Al login (`NotificationOptIn.jsx`) il token viene rinnovato se la scelta è "on";
  nell'app, la prima volta, chiede subito il permesso.
- Tocco sulla notifica nell'app → evento `ch-push-open` → navigazione a `data.url`.

## Ricostruire l'APK (Windows, questa macchina)
Prerequisiti già presenti: JDK 21 (`C:\Program Files\Microsoft\jdk-21.0.7.6-hotspot`),
Android SDK in `%LOCALAPPDATA%\Android\Sdk` (cmdline-tools, platform 35, build-tools 35),
`android/local.properties` con `sdk.dir`. Il `webDir` è `www-shell/` (pagina vuota): dentro l’APK NON finisce `dist/`, altrimenti peserebbe 480 MB.

```powershell
# (niente build del sito: il guscio carica www-shell/, una pagina vuota; il contenuto è remoto)
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.7.6-hotspot"
cd android; .\gradlew.bat assembleRelease; cd ..
Copy-Item android\app\build\outputs\apk\release\app-release.apk public\app\crit-happens.apk
```
Poi commit + push: Vercel pubblica il nuovo APK. Prima di ricostruire alza `versionCode`
(e `versionName`) in `android/app/build.gradle`, altrimenti Android non aggiorna.

Script comodi: `npm run android:sync` e `npm run android:apk`.

## File NON versionati (repo pubblico) — da tenere al sicuro
- `android/keystore/crit-happens.jks` + `android/keystore.properties`: la **firma**.
  Senza lo stesso keystore un nuovo APK non si installa sopra quello vecchio (bisogna
  disinstallare). **Fare un backup** fuori dal PC.
- `android/app/google-services.json`: config Firebase dell'app Android
  (`firebase apps:sdkconfig ANDROID 1:500537293803:android:6b4ed2c43db1a57cd037ae`
  la ristampa quando serve).
- `android/local.properties`: percorso SDK.

## Icone
Sorgenti in `assets/` (icon.png, icon-foreground.png, icon-background.png, splash*.png),
generate dal logo del sito. Rigenerare con
`npx @capacitor/assets generate --android --iconBackgroundColor "#0b0a0d" --splashBackgroundColor "#0b0a0d"`.
L'icona bianca della barra di stato è `res/drawable-*/ic_stat_notify.png`
(dichiarata nel manifest come `default_notification_icon`).
