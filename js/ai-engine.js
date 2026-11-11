/* Chess II AI, 0.26. Self-contained factory supports workers and Node tests.
   Compact search positions contain no UI, clock, log, or undo history. */
(function(root){
function createEngine(){
  'use strict';
  const TYPES=' PNBRQK', VALUES=[0,1,3,3.2,5,8,3.5], WIN=1000000;
  const DIAG=[[1,1],[1,-1],[-1,1],[-1,-1]], STRAIGHT=[[1,0],[-1,0],[0,1],[0,-1]];
  const KNIGHT=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const KING=DIAG.concat(STRAIGHT), TIMEOUT={};
  const other=s=>-s, bankIndex=s=>s===1?0:1, inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
  function fromGame(s){
    return {board:Int8Array.from(s.board.flat().map(p=>p?(p.color==='w'?1:-1)*TYPES.indexOf(p.type):0)),
      banks:[1,-1].map(side=>Int16Array.from(Array.from({length:7},(_,t)=>s.bank[side===1?'w':'b'][TYPES[t]]||0))),
      turn:s.turn==='w'?1:-1,mode:s.gameMode,movement:s.movementMode,
      winner:s.winner?(s.winner==='w'?1:-1):0,draw:!!s.draw};
  }
  function copy(s){return {...s,board:s.board.slice(),banks:s.banks.map(b=>b.slice()),maps:null};}
  function attacks(board){
    const maps=[new Uint8Array(64),new Uint8Array(64)];
    for(let i=0;i<64;i++){
      const p=board[i];if(!p)continue;const side=Math.sign(p),t=Math.abs(p),r=i>>3,c=i&7,map=maps[bankIndex(side)];
      if(t===1||t===2||t===6){
        const dirs=t===1?[[side===1?-1:1,-1],[side===1?-1:1,1]]:t===2?KNIGHT:KING;
        for(const [dr,dc] of dirs)if(inside(r+dr,c+dc))map[(r+dr)*8+c+dc]++;
      }else{
        for(const [dr,dc] of t===3?DIAG:t===4?STRAIGHT:KING){
          let rr=r+dr,cc=c+dc;while(inside(rr,cc)){const j=rr*8+cc;map[j]++;if(board[j])break;rr+=dr;cc+=dc;}
        }
      }
    }return maps;
  }
  const maps=s=>s.maps||(s.maps=attacks(s.board));
  function threatened(s,side){const m=maps(s),own=m[bankIndex(side)],enemy=m[bankIndex(-side)];const out=[];
    for(let i=0;i<64;i++)if(Math.sign(s.board[i])===side&&enemy[i]>own[i])out.push(i);return out;}
  function totals(s,side,queenOnly=false){let n=0;const b=s.banks[bankIndex(side)];
    for(let t=1;t<=6;t++)if(!queenOnly||t===5)n+=b[t];
    for(const p of s.board)if(Math.sign(p)===side&&(!queenOnly||Math.abs(p)===5))n++;return n;}
  function* actions(s){
    if(s.winner||s.draw)return;
    const side=s.turn,idx=bankIndex(side),m=maps(s),bank=s.banks[idx];
    for(const t of [5,4,3,2,6,1])if(bank[t]>0)
      for(let to=0;to<64;to++)if(!s.board[to]&&m[1-idx][to]<=m[idx][to])yield {from:-1,to,t};
    if(s.movement==='none')return;
    for(let from=0;from<64;from++){
      const p=s.board[from];if(Math.sign(p)!==side)continue;const t=Math.abs(p),r=from>>3,c=from&7,candidates=[];
      if(s.movement==='anywhere'){
        for(let to=0;to<64;to++)if(!s.board[to])candidates.push(to);
      }else if(t===1||t===2||t===6){
        for(const [dr,dc] of t===1?[[side===1?-1:1,-1],[side===1?-1:1,1]]:t===2?KNIGHT:KING)
          if(inside(r+dr,c+dc)&&!s.board[(r+dr)*8+c+dc])candidates.push((r+dr)*8+c+dc);
      }else{
        for(const [dr,dc] of t===3?DIAG:t===4?STRAIGHT:KING){let rr=r+dr,cc=c+dc;
          while(inside(rr,cc)&&!s.board[rr*8+cc]){candidates.push(rr*8+cc);rr+=dr;cc+=dc;}}
      }
      for(const to of candidates){
        // Destination safety must use occupancy AFTER the move (opened rays matter).
        const board=s.board.slice();board[from]=0;board[to]=p;const after=attacks(board);
        if(after[1-idx][to]<=after[idx][to])yield {from,to,t};
      }
    }
  }
  function hasAction(s){return !actions(s).next().done;}
  function play(s,a){
    const n=copy(s),side=s.turn;
    if(a.from<0)n.banks[bankIndex(side)][a.t]--;else n.board[a.from]=0;
    n.board[a.to]=side*a.t;
    let doomed=threatened(n,side);
    if(n.mode==='sudden'&&doomed.length){n.winner=-side;return n;}
    while(doomed.length){for(const i of doomed)n.board[i]=0;n.maps=null;doomed=threatened(n,side);}
    if(n.mode==='queens'&&!totals(n,side,true)){n.winner=-side;return n;}
    if(n.mode==='total'&&!totals(n,side)){if(!totals(n,-side))n.draw=true;else n.winner=-side;return n;}
    if(n.movement==='none'&&n.banks.every(b=>!b.some(v=>v>0))){
      const d=totals(n,1)-totals(n,-1);n.winner=Math.sign(d);n.draw=d===0;return n;
    }
    n.turn=-side;
    // Check lazily and stop on the first legal action, rather than building a full list.
    if(!hasAction(n))n.winner=side;
    return n;
  }
  function evaluate(s,pov,style='balanced'){
    if(s.winner)return s.winner===pov?WIN:-WIN;if(s.draw)return 0;
    const m=maps(s),v=[0,0];
    for(const side of [1,-1]){
      const k=bankIndex(side),b=s.banks[k];
      const pressure=side===pov?(style==='defensive'?1.25:1):(style==='aggressive'?1.25:1);
      let count=0,material=0,queens=0,space=0;
      for(let t=1;t<=6;t++){count+=b[t];material+=b[t]*VALUES[t];if(t===5)queens+=b[t];}
      for(let i=0;i<64;i++){
        const p=s.board[i],own=m[k][i],enemy=m[1-k][i];
        if(!p){if(own>=enemy)space++;v[k]+=Math.min(2,Math.max(0,own-enemy))*.4;}
        if(Math.sign(p)!==side)continue;
        const t=Math.abs(p);count++;material+=VALUES[t];if(t===5)queens++;
        // Outnumbered pieces have one turn to be rescued: pressure is not a capture.
        if(enemy>own)v[k]-=(s.mode==='sudden'?180:(s.mode==='queens'&&t===5?200:40+VALUES[t]*5))*pressure;
        else v[k]+=Math.min(2,own-enemy)*2;
      }
      v[k]+=count*(s.mode==='total'||s.movement==='none'?100:35)+material*4+space*1.2;
      if(s.mode==='queens')v[k]+=queens*350;
    }
    return (v[0]-v[1])*pov;
  }
  const actionKey=a=>a?`${a.from}:${a.to}:${a.t}`:'';
  function key(s){return `${s.turn}/${Array.from(s.board).join(',')}/${s.banks.map(b=>Array.from(b).join(',')).join('/')}`;}
  function external(a){return a.from<0?{kind:'place',t:TYPES[a.t],r:a.to>>3,c:a.to&7}:
    {kind:'move',t:TYPES[a.t],from:[a.from>>3,a.from&7],to:[a.to>>3,a.to&7]};}
  function* search(input,options={}){
    const s=input.board.length===8?fromGame(input):copy(input),pov=s.turn;
    const start=performance.now(),budget=Math.max(10,options.budget||700),deadline=start+budget;
    const table=new Map(),style=options.style||'balanced';let nodes=0,completedDepth=0,best=null,score=-Infinity;
    function guard(){if(performance.now()>=deadline)throw TIMEOUT;}
    function result(){return {act:best?external(best):null,score:Number.isFinite(score)?score:0,completedDepth,nodes,elapsed:performance.now()-start};}
    function* checkpoint(){nodes++;if((nodes&15)===0){yield null;guard();}}
    function ordered(pos,preferred){
      const idx=bankIndex(pos.turn),m=maps(pos),rows=[];
      for(const a of actions(pos)){guard();const r=a.to>>3,c=a.to&7;
        let rank=7-Math.abs(3.5-r)-Math.abs(3.5-c)+m[idx][a.to]*.4;
        if(a.from>=0&&m[1-idx][a.from]>m[idx][a.from])rank+=50;
        if(actionKey(a)===preferred)rank+=1e6;
        rows.push({a,rank});
      }rows.sort((a,b)=>b.rank-a.rank);return rows;
    }
    function* visit(pos,depth,alpha,beta,extension){
      yield* checkpoint();guard();
      if(pos.winner||pos.draw)return evaluate(pos,pov,style);
      // Extend unsettled positions; never let rescue/cascade tactics stop at the horizon.
      if(depth<=0){if(extension>0&&threatened(pos,pos.turn).length){depth=1;extension--;}else return evaluate(pos,pov,style);}
      const hash=key(pos)+'/'+extension,old=table.get(hash),alphaStart=alpha,betaStart=beta;
      if(old&&old.depth>=depth){if(old.flag==='exact')return old.value;if(old.flag==='lower')alpha=Math.max(alpha,old.value);else beta=Math.min(beta,old.value);if(alpha>=beta)return old.value;}
      const maximizing=pos.turn===pov;let value=maximizing?-Infinity:Infinity,choice=null;
      const rows=ordered(pos,old?.best);
      if(!rows.length)return maximizing?-WIN:WIN;
      for(const {a} of rows){const child=play(pos,a);const v=yield* visit(child,depth-1,alpha,beta,extension);
        if(choice===null||(maximizing?v>value:v<value)){value=v;choice=a;}
        if(maximizing)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);
        if(alpha>=beta)break;
      }
      const flag=value<=alphaStart?'upper':value>=betaStart?'lower':'exact';
      if(table.size>50000)table.clear();
      table.set(hash,{depth,value,flag,best:actionKey(choice)});return value;
    }
    try{
      // Publish a legal fallback before any expensive work. Partial root scans keep
      // their best result; an unfinished deeper iteration never replaces a complete one.
      if(s.winner||s.draw){score=evaluate(s,pov,style);return result();}
      const first=actions(s).next();if(first.done){score=-WIN;return result();}best=first.value;yield result();
      const roots=[];
      for(const a of actions(s)){
        guard();const child=play(s,a),v=evaluate(child,pov,style);nodes++;roots.push({a,child,value:v});
        if(v>score){score=v;best=a;yield result();}
        if(child.winner===pov){completedDepth=1;return result();}
        yield null;
      }
      completedDepth=1;roots.sort((a,b)=>b.value-a.value);yield result();
      for(let depth=2;depth<=(options.maxDepth||32);depth++){
        guard();let value=-Infinity,choice=best,alpha=-Infinity;const values=[];
        for(const row of roots){
          const v=yield* visit(row.child,depth-1,alpha,Infinity,options.extensions??1);
          values.push({row,value:v});if(v>value){value=v;choice=row.a;}alpha=Math.max(alpha,value);
        }
        best=choice;score=value;completedDepth=depth;
        // Bound-valued losing siblings are useful for ordering only, never exact TT entries.
        for(const x of values)x.row.value=x.value;roots.sort((a,b)=>b.value-a.value);
        yield result();if(Math.abs(value)>=WIN)break;
      }
    }catch(e){if(e!==TIMEOUT)throw e;}
    return result();
  }
  function run(s,o){const it=search(s,o);let step;do{step=it.next();}while(!step.done);return step.value;}
  return {fromGame,actions,play,attacks,threatened,totals,evaluate,search,run,external,actionKey};
}
const api={createEngine};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ChessAI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
