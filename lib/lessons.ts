export interface Lesson {
  id: string;
  title: string;
  body: string[];
  kind: "sandbox" | "puzzle" | "line";
  fen: string;
  solutions?: string[];                      // puzzle: accepted moves (e.g. "d5c7"); omit for mate-in-one
  moves?: { uci: string; note: string }[];   // line: a sequence of moves with a comment on each
}
export interface Section { title: string; intro: string; lessons: Lesson[] }

export const SECTIONS: Section[] = [
  {
    title: "How the pieces move",
    intro: "Tap a piece on each board to see every square it can legally reach. You can move either side, and Reset puts things back.",
    lessons: [
      { id: "rook", title: "The rook", kind: "sandbox", fen: "7k/8/8/3R4/8/8/8/K7 w - - 0 1",
        body: ["The rook slides any number of squares along a rank or file. It cannot jump over other pieces.", "Worth about five pawns. Rooks get strong once files open up."] },
      { id: "bishop", title: "The bishop", kind: "sandbox", fen: "7k/8/8/3B4/8/8/8/K7 w - - 0 1",
        body: ["The bishop slides diagonally, so it stays on one colour of square for the whole game. Each side starts with one bishop on light squares and one on dark.", "Worth about three pawns."] },
      { id: "queen", title: "The queen", kind: "sandbox", fen: "7k/8/8/3Q4/8/8/8/K7 w - - 0 1",
        body: ["The queen moves like a rook and a bishop combined. She is the strongest piece, worth about nine pawns.", "Because she is so valuable, avoid bringing her out early where she can be chased."] },
      { id: "knight", title: "The knight", kind: "sandbox", fen: "7k/8/8/3N4/8/8/8/K7 w - - 0 1",
        body: ["The knight moves in an L: two squares one way and one square sideways. It is the only piece that jumps over others.", "Worth about three pawns. Knights are best near the centre, where they reach the most squares."] },
      { id: "pawn", title: "The pawn", kind: "sandbox", fen: "7k/8/8/3p1p2/4P3/8/8/K7 w - - 0 1",
        body: ["Pawns move forward one square, or two from their starting rank. They capture one square diagonally forward, and they never move backward.", "Here the white pawn can capture either black pawn. Pawns also decide the shape of the whole position, so move them with care."] },
      { id: "king", title: "The king", kind: "sandbox", fen: "7k/8/8/8/3K4/8/8/8 w - - 0 1",
        body: ["The king moves one square in any direction, but never onto a square an enemy piece attacks.", "Protect your king first. The game is decided by whether a king can be trapped."] },
    ],
  },
  {
    title: "Special rules",
    intro: "A few moves break the usual patterns. Try each one on the board.",
    lessons: [
      { id: "castling", title: "Castling", kind: "sandbox", fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
        body: ["Castling moves the king two squares toward a rook, and the rook jumps to the other side of the king. It tucks the king away and brings a rook into play.", "It is allowed only if neither piece has moved, the squares between them are empty, and the king is not in check or passing through an attacked square. Tap the white king and pick g1 or c1."] },
      { id: "enpassant", title: "En passant", kind: "sandbox", fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
        body: ["When a pawn jumps two squares and lands beside an enemy pawn, that enemy pawn may capture it as if it had moved only one square. The option exists for one move only.", "Black has just played d7-d5. Tap the white pawn on e5 and capture on d6."] },
      { id: "promotion", title: "Promotion", kind: "sandbox", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
        body: ["A pawn that reaches the far rank becomes a queen, rook, bishop or knight. Almost always you choose a queen.", "On this site promotion picks a queen automatically. Move the a-pawn to a8."] },
      { id: "stalemate", title: "Check, checkmate and stalemate", kind: "sandbox", fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
        body: ["Check means the king is attacked, and you must respond at once. Checkmate means the king is attacked and there is no escape, which wins the game.", "Stalemate is the opposite trap: the side to move has no legal move but is not in check. The game is a draw. Black to move here is stalemated, so never leave your opponent with no moves unless you are giving mate."] },
    ],
  },
  {
    title: "Openings",
    intro: "Step through two common openings. The aim in every opening is the same.",
    lessons: [
      { id: "principles", title: "Italian Game", kind: "line", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        body: ["Opening principles: fight for the centre, develop your knights and bishops, castle early, and avoid moving the same piece twice or sending the queen out too soon.", "The Italian Game follows all of them."],
        moves: [
          { uci: "e2e4", note: "Take space in the centre and open lines for the queen and bishop." },
          { uci: "e7e5", note: "Black claims the centre in the same way." },
          { uci: "g1f3", note: "Develops a knight and attacks the e5 pawn." },
          { uci: "b8c6", note: "Black defends e5 and develops a knight." },
          { uci: "f1c4", note: "The bishop eyes f7, a sensitive square early in the game." },
          { uci: "f8c5", note: "Black develops the bishop to an equally active square. Both sides can castle soon." },
        ] },
      { id: "qg", title: "Queen's Gambit", kind: "line", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        body: ["A slower, strategic opening that starts with the queen's pawn. White offers a pawn to pull Black's centre pawn away.", "If Black accepts, White usually wins the pawn back and keeps a lead in the centre."],
        moves: [
          { uci: "d2d4", note: "Another way to claim the centre, with the pawn protected by the queen." },
          { uci: "d7d5", note: "Black stakes the same claim." },
          { uci: "c2c4", note: "The gambit. White challenges d5 to undermine Black's centre." },
          { uci: "e7e6", note: "Black declines and keeps a solid centre." },
          { uci: "b1c3", note: "Develops a knight and adds pressure on d5." },
          { uci: "g8f6", note: "Black develops and also defends d5." },
        ] },
    ],
  },
  {
    title: "Puzzles",
    intro: "Find the best move for White. Wrong moves are not played, so you can try as often as you like.",
    lessons: [
      { id: "free-queen", title: "Take what is free", kind: "puzzle", fen: "4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1", solutions: ["d1d5"],
        body: ["Before anything else, ask what your opponent has left undefended.", "Black's queen is unprotected and your rook is looking right at it."] },
      { id: "fork", title: "The knight fork", kind: "puzzle", fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", solutions: ["d5c7"],
        body: ["A fork is one move that attacks two things at once. Knights are the best forkers because their attacks cannot be blocked.", "Find a check that also attacks the rook."] },
      { id: "back-rank", title: "Mate in one: the back rank", kind: "puzzle", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
        body: ["Black's own pawns box the king in on the back rank. A rook or queen on that rank is checkmate.", "Find the mate."] },
      { id: "scholars", title: "Mate in one: finish the quick attack", kind: "puzzle", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
        body: ["This is the famous Scholar's Mate pattern: queen and bishop aim at f7, which only the king guards.", "Black's last move missed the threat. Punish it."] },
      { id: "smothered", title: "Mate in one: the smothered king", kind: "puzzle", fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1",
        body: ["Black's king is surrounded by its own pieces, so it has no flight squares.", "Only a knight can give check here, because nothing can block its attack."] },
      { id: "kq", title: "Mate in one: king and queen", kind: "puzzle", fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1",
        body: ["Your king helps by guarding the square next to Black's king, so the queen cannot be captured.", "Find the square where the queen is safe and takes away every escape."] },
    ],
  },
];
