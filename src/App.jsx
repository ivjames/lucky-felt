import { useState } from "react";
import { loadUser, saveUser } from "./storage";

const STARTING_BALANCE = 1000;
const ATM_AMOUNT = 500;
const ATM_COOLDOWN_MS = 5 * 60 * 1000;

const SUITS = ["♠","♥","♦","♣"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RANK_VAL = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};

function makeDeck(){const d=[];for(const s of SUITS)for(const r of RANKS)d.push({r,s});return d;}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function cardColor(s){return (s==="♥"||s==="♦")?"#ff6b6b":"#f0e6c8";}

function CardEl({card,hidden=false,small=false}){
  const w=small?38:52,h=small?54:74;
  if(hidden)return (<div role="img" aria-label="Hidden card" style={{width:w,height:h,borderRadius:7,border:"2px solid #e8c84a",background:"linear-gradient(135deg,#2a5a38,#142e1c)",display:"inline-flex",alignItems:"center",justifyContent:"center",margin:"0 3px",boxShadow:"0 3px 8px rgba(0,0,0,0.5)"}}><span style={{color:"#e8c84a",fontSize:small?18:24}}>🂠</span></div>);
  return (<div role="img" aria-label={`${card.r} of ${card.s}`} style={{width:w,height:h,borderRadius:7,border:"2px solid #e8c84a",background:"#22203a",display:"inline-flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"flex-start",padding:"3px 4px",margin:"0 3px",boxShadow:"0 3px 8px rgba(0,0,0,0.5)"}}><span style={{color:cardColor(card.s),fontWeight:700,fontSize:small?11:14,lineHeight:1}}>{card.r}</span><span style={{color:cardColor(card.s),fontSize:small?13:18,lineHeight:1,margin:"auto"}}>{card.s}</span><span style={{color:cardColor(card.s),fontWeight:700,fontSize:small?11:14,lineHeight:1,alignSelf:"flex-end",transform:"rotate(180deg)"}}>{card.r}</span></div>);
}

function getRank(card){return RANK_VAL[card.r];}
function evaluateHand(cards){
  const sorted=[...cards].sort((a,b)=>getRank(b)-getRank(a));
  const ranks=sorted.map(c=>getRank(c));
  const suits=sorted.map(c=>c.s);
  const rankCounts={};
  ranks.forEach(r=>{rankCounts[r]=(rankCounts[r]||0)+1;});
  const groups=Object.entries(rankCounts).map(([r,c])=>({r:+r,c})).sort((a,b)=>b.c-a.c||b.r-a.r);
  const counts=groups.map(g=>g.c);
  const uniqueRanks=[...new Set(ranks)].sort((a,b)=>b-a);
  const isFlush=suits.every(s=>s===suits[0]);
  const isStraight=uniqueRanks.length===5&&uniqueRanks[0]-uniqueRanks[4]===4;
  const isWheelStraight=uniqueRanks.join(",")==="14,5,4,3,2";
  if((isStraight||isWheelStraight)&&isFlush){const high=isWheelStraight?5:uniqueRanks[0];return {rank:8,name:high===14?"Royal Flush":"Straight Flush",tb:[high]};}
  if(counts[0]===4)return {rank:7,name:"Four of a Kind",tb:[groups[0].r,groups[1].r]};
  if(counts[0]===3&&counts[1]===2)return {rank:6,name:"Full House",tb:[groups[0].r,groups[1].r]};
  if(isFlush)return {rank:5,name:"Flush",tb:ranks};
  if(isStraight||isWheelStraight)return {rank:4,name:"Straight",tb:[isWheelStraight?5:uniqueRanks[0]]};
  if(counts[0]===3){const kickers=groups.filter(g=>g.c===1).map(g=>g.r).sort((a,b)=>b-a);return {rank:3,name:"Three of a Kind",tb:[groups[0].r,...kickers]};}
  if(counts[0]===2&&counts[1]===2){const kicker=groups.find(g=>g.c===1)?.r||0;return {rank:2,name:"Two Pair",tb:[groups[0].r,groups[1].r,kicker]};}
  if(counts[0]===2){const kickers=groups.filter(g=>g.c===1).map(g=>g.r).sort((a,b)=>b-a);return {rank:1,name:"Pair",tb:[groups[0].r,...kickers]};}
  return {rank:0,name:"High Card ("+sorted[0].r+")",tb:ranks};
}
function bestOf7(cards){let best=null;for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const five=cards.filter((_,idx)=>idx!==i&&idx!==j);const ev=evaluateHand(five);if(!best||ev.rank>best.rank||(ev.rank===best.rank&&compareTB(ev.tb,best.tb)>0))best=ev;}return best;}
function compareTB(a,b){for(let i=0;i<Math.min(a.length,b.length);i++){if(a[i]!==b[i])return a[i]-b[i];}return 0;}

const C={bg:"#0c1a10",bgMid:"#132b1a",panel:"#1a3d25",panelAlt:"#142e1c",border:"#2a5c3a",gold:"#e8c84a",goldDim:"#e8c84a44",text:"#f0e6c8",muted:"#7ec493",mutedDim:"#3a6a4a",win:"#4ade80",winBg:"#0d3320",winBorder:"#22c55e",lose:"#f87171",loseBg:"#3a0f0f",loseBorder:"#ef4444",push:"#93c5fd",pushBg:"#0f1f3a",pushBorder:"#3b82f6"};

const S={
  app:{minHeight:"100vh",background:`linear-gradient(160deg,${C.bg} 0%,${C.bgMid} 50%,${C.bg} 100%)`,fontFamily:"'Courier New',monospace",color:C.text,padding:"0 0 60px 0"},
  header:{textAlign:"center",padding:"24px 16px 12px",borderBottom:`1px solid ${C.border}`},
  neonTitle:{fontSize:"clamp(28px,6vw,52px)",fontWeight:700,letterSpacing:"0.15em",color:C.gold,textShadow:`0 0 12px ${C.gold}99, 0 0 36px ${C.gold}44`,fontFamily:"Georgia,serif",margin:0},
  subtitle:{color:C.muted,fontSize:13,letterSpacing:"0.2em",marginTop:4},
  balance:{background:C.panelAlt,border:`1px solid ${C.goldDim}`,borderRadius:8,padding:"8px 20px",display:"inline-flex",alignItems:"center",gap:12,margin:"12px 0"},
  btn:(v="gold")=>({background:v==="gold"?`linear-gradient(135deg,${C.gold},#b89828)`:v==="green"?"linear-gradient(135deg,#2e6e45,#1a3d25)":v==="red"?"linear-gradient(135deg,#9e2828,#5a1414)":"transparent",color:v==="gold"?C.bg:C.text,border:v==="ghost"?`1px solid ${C.goldDim}`:"none",borderRadius:7,padding:"10px 20px",cursor:"pointer",fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:13,letterSpacing:"0.05em",transition:"opacity 0.15s, box-shadow 0.15s",minHeight:44,minWidth:44}),
  input:{background:C.panelAlt,border:`1px solid ${C.goldDim}`,borderRadius:7,color:C.text,padding:"10px 14px",fontFamily:"'Courier New',monospace",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"},
  panel:{background:`linear-gradient(135deg,${C.panel},${C.panelAlt})`,border:`1px solid ${C.border}55`,borderRadius:14,padding:"20px",maxWidth:680,margin:"16px auto"},
  sectionTitle:{color:C.gold,fontSize:11,letterSpacing:"0.25em",textTransform:"uppercase",marginBottom:8,borderBottom:`1px solid ${C.goldDim}`,paddingBottom:4},
  chip:(color,active)=>({width:44,height:44,borderRadius:"50%",background:color,border:active?`3px solid ${C.gold}`:"3px solid rgba(240,230,200,0.25)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,cursor:"pointer",margin:2,color:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,0.4)",minWidth:44,minHeight:44})
};

const GLOBAL_CSS=`
  * { box-sizing: border-box; }
  body { margin: 0; background: ${C.bg}; }
  button:hover:not(:disabled) { opacity: 0.88; box-shadow: 0 0 0 2px ${C.gold}44; }
  button:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 3px; border-radius: 7px; }
  button:disabled { opacity: 0.38 !important; cursor: not-allowed !important; }
  input:focus { border-color: ${C.gold} !important; box-shadow: 0 0 0 2px ${C.gold}33; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  @keyframes reel-blur { 0%,100%{filter:blur(0)} 50%{filter:blur(1px)} }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`;

function BetInput({balance,bet,setBet,disabled}){
  const chips=[1,5,10,25,50,100];
  const chipColors=["#3d8b7a","#3a6ab5","#9e3a3a","#6b4ab5","#b58a20","#2e6e45"];
  return (<div style={{margin:"12px 0"}} role="group" aria-label="Bet amount controls">
    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
      {chips.map((v,i)=>(<button key={v} disabled={disabled||v>balance} aria-label={`Add $${v} to bet`} onClick={()=>setBet(b=>Math.min(b+v,balance))} style={S.chip(chipColors[i])}>{v}</button>))}
      <button disabled={disabled} onClick={()=>setBet(0)} aria-label="Clear bet" style={{...S.btn("ghost"),padding:"6px 12px",fontSize:11,minHeight:44}}>CLR</button>
      <button disabled={disabled} onClick={()=>setBet(b=>Math.min(b*2,balance))} aria-label="Double bet" style={{...S.btn("ghost"),padding:"6px 12px",fontSize:11,minHeight:44}}>2×</button>
    </div>
    <div style={{color:C.gold,fontSize:16,fontWeight:700}} aria-live="polite">Bet: <span style={{color:C.text,fontSize:18}}>${bet}</span></div>
  </div>);
}

function ResultBanner({result}){
  if(!result)return null;
  const win=result.won===true||(!result.won&&result.delta>0);
  const push=result.delta===0&&!result.won;
  const icon=win?"✓":push?"—":"✗";
  const bg=win?C.winBg:push?C.pushBg:C.loseBg;
  const bdr=win?C.winBorder:push?C.pushBorder:C.loseBorder;
  const color=win?C.win:push?C.push:C.lose;
  const netStr=result.delta>0?` +$${result.delta}`:result.delta<0?` -$${Math.abs(result.delta)}`:"";
  return (<div role="status" aria-live="polite" style={{textAlign:"center",padding:"14px",borderRadius:10,marginTop:14,background:bg,border:`2px solid ${bdr}`,color}}>
    <div style={{fontSize:20,fontWeight:700}}>{icon} {result.label}{netStr}</div>
    {result.detail&&<div style={{fontSize:12,marginTop:5,color:C.muted}}>{result.detail}</div>}
  </div>);
}

function BrokeNotice({onAtm}){
  return (<div style={{textAlign:"center",padding:"14px",borderRadius:10,margin:"12px 0",background:"#2a1a00",border:"2px solid #c87020",color:"#ffaa44"}}>
    <div style={{fontSize:16,fontWeight:700}}>⚠ Running on empty</div>
    <div style={{fontSize:12,marginTop:4,color:C.muted}}>Your balance is too low to bet. Hit the ATM for a top-up.</div>
    <button style={{...S.btn("gold"),marginTop:10}} onClick={onAtm}>🏧 Get $500 from ATM</button>
  </div>);
}

function GameHeader({title,balance,onBack,onAtm}){
  const canAtm=onAtm&&balance<5;
  return (<div style={{...S.header,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
    <button style={S.btn("ghost")} onClick={onBack} aria-label="Return to lobby">← Lobby</button>
    <div style={{color:C.gold,fontWeight:700,letterSpacing:"0.1em",fontSize:15}}>{title}</div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {canAtm&&<button style={{...S.btn("ghost"),fontSize:11,padding:"6px 10px"}} onClick={onAtm}>🏧 ATM</button>}
      <div style={{color:C.gold,fontWeight:700}} aria-label={`Balance: $${typeof balance==="number"?balance.toFixed(2):balance}`}>$<span style={{fontSize:18}}>{typeof balance==="number"?balance.toFixed(2):balance}</span></div>
    </div>
  </div>);
}

function AuthScreen({onLogin}){
  const [email,setEmail]=useState("");
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");
  async function handleEnter(){
    const e=email.trim().toLowerCase();
    if(!e.includes("@")){setMsg("Enter a valid email address.");return;}
    setLoading(true);
    let user=await loadUser(e);
    if(!user){user={email:e,balance:STARTING_BALANCE,lastAtm:0,created:Date.now()};await saveUser(e,user);setMsg(`Welcome! Your account starts with $${STARTING_BALANCE}.`);}
    setTimeout(()=>onLogin(user),400);
    setLoading(false);
  }
  return (<div style={{...S.app,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
    <div style={{...S.panel,maxWidth:420,textAlign:"center"}}>
      <div style={S.neonTitle} role="heading" aria-level="1">🎰 LUCKY FELT</div>
      <div style={S.subtitle}>CASINO & GAMING CLUB</div>
      <div style={{margin:"28px 0 8px",color:C.muted,fontSize:12,letterSpacing:"0.15em"}}>ENTER YOUR EMAIL TO PLAY</div>
      <label htmlFor="email-input" style={{position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0,0,0,0)"}}>Email address</label>
      <input id="email-input" style={S.input} type="email" placeholder="you@example.com" autoComplete="email" autoFocus value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEnter()}/>
      <button style={{...S.btn("gold"),marginTop:12,width:"100%",padding:"12px",fontSize:15}} onClick={handleEnter} disabled={loading}>{loading?"Checking…":"Enter the Casino"}</button>
      {msg&&<div role="status" style={{marginTop:10,color:C.gold,fontSize:12}}>{msg}</div>}
      <div style={{marginTop:16,color:C.mutedDim,fontSize:11}}>No password needed — just your email.</div>
    </div>
  </div>);
}

const GAMES=[
  {id:"poker",name:"Texas Hold'em",icon:"🃏",desc:"5-card community poker vs the dealer"},
  {id:"roulette",name:"Roulette",icon:"🎡",desc:"European single-zero wheel"},
  {id:"craps",name:"Craps",icon:"🎲",desc:"Pass/don't pass dice classic"},
  {id:"sicbo",name:"Sic Bo",icon:"🎲",desc:"Three-dice bet variety"},
  {id:"slots1",name:"Classic Slots",icon:"🎰",desc:"3-reel BAR & 7 machine"},
  {id:"slots2",name:"Fruit Slots",icon:"🍒",desc:"Cherries, lemons, watermelons"},
  {id:"slots3",name:"Lucky Stars",icon:"⭐",desc:"5-reel bonus stars machine"},
];

function Lobby({user,onGame,onAtm,onLogout}){
  const canAtm=Date.now()-user.lastAtm>ATM_COOLDOWN_MS;
  const cooldownMin=Math.max(0,Math.ceil((ATM_COOLDOWN_MS-(Date.now()-user.lastAtm))/60000));
  const broke=user.balance<1;
  return (<div style={S.app}>
    <div style={S.header}>
      <div style={S.neonTitle} role="heading" aria-level="1">🎰 LUCKY FELT</div>
      <div style={S.subtitle}>CASINO & GAMING CLUB</div>
      <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:10}}>
        <div style={S.balance} aria-label={`Your balance is $${user.balance.toFixed(2)}`}><span style={{color:C.muted,fontSize:11,letterSpacing:"0.15em"}}>BALANCE</span><span style={{color:C.gold,fontSize:22,fontWeight:700}}>${user.balance.toFixed(2)}</span></div>
        <button style={{...S.btn("ghost"),opacity:canAtm?1:0.55}} onClick={()=>canAtm&&onAtm()} aria-label={canAtm?`Free ATM — add $${ATM_AMOUNT}`:`ATM available in ${cooldownMin} minutes`}>{canAtm?`🏧 Free top-up +$${ATM_AMOUNT}`:`🏧 ATM — ${cooldownMin}m cooldown`}</button>
        <button style={{...S.btn("ghost"),fontSize:11}} onClick={onLogout}>Sign out</button>
      </div>
      <div style={{color:C.mutedDim,fontSize:11,marginTop:6}}>{user.email}</div>
      {broke&&<div style={{color:"#ffaa44",fontSize:12,marginTop:8}}>⚠ You're out of chips — {canAtm?"grab a free top-up above!":"the ATM will be free soon."}</div>}
    </div>
    <div style={{maxWidth:680,margin:"24px auto",padding:"0 16px"}}>
      <div style={S.sectionTitle}>Choose a game</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12}} role="list">
        {GAMES.map(g=>(<div key={g.id} role="listitem">
          <button onClick={()=>onGame(g.id)} style={{width:"100%",textAlign:"left",background:`linear-gradient(135deg,${C.panel},${C.panelAlt})`,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px",cursor:"pointer",fontFamily:"'Courier New',monospace",color:C.text,transition:"border-color 0.15s, box-shadow 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.boxShadow=`0 0 12px ${C.gold}22`;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow="none";}}>
            <div style={{fontSize:30}} aria-hidden="true">{g.icon}</div>
            <div style={{color:C.gold,fontWeight:700,marginTop:8,fontSize:15}}>{g.name}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:4}}>{g.desc}</div>
          </button>
        </div>))}
      </div>
    </div>
  </div>);
}

function PokerGame({user,onUpdate,onBack,onAtm}){
  const [phase,setPhase]=useState("bet");
  const [deck,setDeck]=useState([]);
  const [player,setPlayer]=useState([]);
  const [dealer,setDealer]=useState([]);
  const [community,setCommunity]=useState([]);
  const [bet,setBet]=useState(10);
  const [pot,setPot]=useState(0);
  const [result,setResult]=useState(null);
  const [balance,setBalance]=useState(user.balance);
  const broke=balance<1;
  function deal(){if(bet<=0||bet>balance)return;const d=shuffle(makeDeck());setPlayer([d[0],d[2]]);setDealer([d[1],d[3]]);setCommunity([]);setDeck(d.slice(4));setPot(bet);setBalance(b=>b-bet);setResult(null);setPhase("deal");}
  function flop(){setCommunity([deck[0],deck[1],deck[2]]);setDeck(d=>d.slice(3));setPhase("flop");}
  function turn(){setCommunity(p=>[...p,deck[0]]);setDeck(d=>d.slice(1));setPhase("turn");}
  function river(){setCommunity(p=>[...p,deck[0]]);setDeck(d=>d.slice(1));setPhase("river");}
  function showdown(){
    const pH=bestOf7([...player,...community]),dH=bestOf7([...dealer,...community]);
    let win=false,push=false;
    if(pH.rank>dH.rank||(pH.rank===dH.rank&&compareTB(pH.tb,dH.tb)>0))win=true;
    else if(pH.rank===dH.rank&&compareTB(pH.tb,dH.tb)===0)push=true;
    const newBal=balance+(win?pot*2:push?pot:0);
    setBalance(newBal);
    setResult({label:win?"You win!":push?"Push — tie hand":"Dealer wins",won:win,delta:win?pot:push?0:-pot,detail:`You: ${pH.name} · Dealer: ${dH.name}`});
    setPhase("showdown");onUpdate({...user,balance:newBal});
  }
  function fold(){setResult({label:"Folded",won:false,delta:-pot,detail:"You surrendered the pot."});setPhase("showdown");onUpdate({...user,balance});}
  function reset(){user.balance=balance;setBet(b=>Math.min(b,balance));setPhase("bet");setResult(null);}
  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title="Texas Hold'em Poker" balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={S.panel}>
      <div style={S.sectionTitle}>Dealer's hand</div>
      <div style={{minHeight:78,display:"flex",alignItems:"center",flexWrap:"wrap",gap:2}}>{dealer.map((c,i)=><CardEl key={i} card={c} hidden={phase!=="showdown"}/>)}{!dealer.length&&<span style={{color:C.mutedDim,fontSize:12}}>waiting for deal…</span>}</div>
      <div style={{...S.sectionTitle,marginTop:18}}>Community cards</div>
      <div style={{minHeight:78,display:"flex",alignItems:"center",flexWrap:"wrap",gap:2}}>{community.map((c,i)=><CardEl key={i} card={c}/>)}{!community.length&&<span style={{color:C.mutedDim,fontSize:12}}>awaiting flop…</span>}</div>
      <div style={{...S.sectionTitle,marginTop:18}}>Your hand</div>
      <div style={{minHeight:78,display:"flex",alignItems:"center",flexWrap:"wrap",gap:2}}>{player.map((c,i)=><CardEl key={i} card={c}/>)}{!player.length&&<span style={{color:C.mutedDim,fontSize:12}}>waiting for deal…</span>}</div>
      {phase==="showdown"&&<div style={{color:C.gold,fontSize:13,marginTop:8}}>Your best hand: <b>{bestOf7([...player,...community])?.name}</b></div>}
      <div style={{marginTop:14}}>
        {phase==="bet"&&(broke?<BrokeNotice onAtm={onAtm}/>:<><BetInput balance={balance} bet={bet} setBet={setBet}/><button style={{...S.btn("gold"),marginTop:8}} onClick={deal} disabled={bet<=0||bet>balance}>Deal cards</button></>)}
        {phase==="deal"&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={S.btn("green")} onClick={flop}>Check / see flop</button><button style={S.btn("red")} onClick={fold}>Fold</button></div>}
        {phase==="flop"&&<button style={S.btn("green")} onClick={turn}>Check / see turn</button>}
        {phase==="turn"&&<button style={S.btn("green")} onClick={river}>Check / see river</button>}
        {phase==="river"&&<button style={S.btn("gold")} onClick={showdown}>Go to showdown</button>}
      </div>
      <div style={{marginTop:6,color:C.muted,fontSize:12}} aria-live="polite">Pot: ${pot}</div>
      <ResultBanner result={result}/>
      {phase==="showdown"&&<button style={{...S.btn("gold"),marginTop:14}} onClick={reset}>New hand</button>}
    </div>
  </div>);
}

const RED_NUMS=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const ROULETTE_BETS=[
  {id:"red",label:"🔴 Red",payout:1,check:n=>RED_NUMS.includes(n)},
  {id:"black",label:"⚫ Black",payout:1,check:n=>n>0&&!RED_NUMS.includes(n)},
  {id:"odd",label:"Odd",payout:1,check:n=>n%2!==0&&n>0},
  {id:"even",label:"Even",payout:1,check:n=>n%2===0&&n>0},
  {id:"1-18",label:"1–18",payout:1,check:n=>n>=1&&n<=18},
  {id:"19-36",label:"19–36",payout:1,check:n=>n>=19&&n<=36},
  {id:"1st12",label:"1st 12",payout:2,check:n=>n>=1&&n<=12},
  {id:"2nd12",label:"2nd 12",payout:2,check:n=>n>=13&&n<=24},
  {id:"3rd12",label:"3rd 12",payout:2,check:n=>n>=25&&n<=36},
  {id:"0",label:"Zero (35:1)",payout:35,check:n=>n===0},
];

function RouletteGame({user,onUpdate,onBack,onAtm}){
  const [balance,setBalance]=useState(user.balance);
  const [bets,setBets]=useState({});
  const [chipVal,setChipVal]=useState(5);
  const [spinning,setSpinning]=useState(false);
  const [landed,setLanded]=useState(null);
  const [result,setResult]=useState(null);
  const [history,setHistory]=useState([]);
  const totalBet=Object.values(bets).reduce((a,b)=>a+b,0);
  const broke=balance<1;
  const chipColors=["#3d8b7a","#3a6ab5","#9e3a3a","#6b4ab5","#b58a20","#2e6e45"];
  function spin(){
    if(totalBet<=0||spinning)return;
    setSpinning(true);setBalance(b=>b-totalBet);setResult(null);
    setTimeout(()=>{
      const n=Math.floor(Math.random()*37);
      setLanded(n);
      let winnings=0;const wins=[];
      for(const [id,amount] of Object.entries(bets)){const bt=ROULETTE_BETS.find(b=>b.id===id);if(bt&&bt.check(n)){winnings+=amount*(bt.payout+1);wins.push(bt.label);}}
      setBalance(b=>b+winnings);
      const newBal=balance-totalBet+winnings;
      setResult({label:winnings>0?"You win!":"Dealer wins this round",won:winnings>0,delta:winnings-totalBet,detail:`Ball landed on ${n} ${RED_NUMS.includes(n)?"🔴":n===0?"🟢":"⚫"}${wins.length?" · Hits: "+wins.join(", "):""}`});
      setHistory(h=>[{n,color:n===0?"green":RED_NUMS.includes(n)?"red":"black"},...h].slice(0,14));
      onUpdate({...user,balance:newBal});setSpinning(false);
    },1800);
  }
  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title="European Roulette" balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={S.panel}>
      <div style={{textAlign:"center",marginBottom:14}}>{spinning?<div style={{fontSize:52}} role="status" aria-label="Wheel spinning">🎡</div>:landed!==null?<div style={{fontSize:56,fontWeight:700,color:landed===0?"#4ade80":RED_NUMS.includes(landed)?"#f87171":C.text}} role="status" aria-label={`Ball landed on ${landed}`}>{landed}</div>:<div style={{fontSize:52,color:C.mutedDim}} aria-hidden="true">🎡</div>}</div>
      {history.length>0&&<div style={{display:"flex",gap:3,marginBottom:14,flexWrap:"wrap"}} aria-label="Recent results">{history.map((h,i)=>(<span key={i} style={{width:24,height:24,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:h.color==="green"?"#1a5a1a":h.color==="red"?"#5a1a1a":"#1a1a2e",border:"1px solid #444",color:C.text}}>{h.n}</span>))}</div>}
      <div style={S.sectionTitle}>Chip value</div>
      <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap"}}>{[1,5,10,25,50,100].map((v,i)=>(<button key={v} onClick={()=>setChipVal(v)} aria-pressed={chipVal===v} style={S.chip(chipColors[i],chipVal===v)}>{v}</button>))}</div>
      {broke?<BrokeNotice onAtm={onAtm}/>:<>
        <div style={S.sectionTitle}>Place bets</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:14}}>{ROULETTE_BETS.map(b=>(<button key={b.id} aria-pressed={!!bets[b.id]} onClick={()=>{if(!spinning&&balance-totalBet>=chipVal)setBets(p=>({...p,[b.id]:(p[b.id]||0)+chipVal}))}} style={{background:bets[b.id]?C.winBg:C.panelAlt,border:`1px solid ${bets[b.id]?C.winBorder:C.border}`,borderRadius:8,padding:"10px 6px",cursor:"pointer",color:bets[b.id]?C.win:C.text,fontSize:12,fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column",alignItems:"center",gap:3,minHeight:52}}><span>{b.label}</span>{bets[b.id]>0&&<span style={{fontSize:10,color:C.gold}}>${bets[b.id]}</span>}</button>))}</div>
        <div style={{color:C.gold,fontSize:13,marginBottom:10}} aria-live="polite">Total bet: ${totalBet}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={S.btn("gold")} onClick={spin} disabled={spinning||totalBet<=0}>{spinning?"Spinning…":"Spin the wheel"}</button><button style={S.btn("ghost")} onClick={()=>setBets({})} disabled={spinning}>Clear bets</button></div>
      </>}
      <ResultBanner result={result}/>
    </div>
  </div>);
}

function CrapsGame({user,onUpdate,onBack,onAtm}){
  const [balance,setBalance]=useState(user.balance);
  const [bet,setBet]=useState(10);
  const [type,setType]=useState("pass");
  const [phase,setPhase]=useState("comeout");
  const [point,setPoint]=useState(null);
  const [dice,setDice]=useState([null,null]);
  const [rolling,setRolling]=useState(false);
  const [result,setResult]=useState(null);
  const [msg,setMsg]=useState("Choose Pass or Don't Pass, set your bet, then roll.");
  const diceSymbols=["","⚀","⚁","⚂","⚃","⚄","⚅"];
  const broke=balance<1;
  function roll(){
    if(rolling)return;
    if(phase==="comeout"&&bet>balance)return;
    setRolling(true);setResult(null);
    if(phase==="comeout")setBalance(b=>b-bet);
    setTimeout(()=>{
      const d1=Math.ceil(Math.random()*6),d2=Math.ceil(Math.random()*6),sum=d1+d2;
      setDice([d1,d2]);
      if(phase==="comeout"){
        if(type==="pass"){
          if(sum===7||sum===11){setResult({label:"Natural — you win!",won:true,delta:bet,detail:`Rolled ${sum}`});setBalance(b=>b+bet*2);onUpdate({...user,balance:balance+bet});setPhase("comeout");setPoint(null);}
          else if(sum===2||sum===3||sum===12){setResult({label:"Craps — you lose",won:false,delta:-bet,detail:`Rolled ${sum}`});onUpdate({...user,balance:balance-bet});setPhase("comeout");setPoint(null);}
          else{setPoint(sum);setPhase("point");setMsg(`Point is ${sum}. Roll it again before a 7.`);}
        }else{
          if(sum===2||sum===3){setResult({label:"Win! (Craps)",won:true,delta:bet,detail:`Rolled ${sum}`});setBalance(b=>b+bet*2);onUpdate({...user,balance:balance+bet});setPhase("comeout");setPoint(null);}
          else if(sum===12){setResult({label:"Push (Bar 12)",won:false,delta:0,detail:"Rolled 12 — bar"});setBalance(b=>b+bet);onUpdate({...user,balance});setPhase("comeout");setPoint(null);}
          else if(sum===7||sum===11){setResult({label:"Don't Pass loses",won:false,delta:-bet,detail:`Rolled ${sum}`});onUpdate({...user,balance:balance-bet});setPhase("comeout");setPoint(null);}
          else{setPoint(sum);setPhase("point");setMsg(`Point is ${sum}. Roll a 7 to win.`);}
        }
      }else{
        if(type==="pass"){
          if(sum===point){setResult({label:"Hit the point — you win!",won:true,delta:bet,detail:`Rolled ${sum}`});setBalance(b=>b+bet*2);onUpdate({...user,balance:balance+bet});setPhase("comeout");setPoint(null);}
          else if(sum===7){setResult({label:"Seven out — you lose",won:false,delta:-bet,detail:"Rolled 7"});onUpdate({...user,balance});setPhase("comeout");setPoint(null);}
          else setMsg(`Point: ${point}. Keep rolling…`);
        }else{
          if(sum===7){setResult({label:"7 before point — you win!",won:true,delta:bet,detail:"Rolled 7"});setBalance(b=>b+bet*2);onUpdate({...user,balance:balance+bet});setPhase("comeout");setPoint(null);}
          else if(sum===point){setResult({label:"Point hit — you lose",won:false,delta:-bet,detail:`Rolled ${sum}`});onUpdate({...user,balance});setPhase("comeout");setPoint(null);}
          else setMsg(`Point: ${point}. Keep rolling…`);
        }
      }
      setRolling(false);
    },800);
  }
  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title="Craps" balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={S.panel}>
      <div style={{display:"flex",gap:8,marginBottom:14}} role="group" aria-label="Bet type">
        <button onClick={()=>{if(phase==="comeout")setType("pass")}} aria-pressed={type==="pass"} style={{...S.btn(type==="pass"?"gold":"ghost"),flex:1}}>Pass Line</button>
        <button onClick={()=>{if(phase==="comeout")setType("dontpass")}} aria-pressed={type==="dontpass"} style={{...S.btn(type==="dontpass"?"gold":"ghost"),flex:1}}>Don't Pass</button>
      </div>
      {point&&<div style={{color:C.gold,fontSize:20,fontWeight:700,textAlign:"center",marginBottom:10}} aria-live="polite">Point: {point}</div>}
      <div style={{display:"flex",gap:16,justifyContent:"center",margin:"18px 0"}} role="status" aria-label={rolling?"Dice rolling":`Dice showing ${dice[0]||"?"} and ${dice[1]||"?"}`}>{dice.map((d,i)=><div key={i} style={{fontSize:60,lineHeight:1}} aria-hidden="true">{rolling?"🎲":d?diceSymbols[d]:"🎲"}</div>)}</div>
      {dice[0]&&!rolling&&<div style={{textAlign:"center",color:C.muted,fontSize:15,marginBottom:8}} aria-live="polite">Sum: <b>{dice[0]+dice[1]}</b></div>}
      <div style={{color:C.muted,fontSize:12,margin:"8px 0"}} aria-live="polite">{msg}</div>
      {broke?<BrokeNotice onAtm={onAtm}/>:<>
        {phase==="comeout"&&<BetInput balance={balance} bet={bet} setBet={setBet} disabled={rolling}/>}
        <button style={S.btn("gold")} onClick={roll} disabled={rolling||(phase==="comeout"&&bet<=0)}>{rolling?"Rolling…":"Roll the dice"}</button>
      </>}
      <ResultBanner result={result}/>
      {result&&phase==="comeout"&&<button style={{...S.btn("green"),marginTop:10}} onClick={()=>{setResult(null);setDice([null,null]);setMsg("Choose Pass or Don't Pass and roll.");}}>New round</button>}
    </div>
  </div>);
}

const SIC_BO_BETS=[
  {id:"small",label:"Small (4–10)",payout:1,check:(s,d)=>s>=4&&s<=10&&!(d[0]===d[1]&&d[1]===d[2])},
  {id:"big",label:"Big (11–17)",payout:1,check:(s,d)=>s>=11&&s<=17&&!(d[0]===d[1]&&d[1]===d[2])},
  {id:"even",label:"Even sum",payout:1,check:(s)=>s%2===0},
  {id:"odd",label:"Odd sum",payout:1,check:(s)=>s%2!==0},
  {id:"triple",label:"Any triple",payout:30,check:(_,d)=>d[0]===d[1]&&d[1]===d[2]},
  {id:"sum7",label:"Sum = 7",payout:12,check:(s)=>s===7},
  {id:"sum14",label:"Sum = 14",payout:12,check:(s)=>s===14},
  {id:"sum4",label:"Sum = 4",payout:50,check:(s)=>s===4},
  {id:"sum17",label:"Sum = 17",payout:50,check:(s)=>s===17},
];

function SicBoGame({user,onUpdate,onBack,onAtm}){
  const [balance,setBalance]=useState(user.balance);
  const [bets,setBets]=useState({});
  const [chipVal,setChipVal]=useState(5);
  const [dice,setDice]=useState([null,null,null]);
  const [rolling,setRolling]=useState(false);
  const [result,setResult]=useState(null);
  const totalBet=Object.values(bets).reduce((a,b)=>a+b,0);
  const diceSymbols=["","⚀","⚁","⚂","⚃","⚄","⚅"];
  const broke=balance<1;
  function roll(){
    if(totalBet<=0||rolling)return;
    setRolling(true);setResult(null);setBalance(b=>b-totalBet);
    setTimeout(()=>{
      const d=[Math.ceil(Math.random()*6),Math.ceil(Math.random()*6),Math.ceil(Math.random()*6)];
      const s=d.reduce((a,b)=>a+b,0);
      setDice(d);
      let winnings=0;const wins=[];
      for(const [id,amount] of Object.entries(bets)){const bt=SIC_BO_BETS.find(b=>b.id===id);if(bt&&bt.check(s,d)){winnings+=amount*(bt.payout+1);wins.push(bt.label);}}
      setBalance(b=>b+winnings);
      const newBal=balance-totalBet+winnings;
      setResult({label:winnings>0?"You win!":"No match — try again",won:winnings>0,delta:winnings-totalBet,detail:`Dice: ${d.join(" ")} = ${s}${wins.length?" · "+wins.join(", "):""}`});
      onUpdate({...user,balance:newBal});setRolling(false);
    },900);
  }
  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title="Sic Bo" balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={S.panel}>
      <div style={{display:"flex",gap:16,justifyContent:"center",margin:"14px 0 18px"}} role="status" aria-label={rolling?"Dice rolling":`Dice: ${dice.filter(Boolean).join(", ")}`}>{dice.map((d,i)=><div key={i} style={{fontSize:52}} aria-hidden="true">{rolling?"🎲":d?diceSymbols[d]:"🎲"}</div>)}</div>
      <div style={S.sectionTitle}>Chip value: ${chipVal}</div>
      <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap"}}>{[1,5,10,25].map((v,i)=>(<button key={v} onClick={()=>setChipVal(v)} aria-pressed={chipVal===v} style={S.chip(["#3d8b7a","#3a6ab5","#9e3a3a","#6b4ab5"][i],chipVal===v)}>{v}</button>))}</div>
      {broke?<BrokeNotice onAtm={onAtm}/>:<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:14}}>{SIC_BO_BETS.map(b=>(<button key={b.id} aria-pressed={!!bets[b.id]} onClick={()=>{if(!rolling&&balance-totalBet>=chipVal)setBets(p=>({...p,[b.id]:(p[b.id]||0)+chipVal}))}} style={{background:bets[b.id]?C.winBg:C.panelAlt,border:`1px solid ${bets[b.id]?C.winBorder:C.border}`,borderRadius:8,padding:"10px",cursor:"pointer",color:bets[b.id]?C.win:C.text,fontFamily:"'Courier New',monospace",fontSize:12,textAlign:"left",minHeight:52}}>{b.label}<span style={{display:"block",fontSize:10,color:C.gold,marginTop:2}}>{b.payout}:1{bets[b.id]>0&&" · $"+bets[b.id]}</span></button>))}</div>
        <div style={{color:C.gold,fontSize:13,marginBottom:10}} aria-live="polite">Total bet: ${totalBet}</div>
        <div style={{display:"flex",gap:8}}><button style={S.btn("gold")} onClick={roll} disabled={rolling||totalBet<=0}>{rolling?"Rolling…":"Roll the dice"}</button><button style={S.btn("ghost")} onClick={()=>setBets({})} disabled={rolling}>Clear bets</button></div>
      </>}
      <ResultBanner result={result}/>
    </div>
  </div>);
}

const SLOT_CONFIGS={
  slots1:{name:"Classic Slots",reels:[["7","BAR","BAR","🍒","🔔","💎","⭐","BAR","🍒"],["7","BAR","🍒","BAR","🔔","💎","⭐","BAR","🍒"],["7","BAR","🍒","BAR","🔔","💎","BAR","⭐","🍒"]],symbols:["🍒","BAR","7","💎","⭐","🔔"],paylines:[{s:"7 7 7",m:100},{s:"💎 💎 💎",m:50},{s:"BAR BAR BAR",m:20},{s:"⭐ ⭐ ⭐",m:10},{s:"🍒 🍒 🍒",m:5},{s:"🍒 🍒",m:2},{s:"🍒",m:0.5}],getWin(r,bet){const[a,b,c]=r;if(a==="7"&&b==="7"&&c==="7")return bet*100;if(a==="💎"&&b==="💎"&&c==="💎")return bet*50;if(a==="BAR"&&b==="BAR"&&c==="BAR")return bet*20;if(a===b&&b===c)return bet*10;if(a==="🍒"&&b==="🍒")return bet*2;if(a==="🍒")return Math.ceil(bet*0.5);return 0;}},
  slots2:{name:"Fruit Slots",reels:[["🍒","🍋","🍊","🍇","🍉","🍓","🍑","⭐","🍒","🍋"],["🍒","🍋","🍊","🍇","🍉","🍓","🍑","⭐","🍒","🍋"],["🍒","🍋","🍊","🍇","🍉","🍓","🍑","⭐","🍒","🍋"]],symbols:["🍒","🍋","🍊","🍇","🍉","🍓","🍑","⭐"],paylines:[{s:"⭐ ⭐ ⭐",m:75},{s:"🍉 🍉 🍉",m:30},{s:"🍇 🍇 🍇",m:25},{s:"🍒 🍒 🍒",m:8},{s:"🍒 🍒",m:3},{s:"🍒",m:0.5}],getWin(r,bet){const[a,b,c]=r;if(a===b&&b===c){if(a==="⭐")return bet*75;if(a==="🍉")return bet*30;if(a==="🍇")return bet*25;if(a==="🍑")return bet*20;if(a==="🍓")return bet*15;if(a==="🍊")return bet*12;if(a==="🍋")return bet*10;if(a==="🍒")return bet*8;}if(a==="🍒"&&b==="🍒")return bet*3;if(a==="🍒")return Math.ceil(bet*0.5);return 0;}},
  slots3:{name:"Lucky Stars — 5 Reel",reels:[["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"]],symbols:["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],paylines:[{s:"🚀 × 5",m:500},{s:"☀️ × 5",m:200},{s:"🌟 × 5",m:100},{s:"⭐ × 5",m:50},{s:"any × 5",m:10},{s:"any × 4",m:3},{s:"any × 3",m:2}],getWin(r,bet){if(r.every(x=>x===r[0])){const s=r[0];if(s==="🚀")return bet*500;if(s==="☀️")return bet*200;if(s==="🪐")return bet*150;if(s==="🌟")return bet*100;if(s==="⭐")return bet*50;if(s==="💫")return bet*30;return bet*10;}const counts={};r.forEach(x=>counts[x]=(counts[x]||0)+1);const max=Math.max(...Object.values(counts));if(max>=4)return bet*3;if(max>=3)return bet*2;if(max>=2)return Math.ceil(bet*0.5);return 0;}}
};

function SlotMachine({user,onUpdate,onBack,onAtm,config}){
  const {name,reels,symbols,paylines,getWin}=config;
  const [balance,setBalance]=useState(user.balance);
  const [bet,setBet]=useState(5);
  const [spinning,setSpinning]=useState(false);
  const [display,setDisplay]=useState(reels.map(()=>symbols[0]));
  const [result,setResult]=useState(null);
  const broke=balance<1;
  function spin(){
    if(spinning||bet<=0||bet>balance)return;
    setSpinning(true);setResult(null);setBalance(b=>b-bet);
    const intervals=reels.map((_,ri)=>setInterval(()=>{setDisplay(prev=>{const n=[...prev];n[ri]=symbols[Math.floor(Math.random()*symbols.length)];return n;});},80+ri*30));
    const final=reels.map(reel=>reel[Math.floor(Math.random()*reel.length)]);
    const stops=reels.map((_,i)=>700+i*200);
    reels.forEach((_,i)=>{
      setTimeout(()=>{
        clearInterval(intervals[i]);
        setDisplay(prev=>{const n=[...prev];n[i]=final[i];return n;});
        if(i===reels.length-1){
          const win=getWin(final,bet);
          setBalance(b=>b+win);
          const newBal=balance-bet+win;
          setResult(win>0?{label:"You win!",won:true,delta:win-bet,detail:`Won $${win} — ${final.join(" ")}`}:{label:"No match — try again",won:false,delta:-bet,detail:final.join(" ")});
          onUpdate({...user,balance:newBal});setSpinning(false);
        }
      },stops[i]);
    });
  }
  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title={name} balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={{...S.panel,textAlign:"center"}}>
      <div style={{display:"flex",justifyContent:"center",gap:4,margin:"8px 0",background:C.bg,border:`3px solid ${C.goldDim}`,borderRadius:12,padding:"10px 8px"}} role="img" aria-label={spinning?"Reels spinning":`Reels showing: ${display.join(", ")}`}>{display.map((sym,i)=>(<div key={i} style={{width:"clamp(48px,12vw,66px)",height:"clamp(58px,14vw,76px)",borderRadius:8,background:"linear-gradient(180deg,#22203a,#14122a)",border:`2px solid ${C.goldDim}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(22px,5vw,36px)",animation:spinning?"reel-blur 0.15s linear infinite":undefined}}>{sym}</div>))}</div>
      <div style={{marginBottom:14,textAlign:"left"}}><div style={S.sectionTitle}>Payouts</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{paylines.map((p,i)=><div key={i} style={{fontSize:12,color:C.muted}}>{p.s} → {p.m}×</div>)}</div></div>
      {broke?<BrokeNotice onAtm={onAtm}/>:<><BetInput balance={balance} bet={bet} setBet={setBet} disabled={spinning}/><button style={{...S.btn("gold"),padding:"12px 36px",fontSize:17,marginTop:10}} onClick={spin} disabled={spinning||bet<=0||bet>balance}>{spinning?"Spinning…":"Spin 🎰"}</button></>}
      <ResultBanner result={result}/>
    </div>
  </div>);
}

function AtmModal({user,onClose,onConfirm}){
  return (<div role="dialog" aria-modal="true" aria-labelledby="atm-title" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div style={{...S.panel,maxWidth:360,textAlign:"center"}}>
      <div style={{fontSize:40}} aria-hidden="true">🏧</div>
      <div id="atm-title" style={{color:C.gold,fontSize:19,fontWeight:700,margin:"10px 0"}}>Emergency ATM</div>
      <div style={{color:C.muted,fontSize:13,marginBottom:12}}>Running low? No judgment — grab ${ATM_AMOUNT} and get back in the game.</div>
      <div style={{color:C.text,fontSize:13,marginBottom:18}}>Your balance: <b>${user.balance.toFixed(2)}</b> → <b>${(user.balance+ATM_AMOUNT).toFixed(2)}</b></div>
      <div style={{display:"flex",gap:10,justifyContent:"center"}}><button style={S.btn("gold")} onClick={onConfirm} autoFocus>Take ${ATM_AMOUNT}</button><button style={S.btn("ghost")} onClick={onClose}>Cancel</button></div>
    </div>
  </div>);
}

export default function App(){
  const [user,setUser]=useState(null);
  const [screen,setScreen]=useState("auth");
  const [game,setGame]=useState(null);
  const [showAtm,setShowAtm]=useState(false);
  function handleLogin(u){setUser(u);setScreen("lobby");}
  function handleLogout(){setUser(null);setScreen("auth");setGame(null);}
  async function handleUpdate(u){setUser({...u});await saveUser(u.email,u);}
  async function handleAtm(){const updated={...user,balance:user.balance+ATM_AMOUNT,lastAtm:Date.now()};await handleUpdate(updated);setShowAtm(false);}
  const gameProps={user,onUpdate:handleUpdate,onAtm:()=>setShowAtm(true),onBack:()=>{setGame(null);setScreen("lobby");}};
  return (<>
    <style>{GLOBAL_CSS}</style>
    {showAtm&&user&&<AtmModal user={user} onClose={()=>setShowAtm(false)} onConfirm={handleAtm}/>}
    {screen==="auth"&&<AuthScreen onLogin={handleLogin}/>}
    {screen==="lobby"&&user&&<Lobby user={user} onGame={id=>{setGame(id);setScreen("game");}} onAtm={()=>setShowAtm(true)} onLogout={handleLogout}/>}
    {screen==="game"&&user&&game==="poker"&&<PokerGame {...gameProps}/>}
    {screen==="game"&&user&&game==="roulette"&&<RouletteGame {...gameProps}/>}
    {screen==="game"&&user&&game==="craps"&&<CrapsGame {...gameProps}/>}
    {screen==="game"&&user&&game==="sicbo"&&<SicBoGame {...gameProps}/>}
    {screen==="game"&&user&&(game==="slots1"||game==="slots2"||game==="slots3")&&<SlotMachine {...gameProps} config={SLOT_CONFIGS[game]}/>}
  </>);
}
