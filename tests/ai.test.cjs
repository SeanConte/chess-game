const assert=require('node:assert/strict');
const e=require('../js/ai-engine.js').createEngine(),ref=require('./reference-rules.cjs');
const key=a=>a.kind==='place'?`p${a.t}${a.r}${a.c}`:`m${a.from}${a.to}`;
let seed=9481;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32};
function shuffled(a){return a.map(x=>({x,v:rand()})).sort((a,b)=>a.v-b.v).map(a=>a.x);}
let positions=0,transitions=0;
for(const mode of ['sudden','queens','total'])for(const movement of ['none','lineOfSight','anywhere'])for(const preset of ['basic','queens','classic']){
 let s=ref.makeFreshState(preset);s.gameMode=mode;s.movementMode=movement;
 for(let ply=0;ply<12&&!s.winner&&!s.draw;ply++){
  const n=e.fromGame(s),acts=ref.generateActions(s),compact=Array.from(e.actions(n));
  assert.deepEqual(acts.map(key).sort(),compact.map(e.external).map(key).sort());positions++;
  let survivors=[];
  for(const a of shuffled(acts).slice(0,10)){
   const ca=compact.find(b=>key(e.external(b))===key(a)),actual=e.play(n,ca),next=ref.applyAction(s,a),expected=e.fromGame(next);
   assert.deepEqual(actual.board,expected.board);assert.deepEqual(actual.banks,expected.banks);
   for(const prop of ['turn','winner','draw'])assert.equal(actual[prop],expected[prop]);transitions++;
   if(expected.winner!==-n.turn)survivors.push(next);
  }
  if(!acts.length)break;s=survivors.length?survivors[Math.floor(rand()*survivors.length)]:ref.applyAction(s,acts[0]);
 }
}
console.log(`Rule parity: ${positions} positions, ${transitions} transitions, 27 configurations`);
const empty=()=>({board:new Int8Array(64),banks:[new Int16Array(7),new Int16Array(7)],turn:-1,mode:'sudden',movement:'none',winner:0,draw:false});
function chosen(s,result){assert(result.act,'must return a move');const a=Array.from(e.actions(s)).find(a=>key(e.external(a))===key(result.act));assert(a,'move must be legal');return e.play(s,a);}
// A bank knight must rescue the attacked pawn/queen by equalizing control.
for(const mode of ['sudden','queens']){
 const s=empty();s.mode=mode;s.board[32]=4;s.board[36]=mode==='queens'?-5:-1;s.banks[0][5]=1;s.banks[1][2]=1;
 const result=e.run(s,{budget:200,maxDepth:2});const next=chosen(s,result);
 assert.notEqual(next.winner,1);assert.notEqual(next.board[36],0);
 console.log(mode,'rescue found',result.act);
}
// Defender removal opens a second capture round.
{
 const s=empty();s.mode='total';s.board[32]=4;s.board[20]=2;s.board[36]=-4;s.board[37]=-1;s.banks[0][1]=1;s.banks[1][1]=1;
 const next=e.play(s,{from:-1,to:63,t:1});assert.equal(next.board[36],0);assert.equal(next.board[37],0);console.log('Multi-round capture cascade correct');
}
// No-movement endgame is decided by survivors, not conventional material value.
{
 const s=empty();s.mode='total';s.board[0]=5;s.board[63]=-1;s.board[62]=-1;s.banks[1][1]=1;
 const result=e.run(s,{budget:200,maxDepth:2});assert.equal(chosen(s,result).winner,-1);console.log('Survivor-count ending won');
}
// Compare alpha-beta's two-ply result with an exhaustive reference minimax.
{
 const s=empty();s.mode='total';s.banks[0][1]=1;s.banks[1][1]=1;s.board[4]=2;s.board[60]=-2;
 function exact(s,d){if(s.winner||s.draw||!d)return e.evaluate(s,-1);const vals=Array.from(e.actions(s),a=>exact(e.play(s,a),d-1));return s.turn===-1?Math.max(...vals):Math.min(...vals);}
 const expected=exact(s,2),result=e.run(s,{budget:3000,maxDepth:2,extensions:0});assert.equal(result.completedDepth,2);assert.equal(result.score,expected);console.log('Two-ply score matches exhaustive search');
}
{
 const s=e.fromGame(ref.makeFreshState('classic'));s.turn=-1;
 for(const budget of [10,120,350]){const result=e.run(s,{budget});chosen(s,result);assert(result.elapsed<budget+250);console.log('Budget',budget,'ms:',Math.round(result.elapsed),'ms, depth',result.completedDepth,'nodes',result.nodes);}
}
console.log('AI tests passed');
