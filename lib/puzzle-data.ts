// Generated from engine self-play. Every mate puzzle is verified: the mating line is forced.
// Every "win material" puzzle has a first move at least 2 pawns better than any alternative (accepted lists near-equal moves).
import type { Puzzle } from "./puzzles";

export const PUZZLES: Puzzle[] = [
 {
  "id": 1,
  "fen": "3qkb2/1p1Npbr1/8/rB1pnppp/8/1R2PPPP/P1PP3R/2BQK3 w - - 1 22",
  "theme": "mate1",
  "solution": [
   "d7f6"
  ]
 },
 {
  "id": 2,
  "fen": "3qkbr1/1p1Npb2/8/rB1pnppp/8/BR2PPPP/P1PP3R/3QK3 w - - 3 23",
  "theme": "mate1",
  "solution": [
   "d7f6"
  ]
 },
 {
  "id": 3,
  "fen": "rnbqkbnr/p2pp2p/1pp2p2/6p1/P7/1PN1P1PP/2PP1P2/R1BQKBNR w KQ - 2 7",
  "theme": "mate1",
  "solution": [
   "d1h5"
  ]
 },
 {
  "id": 4,
  "fen": "Q4bk1/1p1p4/7n/2B1PpN1/P1P5/1P1PP2B/3K3P/R6R w - - 3 32",
  "theme": "mate1",
  "solution": [
   "a8f8"
  ]
 },
 {
  "id": 5,
  "fen": "rnbqk1nr/1p1pb1pp/8/p1pQ4/2B3p1/1P2P2P/PBP2P2/RN2K1NR w KQkq - 0 11",
  "theme": "mate1",
  "solution": [
   "d5f7"
  ]
 },
 {
  "id": 6,
  "fen": "2k2b2/r2n3R/P2P2Q1/P2K4/2B3P1/7N/1P3P2/8 w - - 5 39",
  "theme": "mate1",
  "solution": [
   "g6e8"
  ]
 },
 {
  "id": 7,
  "fen": "r1bqkbnr/pp1pp3/n4p1p/2p3p1/2P5/P3P2P/RP1P1PP1/1NBQKBNR w Kkq c6 0 6",
  "theme": "mate1",
  "solution": [
   "d1h5"
  ]
 },
 {
  "id": 8,
  "fen": "rnbqkbnr/1p1pp2p/5p2/p1p3p1/P3P3/8/1PPP1PPP/RNBQKBNR w KQkq a6 0 5",
  "theme": "mate1",
  "solution": [
   "d1h5"
  ]
 },
 {
  "id": 9,
  "fen": "3r1Q1q/2kBp3/4P3/pPpP1p2/p1K2pPr/3n2Pp/R2R3P/1N6 b - - 1 44",
  "theme": "mate1",
  "solution": [
   "h8d4"
  ]
 },
 {
  "id": 10,
  "fen": "k2r4/4p3/B3P3/pPpP1p2/R1K3Pr/q4pPp/Q1nR3P/1N6 b - - 9 52",
  "theme": "mate1",
  "solution": [
   "c2e3"
  ]
 },
 {
  "id": 11,
  "fen": "3k4/3p1q2/6p1/4P2p/4B2P/4p3/1p2N2r/bR1b2K1 b - - 4 53",
  "theme": "mate1",
  "solution": [
   "f7f2"
  ]
 },
 {
  "id": 12,
  "fen": "8/2k2p1r/4pP2/1pn4p/7P/3nP3/r5B1/3R1KR1 b - - 3 47",
  "theme": "mate1",
  "solution": [
   "a2f2"
  ]
 },
 {
  "id": 13,
  "fen": "rnb1kbnr/1pq1pppp/p1p5/3p4/7P/BPP2P2/P2PP1P1/RN1QKBNR b KQkq - 2 5",
  "theme": "mate1",
  "solution": [
   "c7g3"
  ]
 },
 {
  "id": 14,
  "fen": "4kb2/3qp3/1p2b3/2p1p3/p1B1N1P1/PP2nP2/R1P4r/2B1K2R b - - 1 22",
  "theme": "mate1",
  "solution": [
   "d7d1"
  ]
 },
 {
  "id": 15,
  "fen": "4kb2/3qp3/1p6/2p1p3/P1b1N1P1/P3KP2/8/2r5 b - - 1 28",
  "theme": "mate1",
  "solution": [
   "d7d4"
  ]
 },
 {
  "id": 16,
  "fen": "7R/1P2k3/p3p3/P1NpB3/P5P1/R7/3N1P2/4K3 w - - 1 46",
  "theme": "mate2",
  "solution": [
   "h8h7",
   "e7d8",
   "b7b8q"
  ]
 },
 {
  "id": 17,
  "fen": "4Q3/Bb1B2k1/pP6/3p2P1/1P1P1K2/8/R1P5/8 w - - 1 49",
  "theme": "mate2",
  "solution": [
   "d7e6",
   "g7h7",
   "e8g8"
  ]
 },
 {
  "id": 18,
  "fen": "B3nr2/3kP3/P1R2p1p/P4N2/7P/2PpPp2/5K1R/8 w - - 1 40",
  "theme": "mate2",
  "solution": [
   "e7f8q",
   "d3d2",
   "f8e7"
  ]
 },
 {
  "id": 19,
  "fen": "1r6/1bn1Bk1r/2p1pPRP/p4p1p/p2P1P1P/1P3N2/2P1K3/2RQ1B2 w - - 1 28",
  "theme": "mate2",
  "solution": [
   "f3e5",
   "f7e8",
   "g6g8"
  ]
 },
 {
  "id": 20,
  "fen": "2kr4/8/8/1PP2p1Q/5BPP/P3R3/3RP3/5K2 w - - 1 55",
  "theme": "mate2",
  "solution": [
   "d2d8",
   "c8d8",
   "h5e8"
  ]
 },
 {
  "id": 21,
  "fen": "3k4/5R2/p2pPN2/P1p3p1/2P1P3/r7/5K1P/8 w - - 1 46",
  "theme": "mate2",
  "solution": [
   "e6e7",
   "d8c7",
   "e7e8q"
  ]
 },
 {
  "id": 22,
  "fen": "3k2B1/6b1/3p1p1r/8/1PQP1P1p/P7/1B2PR2/2R1K3 w - - 0 37",
  "theme": "mate2",
  "solution": [
   "c4e6",
   "g7f8",
   "c1c8"
  ]
 },
 {
  "id": 23,
  "fen": "3k3r/8/2n5/p2N1B1P/6pP/Q2P4/2P2P2/3K1NR1 w - - 3 45",
  "theme": "mate2",
  "solution": [
   "a3d6",
   "d8e8",
   "f5g6"
  ]
 },
 {
  "id": 24,
  "fen": "1n2k3/Q2b3p/p1p1p1pn/P2pp1q1/2N1P3/3P3P/1PP1K3/1RB2r2 b - - 3 30",
  "theme": "mate2",
  "solution": [
   "g5g2",
   "e2e3",
   "g2f2"
  ]
 },
 {
  "id": 25,
  "fen": "3k4/3p4/6p1/4P2p/2q1B2P/4p3/1p2N2r/bR1b1K2 b - - 2 52",
  "theme": "mate2",
  "solution": [
   "c4e2",
   "f1g1",
   "e2f2"
  ]
 },
 {
  "id": 26,
  "fen": "r1b1q1nr/3p1k2/pppbpP2/P5Bp/3n4/1P3N2/R1P1QPPP/1N2KB1R w K - 1 18",
  "theme": "tactic",
  "solution": [
   "f3d4"
  ],
  "accepted": [
   "f3d4"
  ]
 },
 {
  "id": 27,
  "fen": "rnbqkb1r/1pp5/4pp2/pP1p2p1/2PPP1np/5N1P/P2N1PP1/R1BQKB1R w KQkq - 1 11",
  "theme": "tactic",
  "solution": [
   "h3g4"
  ],
  "accepted": [
   "h3g4"
  ]
 },
 {
  "id": 28,
  "fen": "rn3kr1/q4p2/pnpbp1pp/1p2Q3/PPPP1PbP/N4NPR/1B1KP3/R4B2 w - - 0 25",
  "theme": "tactic",
  "solution": [
   "e5d6"
  ],
  "accepted": [
   "e5d6"
  ]
 },
 {
  "id": 29,
  "fen": "2bqk2r/r1ppbpp1/1p3n1p/1P2p2P/p2n2P1/P1PPBP2/2Q1P3/R1N1KBNR w KQ - 1 17",
  "theme": "tactic",
  "solution": [
   "c3d4"
  ],
  "accepted": [
   "c3d4"
  ]
 },
 {
  "id": 30,
  "fen": "2bqk2r/r1pp1pp1/1p3n1p/1P2p2P/pb1P2P1/P2PBP2/2Q1P3/R1N1KBNR w KQ - 1 18",
  "theme": "tactic",
  "solution": [
   "a3b4"
  ],
  "accepted": [
   "a3b4"
  ]
 },
 {
  "id": 31,
  "fen": "rnbq1bnr/1pNppk2/5pp1/p1p4p/5B2/3P1P2/PPP1P1PP/R2QKBNR w KQ - 2 7",
  "theme": "tactic",
  "solution": [
   "c7a8"
  ],
  "accepted": [
   "c7a8"
  ]
 },
 {
  "id": 32,
  "fen": "2r1k2r/2pp1p2/1pb5/p1qNpB1p/1PP1PN1P/2B1KPP1/5R2/3R4 w - - 4 33",
  "theme": "tactic",
  "solution": [
   "b4c5"
  ],
  "accepted": [
   "b4c5"
  ]
 },
 {
  "id": 33,
  "fen": "1nbqk2r/r2p3p/p5p1/1pbB2B1/PPnp2PP/R2Q1P2/2PR4/1N2K3 w - - 4 25",
  "theme": "tactic",
  "solution": [
   "g5d8"
  ],
  "accepted": [
   "g5d8"
  ]
 },
 {
  "id": 34,
  "fen": "1n2kr2/rb1pb2p/p5p1/qp1B2B1/PP1Q2PP/R4P2/1nP4R/1N3K2 w - - 1 30",
  "theme": "tactic",
  "solution": [
   "b4a5"
  ],
  "accepted": [
   "b4a5"
  ]
 },
 {
  "id": 35,
  "fen": "1n1k4/4p1b1/1rpp1npr/p6p/PpPPNPqP/4P3/1PQ1B2R/1RBK4 b - - 13 25",
  "theme": "tactic",
  "solution": [
   "g4g1"
  ],
  "accepted": [
   "g4g1"
  ]
 },
 {
  "id": 36,
  "fen": "1n6/3k2b1/r1p1p2r/p2p1Q1p/PpPP1P1P/1P2P3/1B1KR3/1R3q2 b - - 1 33",
  "theme": "tactic",
  "solution": [
   "f1e2"
  ],
  "accepted": [
   "f1e2"
  ]
 },
 {
  "id": 37,
  "fen": "1n2r3/3p1k2/2b5/p2pPP2/r3p1NP/2P1P3/1R1B4/4K2R b - - 0 44",
  "theme": "tactic",
  "solution": [
   "a4a1"
  ],
  "accepted": [
   "a4a1"
  ]
 },
 {
  "id": 38,
  "fen": "r1b3nr/2p2kp1/1p1b1q2/p2ppp1p/3n1P1P/1QPP2B1/PP2PNP1/RN2KBR1 b Q - 5 13",
  "theme": "tactic",
  "solution": [
   "d4b3"
  ],
  "accepted": [
   "d4b3"
  ]
 },
 {
  "id": 39,
  "fen": "5rnr/1b3kp1/1p1b1q2/2pppp1p/p1QP1P1P/1P1P2B1/P3PNP1/RN2KBR1 b Q - 2 17",
  "theme": "tactic",
  "solution": [
   "d5c4"
  ],
  "accepted": [
   "d5c4"
  ]
 },
 {
  "id": 40,
  "fen": "rn1qkb1r/pb1ppppp/5n2/1pp4Q/P3P3/3B3N/1PPP1PPP/RNB1K2R b KQkq - 1 5",
  "theme": "tactic",
  "solution": [
   "f6h5"
  ],
  "accepted": [
   "f6h5"
  ]
 },
 {
  "id": 41,
  "fen": "r3kb1r/1b2pppp/p2n4/3p1B2/PP6/B1P3P1/2P2N1P/RN1K4 b kq - 0 18",
  "theme": "tactic",
  "solution": [
   "d6f5"
  ],
  "accepted": [
   "d6f5"
  ]
 }
];
