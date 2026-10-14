// Course content for /learn. Every position, answer and line is checked by scripts (see README).
export type Step =
  | { kind: "explain"; text: string; fen?: string; marks?: string[]; arrows?: [string, string][] }
  | { kind: "explore"; text: string; fen: string; minMoves?: number }
  | { kind: "move"; text: string; fen: string; accept: string[] | "mate"; success: string; wrong?: string }
  | { kind: "quiz"; text: string; options: string[]; answer: number; explain: string; fen?: string }
  | { kind: "line"; text: string; fen?: string; as?: "w" | "b"; moves: { uci: string; note: string }[] }
  | { kind: "play"; text: string; fen: string; success: string; tip: string };

export interface Lesson { id: string; title: string; blurb: string; steps: Step[] }
export interface Course { id: string; title: string; level: "Beginner" | "Intermediate"; glyph: string; color: string; blurb: string; lessons: Lesson[] }

export const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const CENTRE = ["d4", "e4", "d5", "e5"];

// Builds an opening lesson: an intro, a play-along line with a comment on each move, then quiz questions.
type Q = [string, string[], number, string];
function opening(id: string, title: string, blurb: string, intro: string, as: "w" | "b", moves: [string, string][], quizzes: Q[]): Lesson {
  return {
    id, title, blurb,
    steps: [
      { kind: "explain", fen: START, text: intro },
      { kind: "line", as, text: `Play the ${title} as ${as === "w" ? "White" : "Black"}.${as === "b" ? " White's moves are played for you." : ""}`, moves: moves.map(([uci, note]) => ({ uci, note })) },
      ...quizzes.map(([text, options, answer, explain]): Step => ({ kind: "quiz", text, options, answer, explain })),
    ],
  };
}

export const COURSES: Course[] = [
  // ------------------------------------------------------------------ BASICS
  {
    id: "basics", title: "Chess basics", level: "Beginner", glyph: "♟", color: "#3a4fd7",
    blurb: "The board, the pieces and how each one moves. Start here if chess is new to you.",
    lessons: [
      { id: "board", title: "The board and the pieces", blurb: "Squares, files, ranks and the starting position.", steps: [
        { kind: "explain", fen: START, text: "Welcome! Chess is played on a board of 64 squares, alternating light and dark. Each player starts with 16 pieces: a king, a queen, two rooks, two bishops, two knights and eight pawns. White always moves first." },
        { kind: "quiz", fen: START, text: "Look at the board from White's side. What colour is the square in the bottom-right corner?", options: ["Light", "Dark"], answer: 0, explain: "Light. A handy rule to remember: light square on the right." },
        { kind: "explain", fen: START, marks: ["d1", "d8"], text: "The queens start on the middle squares of the back rank, each on her own colour: the white queen on a light square (d1) and the black queen on a dark square (d8). The kings stand next to them." },
        { kind: "quiz", fen: START, text: "Which square does the white king start on?", options: ["d1", "e1", "e2"], answer: 1, explain: "The white king starts on e1, right beside the queen on d1." },
        { kind: "explain", fen: START, marks: ["e4"], text: "Columns are called files and are labelled a to h. Rows are called ranks and are numbered 1 to 8. Every square has a name made of its file and rank, like e4." },
        { kind: "quiz", fen: START, text: "Which square is where the e-file meets the 4th rank?", options: ["e4", "d5", "e5"], answer: 0, explain: "e4: the e-file and the 4th rank." },
      ] },
      { id: "rook", title: "The rook", blurb: "Straight lines, any distance.", steps: [
        { kind: "explain", fen: "7k/8/8/3R4/8/8/8/K7 w - - 0 1", text: "The rook moves in straight lines: forward, backward and sideways, as many squares as it likes. It cannot jump over other pieces. A rook is worth about five pawns." },
        { kind: "explore", fen: "7k/8/8/3R4/8/8/8/K7 w - - 0 1", minMoves: 3, text: "Tap the rook to see every square it can reach, then move it around the board." },
        { kind: "move", fen: "7k/3p4/8/8/8/8/8/K2R4 w - - 0 1", accept: ["d1d7"], text: "Capture the black pawn on d7 with your rook. Pieces capture by moving onto the enemy piece.", success: "Nice! Rooks capture the same way they move.", wrong: "The rook moves in straight lines. The pawn is straight ahead on the d-file." },
        { kind: "quiz", text: "Can a rook move diagonally?", options: ["No, only straight lines", "Yes, any direction"], answer: 0, explain: "Rooks only move along ranks and files. Diagonals belong to the bishop." },
      ] },
      { id: "bishop", title: "The bishop", blurb: "Diagonals, and one colour for life.", steps: [
        { kind: "explain", fen: "7k/8/8/3B4/8/8/8/K7 w - - 0 1", text: "The bishop moves diagonally, any number of squares, and cannot jump. A bishop always stays on the same colour of square. A bishop is worth about three pawns." },
        { kind: "explore", fen: "7k/8/8/3B4/8/8/8/K7 w - - 0 1", minMoves: 3, text: "Move the bishop around. Notice it never changes colour." },
        { kind: "move", fen: "7k/5n2/8/3B4/8/8/8/K7 w - - 0 1", accept: ["d5f7"], text: "Capture the black knight on f7 with your bishop.", success: "Well done! The knight was on the bishop's diagonal.", wrong: "Bishops move diagonally. Find the diagonal that leads to the knight." },
        { kind: "quiz", text: "A bishop starts on a light square. Which squares can it ever reach?", options: ["Only light squares", "Any square", "Only dark squares"], answer: 0, explain: "A bishop never leaves its colour. That is why each side has one light-squared and one dark-squared bishop." },
      ] },
      { id: "queen", title: "The queen", blurb: "The most powerful piece.", steps: [
        { kind: "explain", fen: "7k/8/8/3Q4/8/8/8/K7 w - - 0 1", text: "The queen combines the rook and the bishop: she moves any distance in straight lines and diagonals. She is the strongest piece, worth about nine pawns." },
        { kind: "explore", fen: "7k/8/8/3Q4/8/8/8/K7 w - - 0 1", minMoves: 3, text: "Try the queen. She can go almost anywhere!" },
        { kind: "move", fen: "7k/1r6/8/3Q4/8/8/8/K7 w - - 0 1", accept: ["d5b7"], text: "The black rook on b7 is unprotected. Capture it with your queen.", success: "Excellent! A free rook.", wrong: "The rook sits on the queen's diagonal. Look at the diagonal going up and to the left." },
        { kind: "quiz", text: "The queen moves like which two pieces combined?", options: ["Rook and bishop", "Rook and knight", "Bishop and king"], answer: 0, explain: "Rook plus bishop, which is why she is so strong." },
      ] },
      { id: "knight", title: "The knight", blurb: "The jumper that moves in an L.", steps: [
        { kind: "explain", fen: "7k/8/8/3N4/8/8/8/K7 w - - 0 1", text: "The knight moves in an L: two squares in one direction and one square sideways. It is the only piece that can jump over others. A knight is worth about three pawns." },
        { kind: "explore", fen: "7k/8/8/3N4/8/8/8/K7 w - - 0 1", minMoves: 3, text: "Tap the knight to see its eight possible squares, then move it." },
        { kind: "move", fen: "7k/4p3/8/3N4/8/8/8/K7 w - - 0 1", accept: ["d5e7"], text: "Capture the pawn on e7 with your knight.", success: "Great! An L-shaped jump: one file over, two ranks up.", wrong: "Think of an L: two squares up and one to the side." },
        { kind: "quiz", text: "Which piece can jump over other pieces?", options: ["The knight", "The bishop", "The rook"], answer: 0, explain: "Only the knight jumps. That is why it can leap out from behind its own pawns at the start of the game." },
      ] },
      { id: "pawn", title: "The pawn", blurb: "Small, but it decides the game.", steps: [
        { kind: "explain", fen: "7k/8/8/8/8/8/4P3/K7 w - - 0 1", text: "Pawns move forward one square. From their starting square they may move two. They never move backward. A pawn is worth one point." },
        { kind: "explore", fen: "7k/8/8/8/8/8/4P3/K7 w - - 0 1", minMoves: 2, text: "Move the pawn forward. See that it can go one or two squares on its first move." },
        { kind: "explain", fen: "7k/8/8/3p4/4P3/8/8/K7 w - - 0 1", marks: ["d5"], text: "Pawns capture differently from how they move: one square diagonally forward. The white pawn on e4 attacks the black pawn on d5." },
        { kind: "move", fen: "7k/8/8/3p4/4P3/8/8/K7 w - - 0 1", accept: ["e4d5"], text: "Capture the black pawn on d5.", success: "Correct! Pawns capture diagonally.", wrong: "A pawn captures one square diagonally forward, not straight ahead." },
        { kind: "quiz", text: "In which direction does a pawn capture?", options: ["Diagonally forward", "Straight forward", "Sideways"], answer: 0, explain: "Diagonally forward by one square. It moves straight but captures on the diagonal." },
      ] },
      { id: "king", title: "The king", blurb: "The piece you must protect.", steps: [
        { kind: "explain", fen: "7k/8/8/8/3K4/8/8/8 w - - 0 1", text: "The king moves one square in any direction. It is the most important piece: if your king is trapped, you lose. The king can never move onto a square attacked by an enemy piece." },
        { kind: "explore", fen: "7k/8/8/8/3K4/8/8/8 w - - 0 1", minMoves: 3, text: "Walk the king around. Notice it only takes one step at a time." },
        { kind: "move", fen: "7k/8/8/8/3Kp3/8/8/8 w - - 0 1", accept: ["d4e4"], text: "The black pawn on e4 is undefended. Capture it with your king.", success: "Good. A king may capture if the piece is not protected.", wrong: "The pawn is right next to your king, on the same rank." },
        { kind: "quiz", text: "Can a king move to a square that an enemy piece attacks?", options: ["No", "Yes, if it captures something"], answer: 0, explain: "Never. A king can not move into check, even to capture." },
      ] },
      { id: "values", title: "What the pieces are worth", blurb: "Count material to judge a trade.", steps: [
        { kind: "explain", fen: START, text: "Pieces are given points to help you judge trades. Pawn = 1, knight = 3, bishop = 3, rook = 5, queen = 9. The king can not be traded: if it is trapped, the game is lost." },
        { kind: "quiz", text: "You can trade your knight for your opponent's rook. Should you?", options: ["Yes: a rook (5) is worth more than a knight (3)", "No: a knight is worth more"], answer: 0, explain: "You win about two points of material, an advantage worth having." },
        { kind: "move", fen: "7k/3q1p2/8/4N3/8/8/8/K7 w - - 0 1", accept: ["e5d7"], text: "Your knight can capture the queen or the pawn. Take the more valuable piece!", success: "A queen (9) is worth much more than a pawn (1).", wrong: "Look for the most valuable piece your knight can capture." },
        { kind: "quiz", text: "Which is worth more?", options: ["A rook", "A bishop", "They are equal"], answer: 0, explain: "A rook is about five points and a bishop about three." },
      ] },
    ],
  },

  // ------------------------------------------------------------------ RULES
  {
    id: "rules", title: "Rules of the game", level: "Beginner", glyph: "♚", color: "#2f8f5b",
    blurb: "Check, checkmate, stalemate and the special moves every player must know.",
    lessons: [
      { id: "check", title: "Check", blurb: "When the king is attacked.", steps: [
        { kind: "explain", fen: "4k3/8/8/8/8/8/8/4RK2 b - - 0 1", marks: ["e8", "e1"], text: "When a king is attacked, it is in check. Here the white rook attacks the black king. You must always respond to a check. There are three ways: move the king, block the attack, or capture the attacker." },
        { kind: "move", fen: "4k3/8/8/8/8/8/8/4RK2 b - - 0 1", accept: ["e8d8", "e8f8", "e8d7", "e8f7"], text: "Black is in check. Move the king out of the rook's line of attack.", success: "The king stepped off the e-file. Check escaped!", wrong: "That doesn't stop the check. Move the king off the e-file." },
        { kind: "move", fen: "4k3/3r4/8/8/8/8/8/4RK2 b - - 0 1", accept: ["d7e7"], text: "Now block the check. Put your rook between the white rook and your king.", success: "Blocked! The rook now stands in the way.", wrong: "Try blocking with the rook on d7, so the white rook can no longer see the king." },
        { kind: "move", fen: "4kb2/8/3N4/8/8/8/8/4K3 b - - 0 1", accept: ["f8d6"], text: "A knight gives check, and knights can't be blocked. Capture the knight with your bishop.", success: "Captured! The attacker is gone.", wrong: "The knight is the attacker. Capture it with the bishop." },
      ] },
      { id: "checkmate", title: "Checkmate", blurb: "How the game is won.", steps: [
        { kind: "explain", fen: "R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1", marks: ["g8", "a8"], text: "Checkmate means the king is in check and there is no way out: it can not move to safety, block, or capture the attacker. The game ends and the checkmating side wins. This is a back-rank mate: Black's own pawns trap the king." },
        { kind: "move", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", accept: "mate", text: "Your turn. Give checkmate in one move.", success: "Checkmate! The king has nowhere to go.", wrong: "Find a move that attacks the king while all its escape squares are covered." },
        { kind: "move", fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1", accept: "mate", text: "King and queen working together. Give checkmate in one move.", success: "Checkmate! Your king protects the queen so it can't be captured.", wrong: "Place the queen so Black's king has no squares and can't capture her." },
      ] },
      { id: "stalemate", title: "Stalemate", blurb: "The draw you must avoid when winning.", steps: [
        { kind: "explain", fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", text: "Stalemate happens when the player to move has no legal move but is not in check. The game is a draw. Black to move here can not move without stepping into an attack, yet the king is not attacked." },
        { kind: "quiz", fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", text: "Is this position checkmate or stalemate?", options: ["Checkmate", "Stalemate"], answer: 1, explain: "Stalemate. The black king is not in check, and it has no legal moves." },
        { kind: "move", fen: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1", accept: "mate", text: "You're winning! Checkmate Black in one move. Beware: some moves cause stalemate.", success: "Checkmate, not stalemate. Always check that your opponent still has a move, or is mated.", wrong: "Find the move that gives check and takes every flight square." },
        { kind: "quiz", text: "A stalemate is…", options: ["A draw", "A win for the player who moved", "A loss for the player who can not move"], answer: 0, explain: "A draw. When you are far ahead, take care not to stalemate your opponent." },
      ] },
      { id: "castling", title: "Castling", blurb: "Safety for the king, activity for the rook.", steps: [
        { kind: "explain", fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", marks: ["e1", "g1", "h1", "f1"], text: "Castling is a special move: the king moves two squares toward a rook, and the rook jumps to the other side of the king. It tucks the king to safety and brings a rook into play. You may do it once per game." },
        { kind: "move", fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", accept: ["e1g1"], text: "Castle kingside (short): move the king two squares toward the h1 rook.", success: "Castled kingside! The rook jumped to f1.", wrong: "Move the king two squares to the right, onto g1." },
        { kind: "move", fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", accept: ["e1c1"], text: "Now castle queenside (long): move the king two squares toward the a1 rook.", success: "Queenside castling done. The rook landed on d1.", wrong: "Move the king two squares to the left, onto c1." },
        { kind: "quiz", text: "When can you NOT castle?", options: ["If the king is in check", "If it is move 10", "If you have captured a piece"], answer: 0, explain: "You can't castle out of check, through an attacked square, if the king or that rook has moved, or if pieces stand between them." },
      ] },
      { id: "enpassant", title: "En passant", blurb: "The special pawn capture.", steps: [
        { kind: "explain", fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", marks: ["d6", "e5", "d5"], text: "Black has just pushed the d-pawn two squares, from d7 to d5, landing next to your pawn on e5. Normally, you could have captured it if it had moved one square. En passant lets you capture it as if it had moved only one." },
        { kind: "move", fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", accept: ["e5d6"], text: "Capture en passant: move your pawn to d6, the square the black pawn jumped over.", success: "En passant! The black pawn on d5 was removed.", wrong: "Move the e5 pawn diagonally to d6, behind the black pawn." },
        { kind: "quiz", text: "When may you capture en passant?", options: ["Only on the very next move after the enemy pawn jumps two squares", "Any time later", "Only with a queen"], answer: 0, explain: "The chance disappears if you don't take it immediately." },
      ] },
      { id: "promotion", title: "Promotion", blurb: "Turning a pawn into a queen.", steps: [
        { kind: "explain", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1", marks: ["a8"], text: "When a pawn reaches the far side of the board, it is promoted to a queen, rook, bishop or knight of the same colour. You almost always choose a queen." },
        { kind: "move", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1", accept: ["a7a8q"], text: "Push the pawn to a8 and promote it. On this site it becomes a queen automatically.", success: "A brand-new queen!", wrong: "Move the pawn forward to the last rank." },
        { kind: "quiz", text: "Which piece do you usually promote to?", options: ["Queen", "Pawn", "King"], answer: 0, explain: "The queen: the most powerful piece." },
      ] },
      { id: "ending", title: "How a game ends", blurb: "Wins, draws and resignations.", steps: [
        { kind: "explain", text: "A game can end in several ways. You win by checkmate, or when your opponent resigns or runs out of time. It is a draw by stalemate, by agreement, by threefold repetition, by the 50-move rule, or when neither side has enough pieces to checkmate." },
        { kind: "quiz", text: "Which of these is a draw?", options: ["Stalemate", "Checkmate", "Capturing the queen"], answer: 0, explain: "Stalemate is a draw. Capturing the queen doesn't end a game." },
        { kind: "quiz", text: "Which is NOT enough material to checkmate?", options: ["King and a lone knight against king", "King and queen against king", "King and rook against king"], answer: 0, explain: "A king and one knight (or one bishop) alone cannot force checkmate, so the game is drawn." },
      ] },
    ],
  },

  // ------------------------------------------------------------------ OPENINGS
  {
    id: "openings", title: "Opening ideas", level: "Beginner", glyph: "♞", color: "#7a49c7",
    blurb: "Start games well: the principles that matter and two classic openings.",
    lessons: [
      { id: "principles", title: "Opening principles", blurb: "Centre, development and safety.", steps: [
        { kind: "explain", fen: START, marks: CENTRE, text: "In the opening, fight for the centre: the squares d4, e4, d5 and e5. Pieces in the middle control more of the board." },
        { kind: "quiz", fen: START, text: "Which first move claims the centre?", options: ["1. e4", "1. a4", "1. h3"], answer: 0, explain: "1. e4 puts a pawn in the centre and opens lines for the queen and bishop." },
        { kind: "explain", text: "Develop your knights and bishops early, toward the centre. Pieces still on the back rank are not helping you." },
        { kind: "quiz", text: "Why is moving the same piece again and again in the opening a problem?", options: ["It loses time while your opponent develops", "It is against the rules", "It makes the piece weaker"], answer: 0, explain: "Every move should bring a new piece into play. Time matters." },
        { kind: "explain", text: "Castle early to tuck your king away and bring a rook into the game. And don't send your queen out too soon: smaller pieces can chase her." },
        { kind: "quiz", text: "Which is a good opening plan?", options: ["Take the centre, develop pieces, castle", "Attack with the queen on move 2", "Move every pawn once"], answer: 0, explain: "Centre, development, safety. Everything else is detail." },
      ] },
      { id: "italian", title: "The Italian Game", blurb: "A classic for White.", steps: [
        { kind: "explain", fen: START, text: "The Italian Game is a classic opening that follows all the principles. You play White and Black replies automatically. Make each move in the line." },
        { kind: "line", as: "w", text: "Play the Italian Game as White.", moves: [
          { uci: "e2e4", note: "Take space in the centre and open lines for the queen and bishop." },
          { uci: "e7e5", note: "Black claims the centre too." },
          { uci: "g1f3", note: "Develops a knight and attacks the pawn on e5." },
          { uci: "b8c6", note: "Black defends the pawn and develops a knight." },
          { uci: "f1c4", note: "The bishop eyes f7, a sensitive square early on." },
          { uci: "f8c5", note: "Black develops the bishop to an equally active square." },
        ] },
        { kind: "quiz", text: "What is White's bishop on c4 aiming at?", options: ["The f7 pawn", "The h1 rook", "The d8 queen"], answer: 0, explain: "f7 is protected only by the king at this stage, so it's a target." },
        { kind: "quiz", text: "What is a sensible next step for White?", options: ["Castle kingside", "Move the queen out at once", "Move the a-pawn"], answer: 0, explain: "Castling gets the king safe and connects the rooks. White usually also plays c3 and d4 to build the centre." },
      ] },
      { id: "qgambit", title: "The Queen's Gambit", blurb: "A strategic opening.", steps: [
        { kind: "explain", fen: START, text: "The Queen's Gambit starts with the queen's pawn. White offers a pawn to pull Black's central pawn away. It is called a gambit, but the pawn is usually won back." },
        { kind: "line", as: "w", text: "Play the Queen's Gambit as White.", moves: [
          { uci: "d2d4", note: "Another way to claim the centre, with the pawn protected by the queen." },
          { uci: "d7d5", note: "Black stakes the same claim." },
          { uci: "c2c4", note: "The gambit! White challenges d5 to undermine Black's centre." },
          { uci: "e7e6", note: "Black declines the pawn and keeps a solid centre." },
          { uci: "b1c3", note: "Develops a knight and adds pressure on d5." },
          { uci: "g8f6", note: "Black develops and also defends d5." },
        ] },
        { kind: "quiz", text: "If Black captures with …dxc4, what usually happens?", options: ["White can win the pawn back and keep a good centre", "White loses a piece", "The game is drawn"], answer: 0, explain: "That's why it is a gambit only in name. White regains the pawn with good play." },
      ] },
      { id: "scholars-defence", title: "Beat the Scholar's Mate", blurb: "Defend against a beginner trap.", steps: [
        { kind: "explain", fen: START, text: "A common beginner trap is the Scholar's Mate, where White's queen and bishop attack f7 in a few moves. Here you play Black and learn how to defend." },
        { kind: "line", as: "b", text: "Play Black. White's moves are automatic.", moves: [
          { uci: "e2e4", note: "White takes the centre." },
          { uci: "e7e5", note: "You do the same." },
          { uci: "d1h5", note: "The queen comes out early and eyes e5 and f7." },
          { uci: "b8c6", note: "You defend e5 and develop a piece." },
          { uci: "f1c4", note: "Now the queen and bishop both aim at f7. This is the Scholar's Mate threat." },
          { uci: "g7g6", note: "The key move! It attacks the queen and drives her away." },
          { uci: "h5f3", note: "The queen retreats, still eyeing f7." },
          { uci: "g8f6", note: "Develops a knight and blocks the f-file. The threat is over." },
        ] },
        { kind: "quiz", text: "Which move attacked White's queen and stopped the threat?", options: ["…g6", "…h6", "…a6"], answer: 0, explain: "…g6 attacks the queen on h5 with a pawn, forcing her to move." },
      ] },
    ],
  },

  // ------------------------------------------------------------------ TACTICS
  {
    id: "tactics", title: "Tactics", level: "Intermediate", glyph: "♞", color: "#c4552d",
    blurb: "Forks, pins, skewers and more: the short combinations that win material.",
    lessons: [
      { id: "forks", title: "Forks", blurb: "Attack two things at once.", steps: [
        { kind: "explain", fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", marks: ["c7", "e8", "a8"], text: "A fork is one move that attacks two or more enemy pieces at once. The opponent can usually save only one. Knights are the best forkers, because their attacks can't be blocked." },
        { kind: "move", fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", accept: ["d5c7"], text: "Find the knight fork: attack the king and the rook together.", success: "Nc7+ forks the king and the rook. After the king moves, take the rook!", wrong: "Look for a knight move that gives check and also attacks the rook." },
        { kind: "move", fen: "4k3/8/2n1n3/8/3P4/8/8/4K3 w - - 0 1", accept: ["d4d5"], text: "Pawns can fork too! Win a knight with a single pawn move.", success: "The pawn attacks both knights. One of them will be lost.", wrong: "A pawn attacks diagonally. Find the square where it hits both knights." },
        { kind: "quiz", text: "Why are knights so good at forking?", options: ["Their attacks can not be blocked", "They are worth the most", "They move in straight lines"], answer: 0, explain: "Knights jump, so no piece can stand in the way." },
      ] },
      { id: "pins", title: "Pins", blurb: "Freeze a piece in place.", steps: [
        { kind: "explain", fen: "r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6", marks: ["f6", "d8", "g5"], text: "A pin attacks a piece that is in front of a more valuable one. If the pinned piece moves, the piece behind it is lost. If the piece behind is the king, the pin is absolute and the piece can't legally move." },
        { kind: "move", fen: "r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6", accept: ["c1g5"], text: "Pin Black's knight on f6 to the queen with your bishop.", success: "Bg5 pins the knight: if it moves, the queen is attacked.", wrong: "Place the bishop so the knight on f6 stands in front of the queen on d8." },
        { kind: "quiz", text: "What makes a pin 'absolute'?", options: ["The piece behind is the king", "The pinned piece is a pawn", "It happens in the opening"], answer: 0, explain: "An absolutely pinned piece can't legally move at all, because that would expose the king." },
      ] },
      { id: "skewers", title: "Skewers", blurb: "The reverse of a pin.", steps: [
        { kind: "explain", fen: "8/8/8/4k2q/8/8/8/R5K1 w - - 0 1", marks: ["a5", "e5", "h5"], text: "A skewer is the reverse of a pin: you attack a valuable piece, and when it moves away, you capture the piece behind it." },
        { kind: "line", as: "w", fen: "8/8/8/4k2q/8/8/8/R5K1 w - - 0 1", text: "Skewer the king and the queen. Play the moves for White.", moves: [
          { uci: "a1a5", note: "Check! The rook attacks the king along the 5th rank, with the queen behind it." },
          { uci: "e5d4", note: "The king must leave the rank." },
          { uci: "a5h5", note: "The rook now takes the unprotected queen." },
        ] },
        { kind: "quiz", text: "In a skewer, what happens first?", options: ["The more valuable piece is forced to move", "The less valuable piece is captured", "Nothing"], answer: 0, explain: "The valuable piece is attacked first and moves away, exposing the piece behind it." },
      ] },
      { id: "discovered", title: "Discovered attacks", blurb: "Move one piece, reveal another.", steps: [
        { kind: "explain", fen: "1q2k3/8/8/4B3/8/8/8/4R1K1 w - - 0 1", marks: ["e1", "e5", "e8"], text: "A discovered attack happens when you move a piece out of the way and reveal an attack from a piece behind it. Here the bishop on e5 blocks the white rook's attack on the black king." },
        { kind: "move", fen: "1q2k3/8/8/4B3/8/8/8/4R1K1 w - - 0 1", accept: ["e5b8"], text: "Move the bishop and win the queen. Your move reveals a check!", success: "Bxb8+! The bishop takes the queen while the rook gives check.", wrong: "Move the bishop with a capture. The rook behind it gives check." },
        { kind: "quiz", text: "Why is a discovered check powerful?", options: ["The moving piece can capture or threaten while the king must answer check", "It cannot be answered", "It checkmates immediately"], answer: 0, explain: "Your opponent must deal with the check, so your moved piece gets a free action." },
      ] },
      { id: "backrank", title: "Back-rank mate", blurb: "A classic way to finish.", steps: [
        { kind: "explain", fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", marks: ["d8", "g8"], text: "A back-rank mate happens when a rook or queen checks a king on its first rank, and the king's own pawns block its escape." },
        { kind: "move", fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", accept: "mate", text: "Deliver the back-rank checkmate.", success: "Rd8#! The pawns on f7, g7 and h7 trap their own king.", wrong: "Check on the 8th rank. The black king has no escape squares." },
        { kind: "quiz", text: "How can you avoid being back-rank mated?", options: ["Give the king an escape square, for example by moving a pawn", "Move your queen away", "Castle on both sides"], answer: 0, explain: "A little space called luft (like h3 or h6) gives the king a square to run to." },
      ] },
      { id: "free", title: "Take what is free", blurb: "Always check for hanging pieces.", steps: [
        { kind: "explain", fen: "4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1", marks: ["d5"], text: "The simplest tactic: a piece that isn't protected can simply be taken. Before every move, check whether your opponent has left anything hanging, and whether you have." },
        { kind: "move", fen: "4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1", accept: ["d1d5"], text: "Black's queen is unprotected. Take it.", success: "Rxd5! Free queen.", wrong: "Look at the black queen. Is anything defending it?" },
        { kind: "quiz", text: "What should you check before every move?", options: ["What does my opponent's last move threaten, and what is left hanging?", "Only my own plans", "How much time is left"], answer: 0, explain: "Blunder checks win more games than brilliant plans." },
      ] },
    ],
  },

  // ------------------------------------------------------------------ MATES
  {
    id: "mates", title: "Checkmate patterns", level: "Intermediate", glyph: "♛", color: "#1f8a9e",
    blurb: "Finish the game: classic mates and the basic endgames every player should know.",
    lessons: [
      { id: "scholars", title: "Scholar's Mate", blurb: "The four-move checkmate.", steps: [
        { kind: "explain", fen: START, text: "The Scholar's Mate is the fastest common checkmate. It works only if Black does not defend f7. Learn it so you can defend against it and spot it when it appears." },
        { kind: "line", as: "w", text: "Play the Scholar's Mate as White.", moves: [
          { uci: "e2e4", note: "Open the diagonals for the queen and bishop." },
          { uci: "e7e5", note: "Black mirrors the move." },
          { uci: "f1c4", note: "The bishop aims at f7." },
          { uci: "b8c6", note: "Black develops, but ignores the threat." },
          { uci: "d1h5", note: "The queen joins the attack on f7." },
          { uci: "g8f6", note: "A blunder! Black attacks the queen but can not stop the mate." },
          { uci: "h5f7", note: "Checkmate! The queen is protected by the bishop." },
        ] },
        { kind: "quiz", text: "Why is f7 an easy target early in the game?", options: ["Only the king protects it", "It is a light square", "It has no pawn"], answer: 0, explain: "The king is the only defender of f7 (and f2 for White), so two attackers can break through." },
      ] },
      { id: "smothered", title: "Smothered mate", blurb: "A mate only a knight can give.", steps: [
        { kind: "explain", fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", marks: ["h8", "g8", "g7", "h7", "f7"], text: "In a smothered mate, the king is surrounded by its own pieces and a knight delivers check. Because knights can jump, nothing can block or capture." },
        { kind: "move", fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", accept: ["g5f7"], text: "Deliver the smothered mate with your knight.", success: "Nf7#! The king has no escape square and nothing can capture the knight.", wrong: "Find the knight move that gives check to the king on h8." },
        { kind: "quiz", text: "Why can only a knight give a smothered mate?", options: ["It jumps, so the king's own pieces can't block it", "It is the strongest piece", "Knights cannot be captured"], answer: 0, explain: "A rook, bishop or queen could be blocked or captured by the surrounded king's neighbours." },
      ] },
      { id: "kq", title: "King and queen mate", blurb: "Practise against the engine.", steps: [
        { kind: "explain", fen: "8/8/8/4k3/8/8/8/K2Q4 w - - 0 1", text: "With just a king and queen against a lone king, you can always force checkmate. The idea: use the queen to shrink the space the enemy king has, then bring your king up to help." },
        { kind: "play", fen: "8/8/8/4k3/8/8/8/K2Q4 w - - 0 1", text: "Checkmate the black king. The engine will defend as well as it can.", tip: "Keep the queen a knight's move away from the king and use her to cut the king off along ranks and files. Walk your own king closer. Beware of stalemate!", success: "Checkmate! You know the king-and-queen mate." },
      ] },
      { id: "ladder", title: "Two rooks: the ladder", blurb: "Rooks working together.", steps: [
        { kind: "explain", fen: "4k3/8/8/8/8/8/R7/1R2K3 w - - 0 1", text: "Two rooks can checkmate a bare king with the 'ladder' technique: one rook cuts off a rank, the other checks on the next rank, and they leapfrog toward the edge." },
        { kind: "play", fen: "4k3/8/8/8/8/8/R7/1R2K3 w - - 0 1", text: "Checkmate the black king with your two rooks.", tip: "Move one rook to a rank beyond the king to cut it off, for example to the 7th rank. Then give check with the other rook on the 8th rank. Never put a rook where the king can capture it.", success: "Checkmate! The ladder works every time." },
      ] },
    ],
  },
  // ------------------------------------------------------------------ OPENINGS WITH WHITE
  {
    id: "openings-white", title: "Openings with White", level: "Intermediate", glyph: "♔", color: "#9a5b13",
    blurb: "Seven popular ways to start a game as White, from sharp king-pawn openings to solid queen-pawn systems.",
    lessons: [
      opening("ruy-lopez", "Ruy Lopez", "The Spanish Game: lasting pressure on e5.",
        "The Ruy Lopez, also called the Spanish Game, is one of the oldest and most respected openings. White attacks the knight that defends e5 and builds long-term pressure on the centre.",
        "w", [
          ["e2e4", "Claim the centre and open lines for the queen and bishop."],
          ["e7e5", "Black claims the centre in the same way."],
          ["g1f3", "Develops a knight and attacks the pawn on e5."],
          ["b8c6", "Black defends e5 with a knight."],
          ["f1b5", "The Ruy Lopez! The bishop pressures the knight that defends e5."],
          ["a7a6", "Black asks the bishop what it wants to do (the Morphy Defence)."],
          ["b5a4", "The bishop retreats but keeps the pressure on the c6 knight."],
          ["g8f6", "Black develops and counterattacks the e4 pawn."],
          ["e1g1", "White castles. If Black takes on e4, White can regain the pawn with a strong initiative."],
          ["f8e7", "Black develops solidly and prepares to castle."],
        ], [
          ["What is White's bishop on b5 pressuring?", ["The knight on c6, which defends e5", "The queen on d8", "The pawn on f7"], 0, "By pressuring the knight that defends e5, White creates long-term tension in the centre."],
          ["After …a6, where does the bishop usually retreat?", ["a4, keeping the tension", "h1", "d3"], 0, "Ba4 keeps the pressure on c6. Capturing on c6 gives up the bishop pair."],
        ]),
      opening("scotch", "Scotch Game", "Open the centre at once with d4.",
        "In the Scotch Game, White opens the centre on move three. It leads to open, active play where piece development matters most.",
        "w", [
          ["e2e4", "Take space in the centre."],
          ["e7e5", "Black does the same."],
          ["g1f3", "Develops a knight and attacks e5."],
          ["b8c6", "Black defends the pawn."],
          ["d2d4", "The Scotch! White strikes at the centre immediately."],
          ["e5d4", "Black captures, and the centre opens."],
          ["f3d4", "White recaptures with a knight in the centre and leads in development."],
          ["f8c5", "Black develops with pressure on the knight on d4."],
          ["c1e3", "Defends the knight and develops a piece."],
          ["d8f6", "Black adds a second attacker to d4."],
          ["c2c3", "The c3 pawn protects the knight and keeps everything defended."],
          ["g8e7", "Black develops the knight and keeps an eye on the centre."],
        ], [
          ["Why does White play d4 so early in the Scotch?", ["To open the centre while ahead in development", "To win a pawn by force", "To trap a knight"], 0, "Opening the centre favours the side with more pieces developed."],
          ["What does 6.c3 do?", ["Protects the knight on d4", "Attacks the queen", "Opens the c-file"], 0, "The pawn on c3 guards d4, so Black's pieces have nothing to win."],
        ]),
      opening("london", "London System", "A solid setup you can use against almost anything.",
        "The London System is a reliable setup for White. You aim for the same structure whatever Black does, so there is little theory to memorise. The key idea is to develop the dark-squared bishop to f4 before playing e3.",
        "w", [
          ["d2d4", "Claim the centre with the queen's pawn."],
          ["d7d5", "Black does the same."],
          ["c1f4", "The London bishop develops outside the pawn chain before e3 blocks it."],
          ["g8f6", "Black develops a knight."],
          ["e2e3", "Supports d4 and opens the way for the kingside pieces."],
          ["e7e6", "Black prepares to develop the bishop."],
          ["g1f3", "Develops the knight and eyes the centre."],
          ["c7c5", "Black challenges White's centre."],
          ["c2c3", "Supports d4, completing the typical London pawn shape."],
          ["b8c6", "Black develops and adds pressure on d4."],
          ["b1d2", "The last minor piece comes out, ready for e4 later."],
          ["f8d6", "Black aims the bishop at White's own bishop."],
          ["f4g3", "The bishop keeps the diagonal, ready to trade on d6."],
          ["e8g8", "Black castles. Both sides have a healthy position."],
        ], [
          ["Why does White play Bf4 before e3?", ["Otherwise the e3 pawn would shut the bishop in", "Bf4 attacks the queen", "To castle sooner"], 0, "Once the pawn is on e3, the c1 bishop can't get out along that diagonal."],
          ["What is the London's main advantage?", ["You can play the same setup against most replies", "It wins a pawn", "It is the sharpest opening"], 0, "You learn one structure and use it in almost every game."],
        ]),
      opening("english", "English Opening", "Control the centre from the flank.",
        "The English Opening starts with 1.c4. White controls the d5 square from the side and keeps flexible options. It often becomes a 'reversed Sicilian', where White has the Sicilian structure with an extra move.",
        "w", [
          ["c2c4", "Controls d5 from the flank."],
          ["e7e5", "Black takes space in the centre."],
          ["b1c3", "Develops a knight and adds control of d5."],
          ["g8f6", "Black develops a knight."],
          ["g1f3", "Develops and attacks the e5 pawn."],
          ["b8c6", "Black defends."],
          ["g2g3", "Prepares to fianchetto the bishop on the long diagonal."],
          ["d7d5", "Black strikes at the centre."],
          ["c4d5", "White captures, opening the position for the bishop."],
          ["f6d5", "Black recaptures with the knight."],
          ["f1g2", "The fianchettoed bishop pressures the centre and the queenside."],
        ], [
          ["What does 1.c4 control?", ["The d5 square", "The h-file", "The enemy queen"], 0, "The c-pawn watches d5, discouraging Black's central pawn push."],
          ["Why is the English called a 'reversed Sicilian'?", ["White plays a Sicilian structure with an extra move", "It begins with the Sicilian's first moves", "Black plays 1…c5"], 0, "After 1.c4 e5, White has the Sicilian setup (1.e4 c5) with colours reversed and White to move."],
        ]),
      opening("qga", "Queen's Gambit Accepted", "What happens when Black takes the pawn.",
        "In the Queen's Gambit Accepted, Black takes White's offered pawn on c4. White does not mind: the pawn is regained quickly, and White keeps a healthy centre.",
        "w", [
          ["d2d4", "Claim the centre."],
          ["d7d5", "Black does the same."],
          ["c2c4", "The Queen's Gambit: White offers a pawn."],
          ["d5c4", "Black accepts the pawn."],
          ["g1f3", "Develops a knight and prepares to regain the pawn."],
          ["g8f6", "Black develops and keeps an eye on the centre."],
          ["e2e3", "Opens the bishop so it can recapture on c4."],
          ["e7e6", "Black prepares to develop the bishop."],
          ["f1c4", "White regains the pawn with a lead in the centre and in development."],
          ["c7c5", "Black counters in the centre."],
          ["e1g1", "White castles to safety."],
          ["a7a6", "Black prepares …b5 to chase the bishop."],
        ], [
          ["In the Queen's Gambit Accepted, who usually regains the pawn?", ["White", "Black, with the extra pawn kept", "Nobody"], 0, "White regains it with Bxc4, often after e3."],
          ["What is Black's main risk in holding on to the extra pawn?", ["Falling behind in development", "Losing the queen", "Stalemate"], 0, "Pawn-grabbing costs time, and White's pieces come out faster."],
        ]),
      opening("catalan", "Catalan Opening", "A bishop on the long diagonal.",
        "The Catalan combines the Queen's Gambit with a fianchettoed bishop. The bishop on g2 exerts constant pressure on the centre and the queenside.",
        "w", [
          ["d2d4", "Claim the centre."],
          ["g8f6", "Black develops a knight."],
          ["c2c4", "Adds more control of the centre."],
          ["e7e6", "Black prepares to develop and keep options open."],
          ["g2g3", "The Catalan move: preparing a fianchetto."],
          ["d7d5", "Black takes a stake in the centre."],
          ["f1g2", "The bishop now eyes the d5 pawn and the a8 corner."],
          ["f8e7", "Black develops a bishop."],
          ["g1f3", "Develops the knight and heads toward castling."],
          ["e8g8", "Black castles."],
          ["e1g1", "White castles too."],
          ["d5c4", "Black grabs the pawn. White will usually win it back."],
        ], [
          ["What defines the Catalan Opening?", ["A bishop fianchettoed on g2 aiming at the queenside", "An early queen sortie", "A pawn storm on the kingside"], 0, "That long-range bishop is the main source of White's pressure."],
        ]),
      opening("four-knights", "Four Knights Game", "Solid, symmetrical development.",
        "The Four Knights Game is a calm and sound opening. Both sides develop their knights to the best squares, and the game stays balanced while you learn middlegame ideas.",
        "w", [
          ["e2e4", "Take the centre."],
          ["e7e5", "Black mirrors the move."],
          ["g1f3", "Develops and attacks e5."],
          ["b8c6", "Black defends the pawn."],
          ["b1c3", "A second knight comes out and defends e4."],
          ["g8f6", "Black does the same."],
          ["f1b5", "The Spanish Four Knights: the bishop pressures the c6 knight."],
          ["f8b4", "Black copies, pressuring the knight on c3."],
          ["e1g1", "White castles."],
          ["e8g8", "Black castles."],
          ["d2d3", "A solid move that opens the c1 bishop."],
          ["d7d6", "Black does the same."],
          ["c1g5", "Pins the f6 knight against the queen."],
          ["b4c3", "Black doubles White's pawns by capturing the knight."],
          ["b2c3", "White accepts doubled pawns in return for the bishop pair."],
          ["d8e7", "Black develops the queen and prepares to challenge the pin."],
        ], [
          ["What does 7.Bg5 pin?", ["The knight on f6 against the queen", "The knight on c6", "The pawn on f7"], 0, "If the knight moves, the bishop attacks the queen."],
          ["What is the Four Knights known for?", ["Solid, symmetrical development", "Wild gambit attacks", "Early queen raids"], 0, "It is a good opening for learning the basics of development and structure."],
        ]),
    ],
  },

  // ------------------------------------------------------------------ OPENINGS WITH BLACK
  {
    id: "openings-black", title: "Openings with Black", level: "Intermediate", glyph: "♚", color: "#475569",
    blurb: "Eight dependable ways to answer 1.e4 and 1.d4 as Black. White's moves are played for you.",
    lessons: [
      opening("sicilian", "Sicilian Defence", "The most popular reply to 1.e4.",
        "The Sicilian Defence is the most popular answer to 1.e4. Black fights for the centre with a flank pawn, which leads to unbalanced positions where both sides play for a win. This is the Najdorf variation.",
        "b", [
          ["e2e4", "White takes the centre."],
          ["c7c5", "The Sicilian! Black challenges d4 without copying White."],
          ["g1f3", "White develops and prepares d4."],
          ["d7d6", "Opens the bishop and supports …Nf6 and …e5."],
          ["d2d4", "White opens the centre."],
          ["c5d4", "Black trades a flank pawn for White's central pawn."],
          ["f3d4", "White recaptures with a knight in the centre."],
          ["g8f6", "Attacks the e4 pawn and develops."],
          ["b1c3", "White defends e4."],
          ["a7a6", "The Najdorf. It prevents Nb5 and prepares …b5."],
          ["c1e3", "White develops, planning a kingside attack."],
          ["e7e5", "Black kicks the knight and takes control of d5."],
          ["d4b3", "The knight retreats."],
          ["c8e6", "Black develops the bishop to a good square."],
        ], [
          ["How does Black fight for the centre in the Sicilian?", ["With a flank pawn, trading it for White's d-pawn", "By copying White's moves", "By castling first"], 0, "…c5 followed by …cxd4 gives Black a healthy central presence without symmetry."],
          ["What does …a6 prepare in the Najdorf?", ["…b5 and stopping White's pieces from using b5", "Castling", "…f5"], 0, "It gains queenside space and takes the b5 square away from White."],
        ]),
      opening("french", "French Defence", "Solid, with a plan to attack the pawn chain.",
        "The French Defence is solid and strategic. Black accepts a slightly cramped position in return for a sturdy pawn structure, and later attacks White's centre with pawn breaks.",
        "b", [
          ["e2e4", "White takes the centre."],
          ["e7e6", "The French! Black prepares …d5."],
          ["d2d4", "White builds a big centre."],
          ["d7d5", "Black challenges the e4 pawn."],
          ["b1c3", "White defends e4."],
          ["g8f6", "Develops and attacks e4 again."],
          ["c1g5", "White pins the f6 knight against the queen."],
          ["f8e7", "Black breaks the pin."],
          ["e4e5", "White gains space and attacks the knight."],
          ["f6d7", "The knight retreats."],
          ["g5e7", "White trades off the dark-squared bishop."],
          ["d8e7", "Black recaptures with the queen."],
          ["f2f4", "White supports e5 with a pawn chain."],
          ["e8g8", "Black castles. The plan is to attack the chain with …c5 and …f6."],
        ], [
          ["What is Black's typical plan in the French?", ["Attack White's pawn chain with …c5 and …f6", "Attack the king with the h-pawn", "Trade queens at once"], 0, "Undermining the base of White's chain at d4 and e5 is the French player's main idea."],
          ["Which is Black's 'problem piece' in the French?", ["The light-squared bishop on c8, blocked by its own pawns", "The queen", "The h-rook"], 0, "The pawn on e6 locks that bishop in, so Black often looks for ways to free it."],
        ]),
      opening("caro-kann", "Caro-Kann Defence", "Rock-solid with a healthy bishop.",
        "The Caro-Kann is a very solid defence. Black supports the d5 pawn with c6 and keeps the light-squared bishop free, so it does not end up locked in as it can in the French.",
        "b", [
          ["e2e4", "White takes the centre."],
          ["c7c6", "The Caro-Kann: prepares …d5 with a solid pawn chain."],
          ["d2d4", "White builds a big centre."],
          ["d7d5", "Black challenges the centre."],
          ["b1c3", "White defends e4."],
          ["d5e4", "Black takes the pawn, opening the position."],
          ["c3e4", "White recaptures."],
          ["c8f5", "The key idea: the bishop comes out before …e6 locks it in, and attacks the knight."],
          ["e4g3", "The knight retreats and eyes the bishop."],
          ["f5g6", "The bishop retreats to a safe square."],
          ["h2h4", "White threatens h5 to chase the bishop."],
          ["h7h6", "Black prepares to answer h5 with …Bh7."],
          ["g1f3", "White develops."],
          ["b8d7", "Black develops and prepares …Ngf6."],
        ], [
          ["What is the idea of …Bf5 in the Caro-Kann?", ["Develop the light bishop before locking it in with …e6", "Win a pawn", "Attack the king"], 0, "Getting the bishop outside the pawn chain is the main point of the Caro-Kann."],
          ["Why do the pawns on c6 and d5 help Black?", ["c6 supports d5, giving a solid centre", "They attack the queen", "They open the f-file"], 0, "The pawn on c6 keeps d5 defended, so Black's centre is hard to break."],
        ]),
      opening("scandinavian", "Scandinavian Defence", "Challenge e4 immediately.",
        "The Scandinavian Defence is easy to understand: Black hits e4 at once with 1…d5. The queen comes out early, but the plans are simple and clear.",
        "b", [
          ["e2e4", "White takes the centre."],
          ["d7d5", "The Scandinavian! Black challenges e4 immediately."],
          ["e4d5", "White captures the pawn."],
          ["d8d5", "Black recaptures with the queen."],
          ["b1c3", "White attacks the queen and gains a tempo."],
          ["d5a5", "The queen finds a safe square."],
          ["d2d4", "White takes the centre."],
          ["g8f6", "Black develops."],
          ["g1f3", "White develops."],
          ["c7c6", "Gives the queen the c7 retreat and prepares …Bf5."],
          ["f1c4", "White develops with pressure on f7."],
          ["c8f5", "Black develops the bishop outside the pawn chain."],
        ], [
          ["What does Nc3 gain for White in the Scandinavian?", ["A tempo, by attacking the queen", "A pawn", "A check"], 0, "Black must move the queen again, so White gets a free developing move."],
          ["What is Black's trade-off in the Scandinavian?", ["The queen comes out early and may be chased", "Black loses a pawn", "Black cannot castle"], 0, "In return, Black gets a solid structure and simple development."],
        ]),
      opening("slav", "Slav Defence", "A solid answer to the Queen's Gambit.",
        "The Slav Defence meets 1.d4 d5 2.c4 with …c6. Black supports d5 firmly and keeps the light-squared bishop free to develop outside the pawn chain.",
        "b", [
          ["d2d4", "White claims the centre."],
          ["d7d5", "Black does the same."],
          ["c2c4", "The Queen's Gambit."],
          ["c7c6", "The Slav: supports d5 and keeps the c8 bishop free."],
          ["g1f3", "White develops."],
          ["g8f6", "Black develops."],
          ["b1c3", "White adds pressure on d5."],
          ["d5c4", "Now Black takes the pawn, ready to hold it."],
          ["a2a4", "White stops …b5, so the pawn on c4 can't be defended."],
          ["c8f5", "The bishop develops outside the pawn chain."],
          ["e2e3", "White prepares to regain the pawn."],
          ["e7e6", "Black closes the centre. The bishop is already out."],
          ["f1c4", "White regains the pawn."],
          ["f8b4", "Black pins the knight on c3, since the king is still on e1."],
        ], [
          ["What is the point of …c6 in the Slav?", ["It supports d5 and keeps the c8 bishop free", "It attacks d4", "It prepares castling"], 0, "A solid centre plus a free bishop is the Slav's big idea."],
          ["Why play …Bf5 before …e6?", ["So the bishop isn't locked in behind the pawn chain", "To attack the queen", "To win a pawn"], 0, "Once the bishop is outside, …e6 can safely close the centre."],
        ]),
      opening("kings-indian", "King's Indian Defence", "Let White build a centre, then attack it.",
        "In the King's Indian, Black allows White a big pawn centre and then attacks it with pieces and pawn breaks. The bishop on g7 plays a huge role. The games are often sharp.",
        "b", [
          ["d2d4", "White claims the centre."],
          ["g8f6", "A flexible move that controls e4."],
          ["c2c4", "White gains more space."],
          ["g7g6", "Prepares to place the bishop on g7."],
          ["b1c3", "White develops."],
          ["f8g7", "The bishop aims at the long diagonal, pressuring the centre."],
          ["e2e4", "White builds a large centre."],
          ["d7d6", "Black allows it, planning to undermine it later."],
          ["g1f3", "White develops."],
          ["e8g8", "Black castles to safety."],
          ["f1e2", "White prepares to castle."],
          ["e7e5", "Black strikes at the centre."],
        ], [
          ["What is Black's strategy in the King's Indian?", ["Let White build a big centre, then attack it with breaks like …e5 and …c5", "Trade all the pieces", "Only attack on the queenside"], 0, "Black counts on piece activity and timely pawn breaks."],
          ["Where does the bishop on g7 aim?", ["Along the long a1–h8 diagonal", "At the h-file", "At f2 only"], 0, "It hits the centre and White's queenside from a safe fortress."],
        ]),
      opening("nimzo", "Nimzo-Indian Defence", "Pin the knight and fight for e4.",
        "The Nimzo-Indian is one of the most respected answers to 1.d4. Black pins White's knight on c3 with …Bb4 to control the e4 square and often damages White's pawn structure.",
        "b", [
          ["d2d4", "White claims the centre."],
          ["g8f6", "Black develops and controls e4."],
          ["c2c4", "White gains space."],
          ["e7e6", "Prepares …Bb4 and keeps options open."],
          ["b1c3", "White develops."],
          ["f8b4", "The Nimzo pin! The bishop pressures the knight that guards e4."],
          ["e2e3", "A solid reply: White prepares Bd3 and Nf3."],
          ["e8g8", "Black castles."],
          ["f1d3", "White develops."],
          ["d7d5", "Black claims the centre."],
          ["g1f3", "White develops."],
          ["c7c5", "Black attacks White's centre."],
        ], [
          ["What does 3…Bb4 do?", ["Pins the c3 knight and fights for e4", "Wins a pawn", "Attacks the queen"], 0, "The knight on c3 is key to White controlling e4."],
          ["What can …Bxc3 do to White's structure?", ["Double White's pawns on the c-file", "Win a rook", "Nothing"], 0, "After bxc3, White has doubled pawns, a long-term weakness."],
        ]),
      opening("petrov", "Petrov Defence", "A solid, symmetrical reply to 1.e4 e5.",
        "The Petrov Defence, or Russian Game, is a solid way to meet 1.e4 e5 2.Nf3. Black counterattacks the e4 pawn rather than defending e5. Games are often balanced and strategic.",
        "b", [
          ["e2e4", "White takes the centre."],
          ["e7e5", "Black does the same."],
          ["g1f3", "White attacks e5."],
          ["g8f6", "The Petrov: Black counterattacks e4 instead of defending e5."],
          ["f3e5", "White takes the pawn."],
          ["d7d6", "Kicks the knight away first. Taking on e4 immediately would be a mistake."],
          ["e5f3", "The knight retreats."],
          ["f6e4", "Now Black takes the e4 pawn. Material is level."],
          ["d2d4", "White claims the centre."],
          ["d6d5", "Black builds a solid centre."],
          ["f1d3", "White attacks the knight on e4."],
          ["b8c6", "Black develops and puts pressure on d4."],
        ], [
          ["Why does Black play …d6 before capturing on e4?", ["Capturing at once runs into Qe2 and loses material", "To open the f-file", "To castle"], 0, "After 3…Nxe4? 4.Qe2 the knight is pinned and White wins material, so Black kicks the knight first."],
          ["What is the Petrov known for?", ["Solid, symmetrical, balanced positions", "Wild gambit attacks", "Early queen moves"], 0, "It is a sturdy defence that is hard to beat."],
        ]),
    ],
  },

];

export const allLessons = () => COURSES.flatMap((c) => c.lessons.map((l) => ({ course: c, lesson: l })));
export const lessonKey = (courseId: string, lessonId: string) => `${courseId}/${lessonId}`;
export const findCourse = (id: string) => COURSES.find((c) => c.id === id);
export function nextLesson(courseId: string, lessonId: string): { course: string; lesson: string } | null {
  const all = allLessons();
  const i = all.findIndex((x) => x.course.id === courseId && x.lesson.id === lessonId);
  const n = all[i + 1];
  return n ? { course: n.course.id, lesson: n.lesson.id } : null;
}
