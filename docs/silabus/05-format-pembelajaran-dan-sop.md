# 5. Format Pembelajaran Mingguan dan SOP Mentor

## 5.1 Template dua sesi per minggu

| Segmen | Sesi 1 - konsep & guided practice | Sesi 2 - problem solving & feedback |
| --- | --- | --- |
| 0-15 menit | Retrieval quiz topik lama; 2-3 pertanyaan constraint/complexity. | Review error minggu lalu; pilih 1 counterexample/bug untuk dibedah. |
| 15-45 | Konsep inti + worked example; fokus invariant/state/correctness. | Timed problem 1-2: siswa bekerja independen. |
| 45-90 | Guided problems bertingkat dari contoh ke transfer. | Review solusi: baseline, alternatif, complexity, edge cases. |
| 90-115 | Independent problem + mentor observation. | Timed problem berikutnya / mini-contest. |
| 115-120 | Exit ticket: 3 poin yang dipahami + 1 gap. | Assign upsolve/re-solve dan target minggu berikutnya. |

## 5.2 SOP pengajaran setiap algoritma/struktur data

1. Mulai dari problem yang membutuhkan teknik tersebut, bukan definisi algoritma terlebih dahulu.
2. Minta siswa menulis constraint analysis dan baseline solution sebelum diperlihatkan solusi optimal.
3. Tentukan invariant/state/operasi yang harus didukung; baru pilih algoritma/struktur data.
4. Tulis complexity waktu dan memori sebelum coding.
5. Implementasikan dari pemahaman, bukan copy template; template boleh dipakai setelah siswa pernah membangun sendiri.
6. Uji minimal: contoh, batas minimum, batas maksimum konseptual, duplikasi, urutan buruk, overflow, disconnected/negative-edge bila relevan.
7. Setelah Accepted, wajib jawab: mengapa benar, mengapa cukup cepat, apa alternatifnya, dan kapan teknik ini tidak berlaku.

## 5.3 Aturan hint/editorial

> **Progressive hinting** - Gunakan urutan: pertanyaan pemodelan -> arah complexity -> observasi kunci -> pseudocode parsial -> editorial. Solusi penuh adalah opsi terakhir. Semua soal yang membutuhkan editorial wajib dire-solve tanpa bantuan pada interval berikutnya.

---

[Indeks](README.md) | Sebelumnya: [4. Silabus Operasional 28 Minggu](04-silabus-28-minggu.md) | Selanjutnya: [6. Sistem Evaluasi, Rubrik, dan KPI](06-evaluasi-rubrik-kpi.md)
