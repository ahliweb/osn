# 7. Contoh Implementasi Praktis

## 7.1 Constraint menjadi kompleksitas

N <= 200.000. Siswa wajib menolak O(N^2) sebagai baseline produksi untuk operasi per elemen, menguji kandidat O(N log N) atau O(N), lalu memeriksa time limit, konstanta, dan memori. Output latihan: satu tabel constraint -> kandidat complexity -> alasan.

## 7.2 Memilih shortest path

Unweighted/sama bobot -> BFS; bobot non-negatif -> Dijkstra; edge negatif -> Bellman-Ford; all-pairs dan N kecil -> Floyd-Warshall. Siswa harus menjelaskan syarat berlaku sebelum coding.

## 7.3 Range query

N,Q <= 200.000 dengan point update + range sum. Prefix sum memiliki update mahal; Fenwick memberi O(log N) update/query; Segment Tree lebih fleksibel untuk agregasi. Siswa membuat matriks operasi sebelum memilih struktur.

## 7.4 Mendesain DP

Sebelum coding: definisikan state minimum, transition, base case, dependency/order, jumlah state x transition, reconstruction, dan kemungkinan compression. Knapsack/LCS/LIS diperlakukan sebagai contoh state design.

## 7.5 Strategi subtask OSN-P

N <= 20 -> brute force/bitmask; N <= 2.000 -> kemungkinan O(N^2); N <= 200.000 -> cari O(N log N)/O(N). Tujuan: amankan solusi benar untuk subtask kecil, lalu upgrade tanpa merusak correctness. [[R3]](99-referensi.md#r3)

## 7.6 Stress testing

Buat brute-force oracle untuk N kecil, random generator, lalu bandingkan solusi cepat vs oracle. Simpan counterexample minimal ketika berbeda. Terapkan khususnya pada DP, greedy, graph, dan data structure yang rawan edge case.

## 7.7 OSN-K tracing

Gunakan potongan C++ 10-20 baris dengan loop, array, function, recursion atau bitwise. Tugas siswa: output, state per iterasi, invariant sederhana, dan complexity tanpa menjalankan program. [[R2]](99-referensi.md#r2)

---

[Indeks](README.md) | Sebelumnya: [6. Sistem Evaluasi, Rubrik, dan KPI](06-evaluasi-rubrik-kpi.md) | Selanjutnya: [8. Perbandingan Lima Model/Kasus Pembinaan](08-perbandingan-model.md)
