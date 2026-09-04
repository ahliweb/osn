# 4. Silabus Operasional 28 Minggu

Baseline berikut dirancang untuk 28 minggu. Setiap minggu terdiri dari konsep terarah, worked examples, latihan terkurasi, review error, dan upsolve. Angka soal adalah kapasitas kerja internal, bukan ambang resmi kelulusan.

| Mg | Fokus | Isi utama | Capaian | Praktik/Evaluasi |
| --- | --- | --- | --- | --- |
| 1 | Orientasi CP & C++ dasar | Algoritma/pseudocode; I/O; variabel; tipe data; operator; integer overflow; format solusi. | Menulis program dasar, dry-run, membedakan int/long long. | 6-10 soal dasar + diagnosis OSN-K. |
| 2 | Control flow, fungsi, array/string | if/else; for/while; function; parameter; scope; array; string; STL dasar; debugging. | Menerjemahkan prosedur menjadi kode terstruktur. | 8-12 soal + 2 tracing. |
| 3 | Logika, bitwise & complexity | Boolean; truth table; bitwise; Big-O; waktu vs memori; constraint-driven selection. | Menolak solusi yang tidak feasible sebelum coding. | 8-12 soal + worksheet complexity. |
| 4 | Search/sort dasar & recursion | Linear/binary search; bubble/insertion; recursion; call stack; prefix sum support. | Memahami invariant sederhana, rekursi dasar, dan binary search. | 8-12 soal + Checkpoint 1. |
| 5 | Sorting lanjut & divide-and-conquer | Merge sort; quicksort; heapsort concept; divide-and-conquer; correctness intuition. | Membandingkan kompleksitas dan trade-off algoritma sorting. | 8-10 soal + implementasi 3 sort. |
| 6 | Complete search & pruning | Brute force sistematis; enumeration; recursion tree; pruning; backtracking. | Mendesain search space dan mengurangi cabang tidak perlu. | 8-12 soal, termasuk N kecil. |
| 7 | Greedy fundamentals | Greedy choice; ordering; interval/scheduling; counterexample; exchange argument sederhana. | Membedakan kapan greedy valid/tidak. | 8-12 soal + 2 proof sketches. |
| 8 | Problem solving integration I | Simulation; prefix sum; difference array; two pointers/sliding window sebagai support; mixed problems. | Menggabungkan teknik dasar tanpa pattern matching sempit. | Mini-contest + Checkpoint 2. |
| 9 | Number theory I | GCD/LCM; divisibility; prime; Sieve; factorization; modular arithmetic. | Menerapkan teori bilangan dasar pada constraint nyata. | 8-12 soal. |
| 10 | Number theory II & bit patterns | Fast exponentiation; modular power; set concepts; parity; bit masks dasar. | Menggunakan bit representation dan modular operations dengan aman. | 8-12 soal. |
| 11 | Combinatorics & probability | Rule of sum/product; permutation/combination; probability; Pascal/binomial. | Menghitung ruang solusi dan probabilitas sederhana. | 8-10 soal analitis + coding ringan. |
| 12 | Pigeonhole & inclusion-exclusion | Pigeonhole principle; inclusion-exclusion; sequences; Fibonacci; induction intuition. | Memilih prinsip hitung yang tepat pada soal reasoning. | OSN-K style set + Checkpoint 3. |
| 13 | Dynamic Programming I | State; transition; base case; memoization; tabulation; complexity. | Mendesain DP 1D/2D sederhana tanpa hafalan. | 8-10 soal. |
| 14 | Dynamic Programming II | Knapsack patterns; grid DP; coin change; reconstruction; space optimization. | Menghubungkan state design dengan constraint dan memori. | 8-10 soal + state worksheet. |
| 15 | DP sequence & optimization thinking | LIS/LCS sebagai contoh; alternative O(N^2) vs O(N log N) untuk LIS; DP correctness. | Membandingkan beberapa formulation dan trade-off. | 8-10 soal. |
| 16 | DP integration | Mixed DP; interval/bitmask intro bila siap; debugging DP; edge cases. | Mampu menjelaskan state-transition-complexity sebelum coding. | Mini-contest + Checkpoint 4. |
| 17 | Graph fundamentals | Directed/undirected; weighted/unweighted; adjacency list/matrix/edge list; BFS/DFS; connectivity. | Membangun model graph dari cerita dan memilih representasi. | 8-12 soal. |
| 18 | Shortest path | BFS shortest path; Dijkstra; Bellman-Ford; Floyd-Warshall; negative edge/cycle. | Memilih algoritma shortest path sesuai tipe bobot dan N. | 8-10 soal + selection matrix. |
| 19 | Tree & LCA | Rooted tree; parent/depth; traversal; subtree thinking; LCA concept/implementation sesuai level. | Menguasai tree traversal dan query ancestor dasar. | 8-10 soal. |
| 20 | MST & graph integration | Prim; Kruskal; DSU connection; connectivity; graph mixed. | Mendesain solusi MST dan menjelaskan correctness intuitif. | Mini-contest + Checkpoint 5. |
| 21 | Core data structures I | Stack; queue; deque support; binary heap/priority_queue; set/map support. | Memilih struktur data berdasarkan operasi dan complexity. | 8-12 soal. |
| 22 | DSU & offline connectivity | Find/union; path compression; union by rank/size; Kruskal; connectivity. | Mengimplementasikan DSU dengan kompleksitas amortized yang sesuai. | 8-10 soal. |
| 23 | Fenwick Tree & Segment Tree | Point update/range query; prefix query; segment tree aggregation; trade-offs. | Memilih Fenwick vs Segment Tree dari matriks operasi. | 8-10 soal + implementation drill. |
| 24 | Geometry dasar & integration | Coordinates; distance; Pythagoras; line/segment/sudut; cross-product intuition; convex hull definition. | Menyelesaikan geometri dasar tanpa kehilangan precision. | OSN-style mixed + Checkpoint 6. |
| 25 | OSN-K intensive | Abstraksi CT; logical deduction; tracing C++; modeling; complexity; timed paper set. | Meningkatkan akurasi dan kecepatan analitis. | 2 simulasi OSN-K + review. |
| 26 | OSN-P intensive | Studi kasus; subtask mudah/sulit; baseline; partial score; coding 3 jam. | Mengamankan poin, lalu meng-upgrade solusi. | 2 simulasi OSN-P + upsolve. |
| 27 | Nasional mixed contest | Mixed algorithm/data structure; implementation precision; stress testing; time allocation. | Menjaga performa pada contest panjang dan topik campuran. | 1-2 full contests + postmortem. |
| 28 | Final readiness & individualized repair | Weak-topic repair; re-solve C/B problems; template hygiene; contest strategy; readiness review. | Profil mastery akhir dan rencana lanjutan individual. | Final simulation + Checkpoint 7. |

## 4.1 Gate per fase

| Gate | Minimal evidence sebelum lanjut |
| --- | --- |
| Minggu 4 | Dapat coding dasar tanpa template berlebihan; memahami Big-O dasar; binary search/recursion sederhana; tracing C++. |
| Minggu 8 | Dapat complete search/backtracking/greedy dasar dan menjelaskan mengapa solusi feasible. |
| Minggu 12 | Dapat menggunakan number theory/combinatorics dasar dan menyelesaikan set OSN-K terukur. |
| Minggu 16 | Dapat merumuskan state-transition-base case-complexity DP sebelum implementasi. |
| Minggu 20 | Dapat memodelkan graph, memilih shortest path/MST, dan memakai tree traversal/LCA dasar. |
| Minggu 24 | Dapat memilih heap/DSU/Fenwick/Segment Tree berdasarkan operasi; geometri dasar stabil. |
| Minggu 28 | Menyelesaikan simulasi sesuai tahap target, melakukan postmortem dan upsolve mandiri. |

---

[Indeks](README.md) | Sebelumnya: [3. Struktur Kurikulum: Core, Support, dan Extension](03-struktur-kurikulum.md) | Selanjutnya: [5. Format Pembelajaran Mingguan dan SOP Mentor](05-format-pembelajaran-dan-sop.md)
