// Kopiert die benötigten Salamander-Piano-Samples aus node_modules nach public/samples/piano.
// Nur Oktaven 2–6 (+ C7): reicht für alle geplanten Stufen und hält den Download klein.
// Quelle: Salamander Grand Piano V3, Alexander Holm, CC BY 3.0 (Quellenangabe in der App).
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const src = 'node_modules/@audio-samples/piano-mp3-velocity8/audio'
const dst = 'public/samples/piano'
mkdirSync(dst, { recursive: true })

const wanted = readdirSync(src).filter((f) => {
  const m = /^([A-G]#?)(\d)v8\.mp3$/.exec(f)
  if (!m) return false
  const oct = Number(m[2])
  return (oct >= 2 && oct <= 6) || f === 'C7v8.mp3'
})
// '#' im Dateinamen wird von Servern/CDNs unzuverlässig ausgeliefert: D#2v8.mp3 -> Ds2.mp3
const safeName = (f) => f.replace(/v8\.mp3$/, '.mp3').replace('#', 's')
for (const f of wanted) copyFileSync(`${src}/${f}`, `${dst}/${safeName(f)}`)
console.log(`${wanted.length} Samples nach ${dst} kopiert`)
