const SIZE=8,WHITE='w',BLACK='b',mapBlack={};const clone=x=>JSON.parse(JSON.stringify(x));const inBounds=(r,c)=>r>=0&&r<8&&c>=0&&c<8;  const bankBasic   = ()=>({K:1,Q:1,R:1,B:1,N:1,P:3});
  const bankQueens  = ()=>({K:0,Q:4,R:0,B:0,N:0,P:0});
  const bankClassic = ()=>({K:1,Q:1,R:2,B:2,N:2,P:8});

  // --- State ---
  function makeFreshState(preset){
    const bank = preset==='basic'? bankBasic() : preset==='queens'? bankQueens() : bankClassic();
    return {
      board: Array.from({length:SIZE},()=>Array(SIZE).fill(null)),
      turn: WHITE,
      bank: {[WHITE]: clone(bank), [BLACK]: clone(bank)},
      selected: null, // {type,color, from?}
      history: [], log: [], moveHistory: [], fullMoveNumber: 1, lastAction: null,
      heatmap: true,
      gameMode: 'sudden', // 'sudden' | 'queens' | 'total'
      movementMode: 'none', // 'none' | 'lineOfSight' | 'anywhere'
      justStartedTurn: true,
      winner: null, draw:false,
      effectsShatter: [],
      preset,
      config: null,
      clock: {baseSeconds:0, remaining:{[WHITE]:0,[BLACK]:0}, lastTick:null, running:false},
      ai: {enabled:false, depth:3, style:'balanced', thinking:false, timerId:null}
    };
  }
  function squaresAttackedByOn(s,color){
    const attacked=new Map();
    const add=(rr,cc)=>{const k=rr+','+cc; attacked.set(k,(attacked.get(k)||0)+1)};
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const p=s.board[r][c]; if(!p||p.color!==color) continue;
      switch(p.type){
        case 'P':{ const dir=color===WHITE?-1:1; [[r+dir,c-1],[r+dir,c+1]].forEach(([rr,cc])=>{ if(inBounds(rr,cc)) add(rr,cc)}); break; }
        case 'N':{ [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>{const rr=r+dr,cc=c+dc; if(inBounds(rr,cc)) add(rr,cc)}); break; }
        case 'K':{ for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc){const rr=r+dr,cc=c+dc; if(inBounds(rr,cc)) add(rr,cc)} break; }
        case 'B': case 'R': case 'Q':{ const dirs=rayDirsFor(p.type); for(const [dr,dc] of dirs){ let rr=r+dr,cc=c+dc; while(inBounds(rr,cc)){ add(rr,cc); if(s.board[rr][cc]!==null) break; rr+=dr; cc+=dc; } } break; }
      }
    }
    return attacked;
  }
  const isEmptyOn=(s,r,c)=> s.board[r][c]===null;
  function rayDirsFor(t){ if(t==='B') return [[1,1],[1,-1],[-1,1],[-1,-1]]; if(t==='R') return [[1,0],[-1,0],[0,1],[0,-1]]; if(t==='Q') return [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]; return []; }

  function legalPlacementsOn(s,color){
    const enemy=color===WHITE?BLACK:WHITE;
    const friendMap=squaresAttackedByOn(s,color);
    const enemyMap=squaresAttackedByOn(s,enemy);
    const union=new Set();
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(!isEmptyOn(s,r,c)) continue; const k=r+','+c; const f=friendMap.get(k)||0, e=enemyMap.get(k)||0; if(e>f) continue; union.add(k);
    }
    return {union, friendMap, enemyMap};
  }

  function threatenedPiecesOfOn(s,color){
    const enemy=color===WHITE?BLACK:WHITE; const friendMap=squaresAttackedByOn(s,color); const enemyMap=squaresAttackedByOn(s,enemy); const out=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const p=s.board[r][c]; if(!p||p.color!==color) continue; const k=r+','+c; const f=friendMap.get(k)||0, e=enemyMap.get(k)||0; if(e>f) out.push([r,c]);
    }
    return out;
  }

  function hypotheticalAttacks(r,c,t,color, s=null){
    const set=new Set(); const add=(rr,cc)=> set.add(rr+','+cc);
    switch(t){
      case 'P':{ const dir=color===WHITE?-1:1; [[r+dir,c-1],[r+dir,c+1]].forEach(([rr,cc])=>{ if(inBounds(rr,cc)) add(rr,cc)}); break; }
      case 'N':{ [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>{const rr=r+dr,cc=c+dc; if(inBounds(rr,cc)) add(rr,cc)}); break; }
      case 'K':{ for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc){const rr=r+dr,cc=c+dc; if(inBounds(rr,cc)) add(rr,cc)} break; }
      case 'B': case 'R': case 'Q':{ const dirs=rayDirsFor(t); for(const [dr,dc] of dirs){ let rr=r+dr,cc=c+dc; while(inBounds(rr,cc)){ add(rr,cc); if(s && !isEmptyOn(s,rr,cc)) break; rr+=dr; cc+=dc; } } break; }
    }
    return set;
  }

  // --- Movement helpers ---
  const isEmpty=(r,c)=> state.board[r][c]===null;
  const placePiece=(r,c,t,color)=> state.board[r][c]={type:t,color};

  function losEmptyMovesFromOn(s,r,c,t,color){
    const moves=new Set();
    function add(rr,cc){ if(inBounds(rr,cc) && isEmptyOn(s,rr,cc)) moves.add(rr+","+cc); }
    if(t==='N'){
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>{const rr=r+dr,cc=c+dc; add(rr,cc);});
    } else if(t==='K'){
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc){ add(r+dr,c+dc); }
    } else if(t==='B' || t==='R' || t==='Q'){
      for(const [dr,dc] of rayDirsFor(t)){
        let rr=r+dr, cc=c+dc; while(inBounds(rr,cc)){
          if(!isEmptyOn(s,rr,cc)) break; moves.add(rr+","+cc); rr+=dr; cc+=dc;
        }
      }
    } else if(t==='P'){
      const dir=color===WHITE?-1:1; // allow diagonal steps only (attacking scope) if empty
      [[r+dir,c-1],[r+dir,c+1]].forEach(([rr,cc])=>{ if(inBounds(rr,cc)&&isEmptyOn(s,rr,cc)) moves.add(rr+","+cc); });
    }
    return moves;
  }

  function allEmptySquaresOn(s){ const o=new Set(); for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(isEmptyOn(s,r,c)) o.add(r+","+c); return o; }

  function afterMoveIsSafeOn(s, fromR,fromC,toR,toC){
    const current=s.turn, enemy=current===WHITE?BLACK:WHITE;
    const snap=clone(s);
    snap.board[fromR][fromC]=null;
    snap.board[toR][toC]={type:s.board[fromR][fromC].type, color:current};

    const friendMap=squaresAttackedByOn(snap,current);
    const enemyMap=squaresAttackedByOn(snap,enemy);
    const destKey=toR+","+toC;
    return (enemyMap.get(destKey)||0) <= (friendMap.get(destKey)||0);
  }

  function legalMoveTargetsOn(s,r,c){
    const p=s.board[r][c]; if(!p) return new Set();
    const cand = s.movementMode==='anywhere' ? allEmptySquaresOn(s) : losEmptyMovesFromOn(s,r,c,p.type,p.color);
    const out=new Set();
    for(const k of cand){
      const [rr,cc]=k.split(',').map(Number);
      if(afterMoveIsSafeOn(s,r,c,rr,cc)) out.add(k);
    }
    return out;
  }

  function countPiecesOnBoard(s,color){ let count=0; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ const p=s.board[r][c]; if(p && p.color===color) count++; } return count; }
  function bankPieces(s,color){ let sum=0; const b=s.bank[color]||{}; for(const k in b){ sum += b[k]||0; } return sum; }
  function totalPieces(s,color){ return countPiecesOnBoard(s,color) + bankPieces(s,color); }
  function queensRemaining(s,color){
    let on=0; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ const p=s.board[r][c]; if(p && p.color===color && p.type==='Q') on++; }
    return on + ((s.bank[color] && s.bank[color].Q) ? s.bank[color].Q : 0);
  }

  function resolveNoMovementEnd(s, silent=false) {
    if(s.movementMode !== 'none') return false;
    if(bankPieces(s, WHITE) !== 0 || bankPieces(s, BLACK) !== 0) return false;

    const whiteOnBoard=countPiecesOnBoard(s, WHITE);
    const blackOnBoard=countPiecesOnBoard(s, BLACK);
    if(whiteOnBoard > blackOnBoard) s.winner=WHITE;
    else if(blackOnBoard > whiteOnBoard) s.winner=BLACK;
    else s.draw=true;

    if(!silent){
      if(s.draw) s.log.push(`Game over: Draw with ${whiteOnBoard} pieces each`);
      else s.log.push(`Game over: ${s.winner===WHITE?'White':'Black'} wins with ${Math.max(whiteOnBoard,blackOnBoard)} pieces vs ${Math.min(whiteOnBoard,blackOnBoard)}`);
    }
    return true;
  }

  function snapshot(s){
    return {
      board: clone(s.board), turn: s.turn,
      bank: clone(s.bank), selected: clone(s.selected),
      history: s.history.slice(), log: s.log.slice(), moveHistory: clone(s.moveHistory), fullMoveNumber:s.fullMoveNumber, lastAction:clone(s.lastAction), heatmap: s.heatmap,
      gameMode: s.gameMode, movementMode: s.movementMode,
      justStartedTurn: s.justStartedTurn, winner: s.winner,
      draw: s.draw, effectsShatter: [], preset: s.preset,
      config: clone(s.config), clock: clone(s.clock), ai: clone(s.ai)
    };
  }

  function switchTurn(s, silent=false){
    s.turn=s.turn===WHITE?BLACK:WHITE;
    s.selected=null;
    s.justStartedTurn=true;
    if(!silent) updateCursor();
  }

  function resolveNoLegalAction(s, silent=false){
    if(generateActions(s).length>0) return false;
    const stuck=s.turn;
    s.winner=stuck===WHITE?BLACK:WHITE;
    if(!silent) s.log.push(`${stuck===WHITE?'White':'Black'} has no legal action.`);
    return true;
  }

  function resolveEndOfTurn(s, silent=false){
    const current=s.turn;
    const opponent=current===WHITE?BLACK:WHITE;

    // Sudden Death follows the written rule literally: inspect the whole position
    // after the player's action, not merely pieces that began the turn threatened.
    if(s.gameMode==='sudden'){
      const threatened=threatenedPiecesOfOn(s,current);
      if(threatened.length){
        s.winner=opponent;
        if(!silent) s.log.push(`${current===WHITE?'White':'Black'} ended the turn with ${threatened.length} outnumbered piece${threatened.length===1?'':'s'}.`);
        return true;
      }
      return false;
    }

    // Capture modes resolve simultaneous removals in rounds until the position is stable.
    let cascadeRounds=0;
    let totalDestroyed=0;
    while(true){
      const threatened=threatenedPiecesOfOn(s,current);
      if(!threatened.length) break;
      cascadeRounds++;

      const doomedInfo=[];
      for(const [r,c] of threatened){
        const piece=s.board[r][c];
        if(!piece || piece.color!==current) continue;
        doomedInfo.push({r,c,ch:mapBlack[piece.type],color:piece.color});
        s.board[r][c]=null;
        totalDestroyed++;
      }
      if(!silent && doomedInfo.length) s.effectsShatter.push(...doomedInfo);

      // Every round removes at least one piece, so SIZE*SIZE is a hard upper bound.
      if(cascadeRounds >= SIZE*SIZE) break;
    }

    if(!silent && totalDestroyed){
      s.log.push(`${current===WHITE?'White':'Black'} lost ${totalDestroyed} piece${totalDestroyed===1?'':'s'} in ${cascadeRounds} cascade round${cascadeRounds===1?'':'s'}.`);
      breakCrunch();
    }

    if(s.gameMode==='queens' && queensRemaining(s,current)===0){
      s.winner=opponent;
      return true;
    }
    if(s.gameMode==='total' && totalPieces(s,current)===0){
      if(totalPieces(s,opponent)===0) s.draw=true;
      else s.winner=opponent;
      return true;
    }
    return false;
  }

  function finishTurn(s, silent=false){
    if(resolveEndOfTurn(s,silent)) return true;
    if(resolveNoMovementEnd(s,silent)) return true;
    switchTurn(s,silent);
    if(resolveNoLegalAction(s,silent)) return true;
    return false;
  }

  function generateActions(s){
    const acts=[]; const color=s.turn;
    // Placements
    const {union} = legalPlacementsOn(s, color);
    const bank=s.bank[color];
    for(const t of ['Q','R','B','N','P','K']){ // slight heuristic ordering
      const cnt=bank[t]||0; if(cnt<=0) continue;
      for(const k of union){ const [r,c]=k.split(',').map(Number); acts.push({kind:'place', t, r, c}); }
    }
    // Moves
    if(s.movementMode!=='none'){
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
        const p=s.board[r][c]; if(!p||p.color!==color) continue;
        const tgts = legalMoveTargetsOn(s,r,c);
        for(const k of tgts){ const [rr,cc]=k.split(',').map(Number); acts.push({kind:'move', from:[r,c], to:[rr,cc], t:p.type}); }
      }
    }
    return acts;
  }

  function applyAction(s, action){
    const ns=snapshot(s);
    ns.history=[]; ns.effectsShatter=[]; ns.log=[];

    if(action.kind==='place'){
      if(!legalPlacementsOn(ns, ns.turn).union.has(action.r+","+action.c)) return null;
      if((ns.bank[ns.turn][action.t]||0)<=0) return null;
      ns.board[action.r][action.c] = {type: action.t, color: ns.turn};
      ns.bank[ns.turn][action.t] -= 1;
    } else if(action.kind==='move'){
      const [fr,fc]=action.from, [tr,tc]=action.to;
      const p=ns.board[fr][fc]; if(!p || p.color!==ns.turn) return null;
      const targets = legalMoveTargetsOn(ns, fr, fc);
      if(!targets.has(tr+","+tc)) return null;
      ns.board[fr][fc]=null; ns.board[tr][tc]=p;
    }

    finishTurn(ns, /*silent=*/true);
    return ns;
  }


this.api={makeFreshState,generateActions,applyAction,threatenedPiecesOfOn,squaresAttackedByOn};
module.exports=this.api;