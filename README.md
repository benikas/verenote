# Gehörtraining

Mobile Web-App zum Gehörtraining (Konzept: `konzept.md` v2, Plan: `projektplan.md`).
Stack: Vite, Svelte 5, TypeScript, Tone.js, Tonal.js, Vitest. Kein Server, kein Login.

## Entwicklung

```sh
npm install
npm run dev        # Dev-Server
npm test           # Unit-Tests (Vitest)
npm run check      # Typprüfung
npm run build      # Produktions-Build nach dist/
npm run samples    # Klavier-Samples aus node_modules nach public/samples/piano kopieren
```

## Deployment

`.github/workflows/deploy.yml` baut bei jedem Push auf `main` und veröffentlicht auf GitHub Pages
(Repo-Einstellung: Pages, Source = GitHub Actions). `base: './'` macht den Build ortsunabhängig.

## Lizenzen

Klavier-Samples: Salamander Grand Piano V3 von Alexander Holm, CC BY 3.0
(<https://creativecommons.org/licenses/by/3.0/>). Die Quellenangabe steht im Start-Screen der App.
