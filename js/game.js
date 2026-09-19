// ---- Minimal error reporter to surface issues if rendering stalls ----
  const errBox = document.getElementById('err');
  window.addEventListener('error', (ev)=>{
    errBox.style.display='block';
    errBox.textContent = 'JS Error: '+ (ev.message||'unknown') + '\n' + (ev.filename||'') + ':' + (ev.lineno||'');
  });
  window.addEventListener('unhandledrejection', (ev)=>{
    errBox.style.display='block';
    errBox.textContent = 'Unhandled promise rejection: '+ (ev.reason && ev.reason.message ? ev.reason.message : ev.reason);
  });

  // --- Audio (guarded; will no-op if blocked) ---
  let audioCtx = null;
  function getCtx(){
    if(audioCtx) return audioCtx;
    try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
    catch(e){ audioCtx = null; }
    return audioCtx;
  }
  // Arm audio context once on user gesture
  function armAudioOnce(){
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{});
    window.removeEventListener('pointerdown', armAudioOnce);
    window.removeEventListener('keydown', armAudioOnce);
  }
  window.addEventListener('pointerdown', armAudioOnce, { once:true });
  window.addEventListener('keydown', armAudioOnce, { once:true });

  function env(g, a=0.005, d=0.15, peak=1){ const ctx=getCtx(); if(!ctx||!g||!g.gain) return; const now=ctx.currentTime; g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(peak, now+a); g.gain.exponentialRampToValueAtTime(0.0001, now+a+d); }
  function mkNoise(len=4410){ const ctx=getCtx(); if(!ctx) return null; const b=ctx.createBuffer(1,len,44100); const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1); const s=ctx.createBufferSource(); s.buffer=b; return {source:s, ctx}; }

  // ---- Theme-aware sound design -------------------------------------------
  // Shared synth primitives. Every theme gets its own five-voice set:
  //   action  – select / place / move        (was woodClick)
  //   deny    – illegal action               (was errorMuffle)
  //   alert   – threat warning at turn start (was parchment)
  //   shatter – elimination cascade          (was breakCrunch)
  //   end     – game over / timeout          (was bell)
  let masterGain=null;
  function master(){ const ctx=getCtx(); if(!ctx) return null; if(!masterGain){ masterGain=ctx.createGain(); masterGain.gain.value=0.55; masterGain.connect(ctx.destination);} return masterGain; }
  function tone(o={}){
    const ctx=getCtx(); const out=master(); if(!ctx||!out) return;
    const {f0=440,f1=null,dur=0.15,type='sine',gain=0.6,a=0.004,lp=null,hp=null,q=0.8,delay=0,curve='exp'}=o;
    const t0=ctx.currentTime+delay;
    const osc=ctx.createOscillator(); osc.type=type;
    osc.frequency.setValueAtTime(Math.max(20,f0),t0);
    if(f1) {
      if(curve==='lin') osc.frequency.linearRampToValueAtTime(Math.max(20,f1),t0+dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t0+dur);
    }
    const g=ctx.createGain();
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(gain,t0+a);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+a+dur);
    let node=osc;
    if(lp){ const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp; f.Q.value=q; node.connect(f); node=f; }
    if(hp){ const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp; f.Q.value=q; node.connect(f); node=f; }
    node.connect(g); g.connect(out);
    osc.start(t0); osc.stop(t0+a+dur+0.02);
  }
  function noise(o={}){
    const ctx=getCtx(); const out=master(); if(!ctx||!out) return;
    const {dur=0.12,gain=0.6,a=0.002,lp=null,hp=null,bp=null,bp1=null,q=0.8,delay=0}=o;
    const t0=ctx.currentTime+delay;
    const pack=mkNoise(Math.ceil(44100*(dur+0.05))); if(!pack) return;
    const n=pack.source;
    let node=n;
    if(bp){ const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.setValueAtTime(bp,t0); if(bp1) f.frequency.exponentialRampToValueAtTime(bp1,t0+dur); f.Q.value=q; node.connect(f); node=f; }
    if(lp){ const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp; f.Q.value=q; node.connect(f); node=f; }
    if(hp){ const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp; f.Q.value=q; node.connect(f); node=f; }
    const g=ctx.createGain();
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(gain,t0+a);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+a+dur);
    node.connect(g); g.connect(out);
    n.start(t0); n.stop(t0+dur+0.03);
  }

  const SFX={
    // -- Classic Slate: the original neutral studio set --------------------
    classic:{
      action(){ noise({dur:0.09,gain:0.8,lp:450,q:0.7}); tone({f0:110,f1:85,dur:0.11,type:'sine',gain:0.65}); },
      deny(){ tone({f0:160,dur:0.18,type:'triangle',gain:0.6,lp:420}); },
      alert(){ noise({dur:0.25,gain:0.55,hp:1200}); },
      shatter(){ noise({dur:0.08,gain:0.7,hp:1500}); tone({f0:120,f1:70,dur:0.22,type:'sine',gain:0.8}); },
      end(){ tone({f0:740,dur:0.7,type:'sine',gain:0.7,a:0.004}); }
    },
    // -- Stone & Onyx: mass, grit, and cathedral air ------------------------
    fantasy:{
      action(){
        // Dry stone knock. Deliberately no sustained high partial: a ringing
        // 1-4kHz tail is what makes a click read as thin metal, not marble.
        noise({dur:0.007,gain:0.8,lp:5200,q:0.5});
        noise({dur:0.02,gain:0.42,bp:1400,q:0.9});
        tone({f0:430,f1:300,dur:0.032,type:'sine',gain:0.5});
        tone({f0:158,f1:112,dur:0.075,type:'sine',gain:0.55});
      },
      deny(){ tone({f0:120,f1:96,dur:0.2,type:'triangle',gain:0.6,lp:300}); },
      alert(){
        tone({f0:82,dur:0.55,type:'sine',gain:0.5,a:0.08});
        tone({f0:83.4,dur:0.55,type:'sine',gain:0.42,a:0.08});   // beat/drone
        tone({f0:2200,dur:0.4,type:'sine',gain:0.07,a:0.02,delay:0.08}); // far ring
      },
      shatter(){
        noise({dur:0.09,gain:0.75,hp:1800,q:0.7});               // crack
        noise({dur:0.3,gain:0.55,lp:260,q:0.6,delay:0.03});      // rubble
        noise({dur:0.14,gain:0.3,bp:640,q:3,delay:0.1});
        tone({f0:105,f1:52,dur:0.32,type:'sine',gain:0.9,delay:0.015});
      },
      end(){
        tone({f0:392,dur:1.4,type:'sine',gain:0.55,a:0.005});
        tone({f0:786,dur:1.2,type:'sine',gain:0.3,a:0.005});
        tone({f0:1179,dur:0.9,type:'sine',gain:0.12,a:0.005});
        tone({f0:392*1.5,dur:1.1,type:'sine',gain:0.18,a:0.005,delay:0.4});
      }
    },
    // -- Neon: circuitry, sweeps, and arcade sparkle ------------------------
    neon:{
      action(){
        // codec blip: clean mid pulse, slight detune, quick gate
        tone({f0:392,dur:0.045,type:'square',gain:0.20,lp:1500,q:1.2});
        tone({f0:394.5,dur:0.045,type:'square',gain:0.14,lp:1500,q:1.2});
        tone({f0:1568,dur:0.016,type:'sine',gain:0.07,delay:0.002});
      },
      deny(){
        // low denial buzz, filtered and short
        tone({f0:98,f1:73,dur:0.2,type:'sawtooth',gain:0.34,lp:520,q:3,curve:'lin'});
        tone({f0:196,f1:146,dur:0.16,type:'square',gain:0.12,lp:700,q:2,curve:'lin'});
      },
      alert(){
        // the "!" sting: metallic hit, then a tense minor-second pair
        noise({dur:0.05,gain:0.42,bp:3000,q:1.4});
        tone({f0:1174.7,dur:0.1,type:'square',gain:0.2,lp:2600,q:1.4});
        tone({f0:1108.7,dur:0.34,type:'sawtooth',gain:0.17,lp:1900,q:2,delay:0.1});
        tone({f0:146.8,dur:0.5,type:'sawtooth',gain:0.2,lp:420,q:2,a:0.01});
        tone({f0:147.6,dur:0.5,type:'sawtooth',gain:0.15,lp:420,q:2,a:0.01});
      },
      shatter(){
        // heavy impact plus metallic debris
        tone({f0:150,f1:42,dur:0.34,type:'sine',gain:0.85});
        noise({dur:0.05,gain:0.45,hp:2600});
        noise({dur:0.26,gain:0.22,bp:1800,bp1:520,q:1.6,delay:0.03});
        tone({f0:880,f1:220,dur:0.18,type:'sawtooth',gain:0.14,lp:1800,delay:0.02});
      },
      end(){
        // sombre minor cadence, tactical rather than triumphant
        const chord=[146.8,220,261.6,349.2];
        chord.forEach((f,i)=>{
          tone({f0:f,dur:1.5,type:'sawtooth',gain:0.15,lp:900,q:1.4,a:0.06,delay:i*0.05});
          tone({f0:f*1.004,dur:1.5,type:'sawtooth',gain:0.1,lp:900,q:1.4,a:0.06,delay:i*0.05});
        });
        tone({f0:1046.5,dur:0.5,type:'sine',gain:0.09,delay:0.5});
        tone({f0:1567.98,dur:0.4,type:'sine',gain:0.05,delay:0.62});
      }
    },
    // -- Parchment: felt, paper, and a desk bell ----------------------------
    parchment:{
      action(){
        noise({dur:0.045,gain:0.5,lp:900,q:0.7});
        tone({f0:220,f1:170,dur:0.07,type:'sine',gain:0.35});
      },
      deny(){
        tone({f0:185,dur:0.07,type:'triangle',gain:0.4,lp:520});
        tone({f0:165,dur:0.09,type:'triangle',gain:0.36,lp:480,delay:0.09});
      },
      alert(){ // page turn: two crinkles sweeping up
        noise({dur:0.18,gain:0.6,bp:1200,bp1:2400,q:1.1});
        noise({dur:0.16,gain:0.5,bp:1600,bp1:2900,q:1.1,delay:0.13});
      },
      shatter(){ // paper tear
        noise({dur:0.24,gain:0.55,bp:2800,bp1:700,q:1.4});
        noise({dur:0.1,gain:0.3,hp:3400,delay:0.03});
        tone({f0:150,f1:105,dur:0.14,type:'sine',gain:0.3,delay:0.1});
      },
      end(){ // small brass desk bell
        tone({f0:1318.5,dur:0.85,type:'sine',gain:0.4,a:0.002});
        tone({f0:2637,dur:0.55,type:'sine',gain:0.14,a:0.002});
        tone({f0:3520,dur:0.3,type:'sine',gain:0.05,a:0.002});
      }
    },
    // -- Art Deco: marble, glass, and a brass lounge ------------------------
    deco:{
      action(){
        noise({dur:0.035,gain:0.42,bp:2400,q:1.6});              // marble tick
        tone({f0:1046.5,dur:0.05,type:'sine',gain:0.1,delay:0.008});
        tone({f0:140,f1:110,dur:0.07,type:'sine',gain:0.3});
      },
      deny(){ // muted-brass wah
        tone({f0:155,f1:118,dur:0.2,type:'triangle',gain:0.42,lp:640,q:2.4,curve:'lin'});
      },
      alert(){ // two-note muted brass motif
        tone({f0:392,dur:0.16,type:'sawtooth',gain:0.16,lp:1100,q:1.6,a:0.03});
        tone({f0:392.9,dur:0.16,type:'sawtooth',gain:0.12,lp:1100,q:1.6,a:0.03});
        tone({f0:493.9,dur:0.24,type:'sawtooth',gain:0.16,lp:1200,q:1.6,a:0.03,delay:0.17});
        tone({f0:494.9,dur:0.24,type:'sawtooth',gain:0.12,lp:1200,q:1.6,a:0.03,delay:0.17});
      },
      shatter(){ // glass over a marble floor
        noise({dur:0.07,gain:0.5,hp:4200});
        [2093,2637,3136].forEach((f,i)=>tone({f0:f,dur:0.18,type:'sine',gain:0.14,delay:0.02+i*0.035}));
        tone({f0:110,f1:60,dur:0.24,type:'sine',gain:0.6,delay:0.02});
      },
      end(){ // gentle fanfare roll on a major sixth
        const seq=[523.25,659.25,783.99,880];
        seq.forEach((f,i)=>{
          tone({f0:f,dur:0.6,type:'sawtooth',gain:0.12,lp:1800,q:1,delay:i*0.07,a:0.02});
          tone({f0:f*1.002,dur:0.6,type:'sawtooth',gain:0.08,lp:1800,q:1,delay:i*0.07,a:0.02});
        });
        tone({f0:1046.5,dur:0.7,type:'sine',gain:0.12,delay:0.32});
      }
    }
  };
  function sfxSet(){ return SFX[document.documentElement.dataset.theme] || SFX.classic; }
  function woodClick(){ sfxSet().action(); }
  function parchment(){ sfxSet().alert(); }
  function bell(){ sfxSet().end(); }
  function errorMuffle(){ sfxSet().deny(); }
  function breakCrunch(){ sfxSet().shatter(); }

  // --- Constants and helpers ---
  const SIZE=8, WHITE='w', BLACK='b';
  const mapBlack = {K:'\u265A', Q:'\u265B', R:'\u265C', B:'\u265D', N:'\u265E', P:'\u265F'}; // glyph fallbacks
  const pieceSlug = {K:'king',Q:'queen',R:'rook',B:'bishop',N:'knight',P:'pawn'};
  function pieceAssetPath(type,color){ const slug=pieceSlug[type]+'-'+(color===WHITE?'ivory':'onyx'); return `./assets/pieces/stone-onyx-renders/${slug}.png`; }
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const inBounds = (r,c)=> r>=0 && r<SIZE && c>=0 && c<SIZE;

  // --- Banks presets ---
  const bankBasic   = ()=>({K:1,Q:1,R:1,B:1,N:1,P:3});
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
  let state = makeFreshState('basic');
  // Visual-only: algebraic square of the most recent placement/move, used for
  // the amber "last action" board highlight. Not part of game state.
  let lastVisualSquare = null;

  // --- DOM refs ---
  const boardEl=document.getElementById('board');
  const bankWhiteEl=document.getElementById('bankWhite');
  const bankBlackEl=document.getElementById('bankBlack');
  const statusEl=document.getElementById('status');
  const statusDetailEl=document.getElementById('statusDetail');
  const modeStatusEl=document.getElementById('modeStatus');
  const movementStatusEl=document.getElementById('movementStatus');
  const turnCounterEl=document.getElementById('turnCounter');
  const turnDotEl=document.getElementById('turnDot');
  const winnerEl=document.getElementById('winner');
  const logList=document.getElementById('logList');
  const moveHistoryBody=document.getElementById('moveHistoryBody');
  const moveHistoryScroll=document.getElementById('moveHistoryScroll');
  const historyPrev=document.getElementById('historyPrev');
  const historyNext=document.getElementById('historyNext');
  const historyMeta=document.getElementById('historyMeta');
  const whiteMaterialCount=document.getElementById('whiteMaterialCount');
  const blackMaterialCount=document.getElementById('blackMaterialCount');
  const clockWhite=document.getElementById('clockWhite');
  const clockBlack=document.getElementById('clockBlack');
  const clockWhiteCaption=document.getElementById('clockWhiteCaption');
  const clockBlackCaption=document.getElementById('clockBlackCaption');
  const whiteClockBlock=document.getElementById('whiteClockBlock');
  const blackClockBlock=document.getElementById('blackClockBlock');
  const btnUndo=document.getElementById('btnUndo');
  const btnRestart=document.getElementById('btnRestart');
  const btnExit=document.getElementById('btnExit');

  // Setup refs
  const setupView=document.getElementById('setupView');
  const gameWrap=document.getElementById('gameWrap');
  const btnStart=document.getElementById('btnStart');
  const btnSetupRules=document.getElementById('btnSetupRules');
  const heatmapSetup=document.getElementById('heatmapSetup');
  const gameModeSetup=document.getElementById('gameModeSetup');
  const movementSetup=document.getElementById('movementSetup');
  const armySetup=document.getElementById('armySetup');
  const timeControlSetup=document.getElementById('timeControlSetup');
  const aiEnable=document.getElementById('aiEnable');
  const aiDepth=document.getElementById('aiDepth');
  const aiStyle=document.getElementById('aiStyle');
  const setupSummary=document.getElementById('setupSummary');

  // Modal / theme refs
  const btnSettings=document.getElementById('btnSettings');
  const settingsBackdrop=document.getElementById('settingsBackdrop');
  const btnCloseSettings=document.getElementById('btnCloseSettings');
  const settingsHeatmap=document.getElementById('settingsHeatmap');
  const btnRules=document.getElementById('btnRules');
  const rulesBackdrop=document.getElementById('rulesBackdrop');
  const btnCloseRules=document.getElementById('btnCloseRules');
  const themeChoices=[...document.querySelectorAll('[data-theme-choice]')];

  const THEMES=new Set(['fantasy','classic','neon','parchment','deco']);
  function readStoredTheme(){
    try{ const t=localStorage.getItem('chessII.theme'); return THEMES.has(t)?t:null; }catch{ return null; }
  }
  function storeTheme(t){ try{ localStorage.setItem('chessII.theme',t); }catch{} }
  function applyTheme(theme,persist=true){
    const t=THEMES.has(theme)?theme:'fantasy';
    document.documentElement.dataset.theme=t;
    themeChoices.forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.themeChoice===t)));
    if(persist) storeTheme(t);
    if(state && boardEl.children.length) renderBoard();
    updateCursor();
  }
  function openModal(backdrop,focusEl){ backdrop.classList.remove('hidden'); backdrop.setAttribute('aria-hidden','false'); focusEl?.focus(); }
  function closeModal(backdrop,returnFocus){ backdrop.classList.add('hidden'); backdrop.setAttribute('aria-hidden','true'); returnFocus?.focus(); }
  const openSettings=()=>openModal(settingsBackdrop,btnCloseSettings);
  const closeSettings=()=>closeModal(settingsBackdrop,btnSettings);
  const openRules=()=>openModal(rulesBackdrop,btnCloseRules);
  const closeRules=()=>closeModal(rulesBackdrop,btnRules);
  btnSettings.addEventListener('click',openSettings);
  btnCloseSettings.addEventListener('click',closeSettings);
  btnRules.addEventListener('click',openRules);
  btnSetupRules.addEventListener('click',openRules);
  btnCloseRules.addEventListener('click',closeRules);
  settingsBackdrop.addEventListener('click',ev=>{ if(ev.target===settingsBackdrop) closeSettings(); });
  rulesBackdrop.addEventListener('click',ev=>{ if(ev.target===rulesBackdrop) closeRules(); });
  window.addEventListener('keydown',ev=>{
    if(ev.key!=='Escape') return;
    if(!settingsBackdrop.classList.contains('hidden')) closeSettings();
    else if(!rulesBackdrop.classList.contains('hidden')) closeRules();
  });
  themeChoices.forEach(btn=>btn.addEventListener('click',()=>applyTheme(btn.dataset.themeChoice)));

  let lastConfig = null;

  // --- Shared threat/attack utilities parameterized by a given state ---
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

  // --- Rendering ---
  function renderPieceGlyph(t,color){
    const ch=mapBlack[t];
    const cls=(color===WHITE?'gIvory':'gOnyx');
    return `<span class="glyph ${cls}"><span class="glyph-fallback" aria-hidden="true">${ch}</span><img class="piece-art" src="${pieceAssetPath(t,color)}" alt="" draggable="false" aria-hidden="true"></span>`;
  }

  // Heatmap intensity from net control
  function heatColor(f,e){
    const diff=f-e;
    if(diff===0) return null;
    const intensity=Math.min(Math.abs(diff),10);
    const root=getComputedStyle(document.documentElement);
    const friendly=root.getPropertyValue('--heat-friendly-rgb').trim()||'16,185,129';
    const enemy=root.getPropertyValue('--heat-enemy-rgb').trim()||'239,71,111';
    const minAlpha=parseFloat(root.getPropertyValue('--heat-alpha-min'))||.20;
    const maxAlpha=parseFloat(root.getPropertyValue('--heat-alpha-max'))||.78;
    const alpha=minAlpha+(intensity/10)*(maxAlpha-minAlpha);
    return `rgba(${diff>0?friendly:enemy},${alpha})`;
  }

  function clearPreviews(){ document.querySelectorAll('.marker.preview').forEach(el=>el.remove()); document.querySelectorAll('.sq.hover-target').forEach(el=>el.classList.remove('hover-target')); }
  function renderPreview(set){ for(const k of set){ const [rr,cc]=k.split(',').map(Number); const idx=rr*SIZE+cc; const sq=boardEl.children[idx]; if(!sq) continue; const m=document.createElement('div'); m.className='marker preview'; sq.appendChild(m);} }

  function renderBoard(){
    boardEl.innerHTML='';
    const {union, friendMap, enemyMap}=legalPlacementsOn(state,state.turn);
    const selectedType=state.selected?.type||null;
    const lastActionSquare=lastVisualSquare;
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const sq=document.createElement('div'); sq.className='sq '+(((r+c)%2===0)?'sq-a':'sq-b'); sq.dataset.r=r; sq.dataset.c=c;
      const p=state.board[r][c]; if(p){ sq.innerHTML=renderPieceGlyph(p.type,p.color); }

      /* visual amber highlight on the square of the previous action */
      if(lastActionSquare && coordToAlg(r,c)===lastActionSquare && p){ sq.classList.add('last-action'); }

      /* visual blue highlight when a board piece is selected to move */
      if(state.selected && state.selected.from && state.selected.from.r===r && state.selected.from.c===c){
        sq.classList.add('selected-board');
      }

      if(state.heatmap){
        const k=r+','+c;
        const f=(friendMap.get(k)||0), e=(enemyMap.get(k)||0), diff=f-e;
        const col=heatColor(f,e);
        if(col){
          const m=document.createElement('div');
          m.className='marker heat ' + (diff>0?'heat-friendly':'heat-enemy');
          m.style.background=col;
          const heatLevel=Math.min(Math.abs(diff),6);
          m.style.setProperty('--heat-level',String(heatLevel));
          m.style.setProperty('--heat-size',`${9+heatLevel*1.8}px`);
          m.style.setProperty('--heat-glow',`${6+heatLevel*2.2}px`);
          const root=getComputedStyle(document.documentElement);
          m.style.setProperty('--heat-rgb',(diff>0?root.getPropertyValue('--heat-friendly-rgb'):root.getPropertyValue('--heat-enemy-rgb')).trim());
          sq.appendChild(m);
        }
      }

      // events
      sq.addEventListener('mouseenter',()=>{
        clearPreviews();
        if(state.selected && state.selected.from){ // moving a board piece
          const targets = legalMoveTargetsOn(state, state.selected.from.r, state.selected.from.c);
          if(targets.has(r+","+c)){ renderPreview(hypotheticalAttacks(r,c,state.selected.type,state.turn,state)); sq.classList.add('hover-target'); }
        } else if(selectedType){ // bank placement hover preview
          const key=r+','+c; if(!union.has(key)||!isEmpty(r,c)) return; renderPreview(hypotheticalAttacks(r,c,selectedType,state.turn,state)); sq.classList.add('hover-target');
        }
      });
      sq.addEventListener('mouseleave',clearPreviews);

      sq.addEventListener('click',()=>onSquareClick(r,c));

      boardEl.appendChild(sq);
    }

    // draw threatened rings
    const currentThreats=threatenedPiecesOfOn(state,state.turn);
    for(const [rr,cc] of currentThreats){ const idx=rr*SIZE+cc; const sq=boardEl.children[idx]; if(sq){ const ring=document.createElement('div'); ring.className='ring'; sq.appendChild(ring);} }
    if(state.justStartedTurn && currentThreats.length){ parchment(); for(const [rr,cc] of currentThreats){ const idx=rr*SIZE+cc; const sq=boardEl.children[idx]; if(sq){ const ar=document.createElement('div'); ar.className='arrow'; sq.appendChild(ar); setTimeout(()=>ar.remove(),900);} } }

    // if a board piece is selected, show all legal targets as previews
    if(state.selected && state.selected.from){
      renderPreview( legalMoveTargetsOn(state, state.selected.from.r, state.selected.from.c) );
    }

    state.justStartedTurn=false;
  }

  function renderBank(side){
    const el=side===WHITE?bankWhiteEl:bankBlackEl;
    el.innerHTML='';
    const b=state.bank[side];
    const isTurn=state.turn===side;
    const panel=el.closest('.player-panel');
    if(panel) panel.classList.toggle('active-turn',isTurn && !state.winner && !state.draw);
    const names={K:'King',Q:'Queen',R:'Rook',B:'Bishop',N:'Knight',P:'Pawn'};
    for(const t of ['P','N','B','R','Q','K']){
      const cnt=b[t]??0;
      const cell=document.createElement('div');
      cell.className='piece';
      cell.dataset.type=t;
      cell.setAttribute('role','button');
      cell.setAttribute('tabindex',cnt>0&&isTurn?'0':'-1');
      cell.setAttribute('aria-label',`${names[t]}, ${cnt} remaining`);
      if(cnt<=0) cell.classList.add('disabled');
      if(isTurn && state.selected?.type===t && !state.selected?.from) cell.classList.add('selected');
      cell.innerHTML=`${renderPieceGlyph(t,side)}<span class="piece-name">${names[t]}</span><span class="count"><span class="count-gem" aria-hidden="true"></span>${Math.max(cnt,0)}</span>`;
      const choose=()=>{
        if(!isTurn||cnt<=0||state.winner||state.draw) return;
        state.selected=(state.selected && state.selected.type===t && !state.selected.from)?null:{type:t,color:side};
        woodClick(); updateCursor(); render();
      };
      cell.addEventListener('click',choose);
      cell.addEventListener('keydown',ev=>{ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); choose(); } });
      el.appendChild(cell);
    }
    const total=totalPieces(state,side);
    (side===WHITE?whiteMaterialCount:blackMaterialCount).textContent=String(total);
  }

  function modeLabel(mode){ return mode==='sudden'?'Sudden Death':mode==='queens'?"Queens Gambit":'Total War'; }
  function movementLabel(mode){ return mode==='none'?'No movement':mode==='lineOfSight'?'Line of sight':'Anywhere'; }

  function updateStatus(){
    modeStatusEl.textContent=modeLabel(state.gameMode);
    movementStatusEl.textContent=movementLabel(state.movementMode);
    turnCounterEl.textContent=`Turn ${state.fullMoveNumber}`;
    turnDotEl.dataset.side=state.turn;

    if(state.draw){
      winnerEl.style.display='block';
      winnerEl.textContent='Draw.';
      statusEl.textContent='Game over';
      statusDetailEl.textContent='The match ended in a draw.';
      return;
    }
    if(state.winner){
      winnerEl.style.display='block';
      winnerEl.textContent=`${state.winner===WHITE?'White':'Black'} wins.`;
      statusEl.textContent='Game over';
      statusDetailEl.textContent=`${state.winner===WHITE?'White':'Black'} won the match.`;
      return;
    }

    winnerEl.style.display='none';
    const side=state.turn===WHITE?'White':'Black';
    statusEl.textContent=`${side} to move`;
    const threats=threatenedPiecesOfOn(state,state.turn).length;
    if(state.ai.enabled && state.turn===BLACK && state.ai.thinking){
      statusDetailEl.textContent='AI is considering its move…';
    } else if(state.selected?.from){
      statusDetailEl.textContent=`Choose a destination for ${state.selected.type}.`;
    } else if(state.selected?.type){
      statusDetailEl.textContent=`Choose a square for ${state.selected.type}.`;
    } else if(state.gameMode==='sudden' && threats){
      statusDetailEl.textContent=`Resolve ${threats} threatened piece${threats===1?'':'s'} before ending the turn.`;
    } else {
      statusDetailEl.textContent='Select a bank piece to deploy, or a board piece to move.';
    }
  }

  function renderMoveHistory(){
    moveHistoryBody.innerHTML='';
    const grouped=new Map();
    state.moveHistory.forEach(entry=>{
      if(!grouped.has(entry.fullMove)) grouped.set(entry.fullMove,{white:null,black:null});
      grouped.get(entry.fullMove)[entry.color===WHITE?'white':'black']=entry;
    });
    if(!grouped.size){
      const tr=document.createElement('tr');
      tr.innerHTML='<td class="move-number">1</td><td class="move-cell" colspan="2">No moves yet</td>';
      moveHistoryBody.appendChild(tr);
    } else {
      for(const [num,row] of grouped){
        const tr=document.createElement('tr');
        const last=state.moveHistory[state.moveHistory.length-1];
        const whiteCurrent=last && row.white===last;
        const blackCurrent=last && row.black===last;
        tr.innerHTML=`<td class="move-number">${num}</td><td class="move-cell${whiteCurrent?' current':''}">${row.white?row.white.notation:'—'}</td><td class="move-cell${blackCurrent?' current':''}">${row.black?row.black.notation:'—'}</td>`;
        moveHistoryBody.appendChild(tr);
      }
    }
    historyMeta.textContent=`${state.moveHistory.length} action${state.moveHistory.length===1?'':'s'}`;
    requestAnimationFrame(()=>{ moveHistoryScroll.scrollTop=moveHistoryScroll.scrollHeight; moveHistoryScroll.scrollLeft=moveHistoryScroll.scrollWidth; });
  }

  function renderLog(){
    logList.innerHTML='';
    state.log.forEach(e=>{ const li=document.createElement('li'); li.textContent=e; logList.appendChild(li); });
  }

  function applyShatterEffects(){
    if(!state.effectsShatter || !state.effectsShatter.length) return;
    const items = state.effectsShatter.splice(0);
    for(const it of items){
      const idx = it.r*SIZE + it.c; const sq = boardEl.children[idx]; if(!sq) continue;
      const rect = sq.getBoundingClientRect(); const base = boardEl.getBoundingClientRect();
      const wrap = document.createElement('div'); wrap.className='shatter';
      wrap.style.left = (rect.left - base.left) + 'px';
      wrap.style.top  = (rect.top  - base.top ) + 'px';
      wrap.style.width = rect.width + 'px'; wrap.style.height = rect.height + 'px';
      for(let i=0;i<6;i++){
        const s=document.createElement('div'); s.className='shard';
        const dx=(Math.random()*120-60)+'px';
        const dy=(Math.random()*-80-20)+'px';
        const rot=(Math.random()*1.6-0.8)+'turn';
        s.style.setProperty('--dx', dx); s.style.setProperty('--dy', dy); s.style.setProperty('--rot', rot);
        s.style.animation='shatter 520ms ease-out forwards';
        const span=document.createElement('span'); span.className='glyph shatter-piece ' + (it.color===WHITE?'gIvory':'gOnyx');
        span.innerHTML=`<span class="glyph-fallback" aria-hidden="true">${it.ch}</span><img class="piece-art" src="${pieceAssetPath(Object.keys(mapBlack).find(k=>mapBlack[k]===it.ch)||'P',it.color)}" alt="" draggable="false" aria-hidden="true">`;
        s.appendChild(span); wrap.appendChild(s);
      }
      boardEl.appendChild(wrap);
      setTimeout(()=>wrap.remove(), 560);
    }
  }

  function render(){ renderBank(WHITE); renderBank(BLACK); renderBoard(); applyShatterEffects(); renderMoveHistory(); renderLog(); updateStatus(); renderClocks(); maybeAI(); }

  // Cursor shows selected piece as SVG (guarded)
  function cursorSVGFor(type,color){ const ch=mapBlack[type]; let fill='#000'; try{ fill=getComputedStyle(document.documentElement).getPropertyValue(color===WHITE?'--ivory':'--onyx').trim()||'#000'; }catch{} return `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><text x='50%' y='58%' text-anchor='middle' font-size='56' font-family='\"Segoe UI Symbol\", system-ui' fill='${fill}'>${ch}</text></svg>`; }
  function updateCursor(){ if(!state.selected || state.selected.from){ boardEl.style.cursor='auto'; return; } try{ const svg=cursorSVGFor(state.selected.type,state.turn); const blob=new Blob([svg],{type:'image/svg+xml'}); const url=URL.createObjectURL(blob); boardEl.style.cursor=`url(${url}) 24 24, pointer`; setTimeout(()=>URL.revokeObjectURL(url),2000); }catch{} }

  // --- Interaction helpers ---
  function coordToAlg(r,c){ return 'abcdefgh'[c] + (8-r); }
  // --- Piece-count helpers ---
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

  function tryPlace(r,c){
    const {union}=legalPlacementsOn(state,state.turn); const key=r+','+c; if(!union.has(key) || !isEmpty(r,c)) { errorMuffle(); return false; }
    let t=state.selected?.type||null;
    if(!t){
      const remaining=Object.entries(state.bank[state.turn]).filter(([,cnt])=>cnt>0).map(([tt])=>tt);
      if(remaining.length===1) t=remaining[0];
      else { errorMuffle(); return false; }
    }
    const actor=state.turn;
    placePiece(r,c,t,actor); state.bank[actor][t]-=1; woodClick();
    const square=coordToAlg(r,c);
    state.lastAction={kind:'place',color:actor,piece:t,to:square,notation:`${t}@${square}`};
    lastVisualSquare=square;
    state.log.push(`${actor===WHITE?'White':'Black'}: place ${t}@${square}`);
    return true;
  }

  function tryMove(toR,toC){
    if(!state.selected || !state.selected.from) return false;
    const fromR=state.selected.from.r, fromC=state.selected.from.c;
    const targets=legalMoveTargetsOn(state,fromR,fromC); const key=toR+","+toC; if(!targets.has(key)) { errorMuffle(); return false; }
    const actor=state.turn;
    const piece=state.board[fromR][fromC];
    const from=coordToAlg(fromR,fromC), to=coordToAlg(toR,toC);
    state.board[fromR][fromC]=null; state.board[toR][toC]=piece; woodClick();
    state.lastAction={kind:'move',color:actor,piece:piece.type,from,to,notation:`${piece.type} ${from}→${to}`};
    lastVisualSquare=to;
    state.log.push(`${actor===WHITE?'White':'Black'}: move ${piece.type} ${from}→${to}`);
    return true;
  }

  function onSquareClick(r,c){
    if(state.winner||state.draw) return;
    if(state.ai.enabled && state.turn===BLACK) return; // lock clicks during AI turn

    const cell=state.board[r][c];

    // 1) Selecting a board piece for movement
    if(cell && cell.color===state.turn && state.movementMode!=='none'){
      if(state.selected && state.selected.from && state.selected.from.r===r && state.selected.from.c===c){ state.selected=null; clearPreviews(); render(); return; }
      state.selected={type:cell.type, color:cell.color, from:{r,c}}; updateCursor(); render(); return;
    }

    // 2) Empty square clicked: either place from bank or move selected board piece
    syncClock(state);
    if(state.winner||state.draw){ render(); return; }
    const prev=snapshot(state);
    const acted=cell ? false : (state.selected && state.selected.from ? tryMove(r,c) : tryPlace(r,c));
    if(!acted) return;

    // Record every completed action, including game-ending actions, so Undo remains coherent.
    state.history.push(prev);
    recordMove(state,state.lastAction);
    const ended=completeRealTurn(state);
    if(ended) bell();
    render();
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

  // --- Move record / real-time clock orchestration ---
  function recordMove(s,action){
    if(!action) return;
    s.moveHistory.push({...clone(action),fullMove:s.fullMoveNumber});
    if(action.color===BLACK) s.fullMoveNumber+=1;
    s.lastAction=null;
  }

  function clockEnabled(s=state){ return !!(s.clock && s.clock.baseSeconds>0); }
  function formatClock(seconds){
    if(!Number.isFinite(seconds)) return '∞';
    const total=Math.max(0,Math.ceil(seconds));
    const m=Math.floor(total/60), sec=total%60;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }
  function syncClock(s=state,now=performance.now()){
    if(!clockEnabled(s)||!s.clock.running||s.winner||s.draw||s.clock.lastTick==null) return false;
    const elapsed=Math.max(0,(now-s.clock.lastTick)/1000);
    s.clock.remaining[s.turn]=Math.max(0,s.clock.remaining[s.turn]-elapsed);
    s.clock.lastTick=now;
    if(s.clock.remaining[s.turn]<=0){
      const expired=s.turn;
      s.winner=expired===WHITE?BLACK:WHITE;
      s.clock.running=false;
      s.log.push(`${expired===WHITE?'White':'Black'} ran out of time.`);
      return true;
    }
    return false;
  }
  function resumeClock(s=state){
    if(!clockEnabled(s)||s.winner||s.draw){ if(s.clock) s.clock.running=false; return; }
    s.clock.running=true;
    s.clock.lastTick=performance.now();
  }
  function stopClock(s=state){ if(s.clock) s.clock.running=false; }
  function renderClocks(){
    const enabled=clockEnabled(state);
    const w=enabled?state.clock.remaining[WHITE]:Infinity;
    const b=enabled?state.clock.remaining[BLACK]:Infinity;
    clockWhite.textContent=formatClock(w);
    clockBlack.textContent=formatClock(b);
    clockWhiteCaption.textContent=enabled?'remaining':'Unlimited';
    clockBlackCaption.textContent=enabled?'remaining':'Unlimited';
    whiteClockBlock.classList.toggle('low-time',enabled&&w<=15);
    blackClockBlock.classList.toggle('low-time',enabled&&b<=15);
    const base=Math.max(1,state.clock?.baseSeconds||1);
    const applyDial=(el,remaining,side)=>{
      const fraction=enabled?Math.max(0,Math.min(1,remaining/base)):1;
      // Dial reads the clock like a stopwatch: long hand = seconds (one
      // sweep per minute), short hand = minutes. Both sit at 12 o'clock at
      // 0:00, and the dial always corroborates the digits beside it.
      const secs=enabled?Math.max(0,remaining):0;
      el.style.setProperty('--clock-second-angle',`${(secs%60)/60*360}deg`);
      el.style.setProperty('--clock-hand-angle',`${((secs/60)%60)/60*360}deg`);
      el.style.setProperty('--clock-progress-angle',`${fraction*360}deg`);
      el.style.setProperty('--clock-fraction',String(fraction));
      el.classList.toggle('clock-active',state.turn===side&&!state.winner&&!state.draw);
    };
    applyDial(whiteClockBlock,w,WHITE); applyDial(blackClockBlock,b,BLACK);
  }
  function completeRealTurn(s){
    const ended=finishTurn(s);
    if(ended) stopClock(s);
    else resumeClock(s);
    return ended;
  }

  // --- Controls ---
  function cancelAIThinking(){
    if(state.ai && state.ai.timerId){ clearTimeout(state.ai.timerId); state.ai.timerId=null; }
    state.ai.thinking=false;
  }

  function undoOneAction(){
    if(!state.history.length) return null;
    const previous=state.history[state.history.length-1];
    const actor=previous.turn;
    state=previous;
    lastVisualSquare=null;
    return actor;
  }

  btnUndo.addEventListener('click', () => {
    if(!state.history.length) return;
    syncClock(state);
    cancelAIThinking();

    const aiEnabled=!!state.ai.enabled;
    const lastActor=undoOneAction();

    // In AI games, Undo normally returns to the position before the player's last move.
    // This remains correct even if the AI's move ended the game and the turn never switched.
    if(aiEnabled && lastActor===BLACK && state.history.length){
      const precedingActor=state.history[state.history.length-1].turn;
      if(precedingActor===WHITE) undoOneAction();
    }
    resumeClock(state);
    render();
  });

  btnRestart.addEventListener('click', () => {
    cancelAIThinking();
    const cfg = state.config || lastConfig || {
      heatmap: true, time:0,
      mode: state.gameMode || 'sudden',
      movement: state.movementMode || 'none',
      preset: state.preset || 'basic',
      ai: clone(state.ai)
    };
    startGame(cfg);
  });
  if(btnExit) btnExit.addEventListener('click',()=>{
    syncClock(state);
    stopClock(state);
    cancelAIThinking();
    const cfg=state.config||lastConfig||{heatmap:true,time:0,mode:state.gameMode||'sudden',movement:state.movementMode||'none',preset:state.preset||'basic',ai:clone(state.ai)};
    heatmapSetup.checked=!!cfg.heatmap;
    timeControlSetup.value=String(cfg.time||0);
    gameModeSetup.value=cfg.mode;
    movementSetup.value=cfg.movement;
    armySetup.value=cfg.preset;
    aiEnable.checked=!!cfg.ai?.enabled;
    aiDepth.value=String(cfg.ai?.depth||3);
    aiStyle.value=cfg.ai?.style||'balanced';
    settingsHeatmap.checked=!!cfg.heatmap;
    gameWrap.classList.add('hidden');
    setupView.classList.remove('hidden');
    updateSetupSummary();
  });

  // --- Setup & Start Game ---
  function readSetupConfig(){
    return {
      heatmap: !!heatmapSetup.checked,
      time: +timeControlSetup.value||0,
      mode: gameModeSetup.value,
      movement: movementSetup.value,
      preset: armySetup.value,
      ai: { enabled: !!aiEnable.checked, depth: +aiDepth.value||3, style: aiStyle.value||'balanced' }
    };
  }

  function startGame(cfg){
    lastConfig=clone(cfg);
    lastVisualSquare=null;
    state=makeFreshState(cfg.preset);
    state.gameMode=cfg.mode;
    state.movementMode=cfg.movement;
    state.heatmap=cfg.heatmap;
    state.config=clone(cfg);
    state.ai=clone(cfg.ai||{enabled:false,depth:3,style:'balanced'});
    state.ai.thinking=false; state.ai.timerId=null;
    state.clock={
      baseSeconds:+cfg.time||0,
      remaining:{[WHITE]:+cfg.time||0,[BLACK]:+cfg.time||0},
      lastTick:null,
      running:false
    };

    setupView.classList.add('hidden');
    gameWrap.classList.remove('hidden');
    settingsHeatmap.checked=state.heatmap;
    state.log=[`Started · ${modeLabel(cfg.mode)} · ${movementLabel(cfg.movement)} · ${cfg.preset} army${state.ai.enabled?` · AI depth ${state.ai.depth} (${state.ai.style})`:''}${cfg.time?` · ${cfg.time}s clock`:' · unlimited'}`];
    resumeClock(state);
    render();
  }

  btnStart.addEventListener('click', ()=>{ armAudioOnce(); startGame(readSetupConfig()); });
  if(historyPrev) historyPrev.addEventListener('click',()=>moveHistoryScroll.scrollBy({left:-Math.max(180,moveHistoryScroll.clientWidth*.65),behavior:'smooth'}));
  if(historyNext) historyNext.addEventListener('click',()=>moveHistoryScroll.scrollBy({left:Math.max(180,moveHistoryScroll.clientWidth*.65),behavior:'smooth'}));

  [gameModeSetup,movementSetup,armySetup,timeControlSetup].forEach(el=>el.addEventListener('change',updateSetupSummary));
  function updateAISetup(){ const enabled=aiEnable.checked; aiDepth.disabled=!enabled; aiStyle.disabled=!enabled; }
  aiEnable.addEventListener('change',updateAISetup);
  heatmapSetup.addEventListener('change',()=>{ settingsHeatmap.checked=heatmapSetup.checked; });
  settingsHeatmap.addEventListener('change',()=>{
    heatmapSetup.checked=settingsHeatmap.checked;
    if(!gameWrap.classList.contains('hidden')){ state.heatmap=settingsHeatmap.checked; if(state.config) state.config.heatmap=state.heatmap; renderBoard(); }
  });

  function updateSetupSummary(){
    const time=+timeControlSetup.value||0;
    const timeLabel=time===0?'Unlimited':time===60?'60 seconds':`${Math.round(time/60)} minutes`;
    setupSummary.textContent=`${modeLabel(gameModeSetup.value)} · ${movementLabel(movementSetup.value)} · ${armySetup.options[armySetup.selectedIndex].text} · ${timeLabel}`;
  }

  function init(){
    applyTheme(readStoredTheme()||'fantasy',false);
    gameWrap.classList.add('hidden');
    setupView.classList.remove('hidden');
    settingsHeatmap.checked=heatmapSetup.checked;
    updateAISetup();
    updateSetupSummary();
    if(location.hash==='#play') startGame(readSetupConfig());
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // --- AI engine (minimax with alpha-beta) ---
  function pieceValue(t){ return t==='K'? 4.5 : t==='Q'? 9 : t==='R'? 5 : t==='B'? 3.25 : t==='N'? 3 : 1; }

  function evalPosition(s, pov /*color*/){
    const me=pov, opp=pov===WHITE?BLACK:WHITE;
    let score=0;
    // Material (board + bank)
    function sideMat(color){
      let v=0; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ const p=s.board[r][c]; if(p && p.color===color) v+=pieceValue(p.type); }
      const b=s.bank[color]; if(b) for(const k in b){ v += (b[k]||0)*pieceValue(k); }
      return v;
    }
    const mat = sideMat(me) - sideMat(opp);

    // Control map differential
    const f=squaresAttackedByOn(s,me), e=squaresAttackedByOn(s,opp);
    let ctrl=0; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ const k=r+","+c; ctrl += (f.get(k)||0) - (e.get(k)||0); }

    // Threat pressure
    const myOppThreats = threatenedPiecesOfOn(s, opp).length;
    const myThreatsAgainst = threatenedPiecesOfOn(s, me).length;

    // Mobility: legal placements available
    const lpMe = legalPlacementsOn(s, me).union.size;
    const lpOp = legalPlacementsOn(s, opp).union.size;

    // Mode-specific weights
    let wSud=0, wQ=0, wTot=0;
    if(s.gameMode==='sudden') wSud = (myOppThreats - myThreatsAgainst)*4 + (lpMe - lpOp)*2;
    if(s.gameMode==='queens') wQ   = (queensRemaining(s,me) - queensRemaining(s,opp))*5;
    if(s.gameMode==='total')  wTot = (totalPieces(s,me) - totalPieces(s,opp))*1.5;

    // Style tweaks
    const style = s.ai?.style || 'balanced';
    const styleAgg = style==='aggressive'? 1.25 : style==='defensive'? 0.85 : 1.0;

    score = 6*mat + 1.4*ctrl + styleAgg*(3.5*(myOppThreats - myThreatsAgainst)) + 0.9*(lpMe - lpOp) + wSud + wQ + wTot;

    return score;
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


  const WIN_SCORE=1e9;
  const SEARCH_TIMEOUT={};

  // The placement game has a much larger branching factor than ordinary chess.
  // Search therefore uses iterative deepening, alpha-beta, a time budget, and
  // lightweight action ordering. The selected depth remains the maximum depth;
  // the AI always returns the best result from the deepest fully completed pass.
  function quickActionScore(s,a,ours,enemySquares){
    const color=s.turn;
    const to=a.kind==='place'?[a.r,a.c]:a.to;
    const [r,c]=to;
    const center=7-(Math.abs(3.5-r)+Math.abs(3.5-c));
    const t=a.t || (a.kind==='move' && s.board[a.from[0]][a.from[1]]?.type) || 'P';
    let score=center*.55 + pieceValue(t)*.18;
    const attacks=hypotheticalAttacks(r,c,t,color,s);
    score += Math.min(20,attacks.size)*.055;

    // Prefer actions that support currently threatened pieces or pressure enemy pieces.
    for(const [rr,cc] of ours) if(attacks.has(rr+','+cc)) score+=4.5;
    if(a.kind==='move' && ours.some(([rr,cc])=>rr===a.from[0]&&cc===a.from[1])) score+=3.5;
    for(const key of enemySquares) if(attacks.has(key)) score+=.65;
    return score;
  }

  function orderActionsQuick(s,acts){
    const color=s.turn, enemy=color===WHITE?BLACK:WHITE;
    const ours=threatenedPiecesOfOn(s,color);
    const enemySquares=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const p=s.board[r][c]; if(p&&p.color===enemy) enemySquares.push(r+','+c);
    }
    return acts.map(a=>({a,q:quickActionScore(s,a,ours,enemySquares)})).sort((x,y)=>y.q-x.q).map(x=>x.a);
  }

  function searchActionCap(ctx,depth,isRoot){
    if(isRoot){
      if(ctx.rootDepth<=1) return Infinity;
      if(ctx.rootDepth===2) return 120;
      if(ctx.rootDepth===3) return 64;
      return 48;
    }
    if(depth>=3) return 24;
    if(depth===2) return 20;
    return 16;
  }

  function guardSearch(ctx){ if(performance.now()>=ctx.deadline) throw SEARCH_TIMEOUT; }

  function stateSearchKey(s,depth,pov){
    const board=s.board.map(row=>row.map(p=>p?p.color+p.type:'..').join('')).join('/');
    const banks=[WHITE,BLACK].map(c=>['K','Q','R','B','N','P'].map(t=>s.bank[c][t]||0).join(',')).join('|');
    return `${depth}:${pov}:${s.turn}:${s.gameMode}:${s.movementMode}:${board}:${banks}`;
  }

  function minimax(s, depth, alpha, beta, pov, ctx=null){
    if(s.winner) return {score:s.winner===pov ? WIN_SCORE+depth : -WIN_SCORE-depth};
    if(s.draw) return {score:0};
    if(depth===0) return {score:evalPosition(s,pov)};

    const localCtx=ctx||{deadline:performance.now()+5000,rootDepth:depth,cache:new Map()};
    guardSearch(localCtx);
    const key=stateSearchKey(s,depth,pov);
    if(localCtx.cache.has(key)) return {score:localCtx.cache.get(key)};

    const meTurn=(s.turn===pov);
    let acts=generateActions(s);
    if(!acts.length) return {score:s.turn===pov ? -WIN_SCORE-depth : WIN_SCORE+depth};
    const isRoot=depth===localCtx.rootDepth;
    const cap=searchActionCap(localCtx,depth,isRoot);
    let rows=[];

    if(isRoot){
      // At the root, inspect every action once. This catches immediate wins before
      // beam limiting and gives stronger ordering for the moves the player sees.
      for(const a of acts){
        guardSearch(localCtx);
        const ns=applyAction(s,a); if(!ns) continue;
        let staticScore;
        if(ns.winner) staticScore=ns.winner===pov ? WIN_SCORE+depth : -WIN_SCORE-depth;
        else if(ns.draw) staticScore=0;
        else staticScore=evalPosition(ns,pov);
        rows.push({a,ns,staticScore});
        if(ns.winner===s.turn){
          const score=s.turn===pov ? WIN_SCORE+depth : -WIN_SCORE-depth;
          return {score,act:a};
        }
      }
      rows.sort((x,y)=>meTurn?y.staticScore-x.staticScore:x.staticScore-y.staticScore);
      if(Number.isFinite(cap)&&rows.length>cap) rows=rows.slice(0,cap);
    } else {
      acts=orderActionsQuick(s,acts);
      if(Number.isFinite(cap)&&acts.length>cap) acts=acts.slice(0,cap);
      rows=acts.map(a=>({a,ns:null,staticScore:0}));
    }

    let bestAct=null;
    if(meTurn){
      let best=-Infinity;
      for(const row of rows){
        guardSearch(localCtx);
        const ns=row.ns||applyAction(s,row.a); if(!ns) continue;
        const child=minimax(ns,depth-1,alpha,beta,pov,localCtx);
        const val=child.score;
        if(val>best){best=val;bestAct=row.a;}
        alpha=Math.max(alpha,best);
        if(beta<=alpha) break;
      }
      if(!bestAct) best=evalPosition(s,pov);
      localCtx.cache.set(key,best);
      return {score:best,act:bestAct};
    }

    let best=Infinity;
    for(const row of rows){
      guardSearch(localCtx);
      const ns=row.ns||applyAction(s,row.a); if(!ns) continue;
      const child=minimax(ns,depth-1,alpha,beta,pov,localCtx);
      const val=child.score;
      if(val<best){best=val;bestAct=row.a;}
      beta=Math.min(beta,best);
      if(beta<=alpha) break;
    }
    if(!bestAct) best=evalPosition(s,pov);
    localCtx.cache.set(key,best);
    return {score:best,act:bestAct};
  }

  function chooseAIMove(s,maxDepth,pov=BLACK){
    const budgets={1:260,2:520,3:950,4:1650};
    const deadline=performance.now()+(budgets[maxDepth]||950);
    let best=null;
    for(let depth=1;depth<=maxDepth;depth++){
      const ctx={deadline,rootDepth:depth,cache:new Map()};
      try{
        const result=minimax(s,depth,-Infinity,Infinity,pov,ctx);
        if(result.act) best={...result,completedDepth:depth};
      }catch(err){
        if(err!==SEARCH_TIMEOUT) throw err;
        break;
      }
      if(performance.now()>=deadline-8) break;
    }
    return best;
  }

  function maybeAI(){
    if(!state.ai.enabled) return;
    if(state.winner||state.draw) return;
    if(state.turn!==BLACK) return;
    if(state.ai.thinking) return;
    state.ai.thinking=true; updateStatus();
    // slight delay to show status and avoid blocking UI
    state.ai.timerId = setTimeout(()=>{
      try{
        const depth = Math.max(1, Math.min(4, state.ai.depth|0));
        const res = chooseAIMove(state, depth, BLACK);
        const act = res?.act;
        if(!act){ state.ai.thinking=false; state.ai.timerId=null; return; }
        // Execute on the real state through the same turn pipeline used by humans.
        syncClock(state);
        if(state.winner||state.draw) return;
        const prev=snapshot(state);
        if(act.kind==='place'){
          state.selected = {type: act.t, color: state.turn};
          tryPlace(act.r, act.c);
        } else {
          state.selected = {type: state.board[act.from[0]][act.from[1]].type, color: state.turn, from: {r: act.from[0], c: act.from[1]}};
          tryMove(act.to[0], act.to[1]);
        }
        state.history.push(prev);
        recordMove(state,state.lastAction);
        const ended=completeRealTurn(state);
        if(ended) bell();
      } finally {
        state.selected=null; state.ai.thinking=false; state.ai.timerId=null; updateCursor(); render();
      }
    }, 120);
  }

  // Keep visible clocks live without rerendering the board on every tick.
  setInterval(()=>{
    if(gameWrap.classList.contains('hidden')||!clockEnabled(state)||!state.clock.running) return;
    const timedOut=syncClock(state);
    renderClocks();
    if(timedOut){ cancelAIThinking(); bell(); render(); }
  },200);
