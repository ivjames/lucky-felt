import { useState, useEffect } from "react";
import * as api from "./api";

// Display-only constants. The SERVER enforces these (cooldown, payouts, RNG);
// the client keeps copies purely for rendering. Nothing here decides money.
const ATM_AMOUNT = 500;
const ATM_COOLDOWN_MS = 5 * 60 * 1000;

function cardColor(s){return (s==="♥"||s==="♦")?"#ff6b6b":"#f0e6c8";}

function CardEl({card,hidden=false,small=false}){
  const w=small?38:52,h=small?54:74;
  if(hidden)return (<div role="img" aria-label="Hidden card" style={{width:w,height:h,borderRadius:7,border:"2px solid #e8c84a",background:"linear-gradient(135deg,#2a5a38,#142e1c)",display:"inline-flex",alignItems:"center",justifyContent:"center",margin:"0 3px",boxShadow:"0 3px 8px rgba(0,0,0,0.5)"}}><span style={{color:"#e8c84a",fontSize:small?18:24}}>🂠</span></div>);
  return (<div role="img" aria-label={`${card.r} of ${card.s}`} style={{width:w,height:h,borderRadius:7,border:"2px solid #e8c84a",background:"#22203a",display:"inline-flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"flex-start",padding:"3px 4px",margin:"0 3px",boxShadow:"0 3px 8px rgba(0,0,0,0.5)"}}><span style={{color:cardColor(card.s),fontWeight:700,fontSize:small?11:14,lineHeight:1}}>{card.r}</span><span style={{color:cardColor(card.s),fontSize:small?13:18,lineHeight:1,margin:"auto"}}>{card.s}</span><span style={{color:cardColor(card.s),fontWeight:700,fontSize:small?11:14,lineHeight:1,alignSelf:"flex-end",transform:"rotate(180deg)"}}>{card.r}</span></div>);
}

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

const chipColors=["#3d8b7a","#3a6ab5","#9e3a3a","#6b4ab5","#b58a20","#2e6e45"];
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

function BetInput({balance,bet,setBet,disabled}){
  const chips=[1,5,10,25,50,100];
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

function ErrorNotice({error}){
  if(!error)return null;
  return (<div role="alert" style={{textAlign:"center",padding:"10px",borderRadius:8,marginTop:12,background:"#2a1a00",border:"1px solid #c87020",color:"#ffaa44",fontSize:13}}>{error}</div>);
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
    setLoading(true);setMsg("");
    try{
      const {user,isNew,startingBalance}=await api.login(e);
      if(isNew)setMsg(`Welcome! Your account starts with $${startingBalance}.`);
      setTimeout(()=>onLogin(user),isNew?500:200);
    }catch(err){
      setMsg(err.message||"Couldn't sign in. Try again.");
    }finally{
      setLoading(false);
    }
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
  // Snapshot the clock once per mount (display-only; the server is the real
  // cooldown enforcer). Keeps render pure for the react-hooks lint rule.
  const [now]=useState(()=>Date.now());
  const canAtm=now-user.lastAtm>ATM_COOLDOWN_MS;
  const cooldownMin=Math.max(0,Math.ceil((ATM_COOLDOWN_MS-(now-user.lastAtm))/60000));
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

function PokerGame({user,onUpdate,onBack,onAtm,onError}){
  const [phase,setPhase]=useState("bet"); // bet | deal | flop | turn | river | showdown
  const [player,setPlayer]=useState([]);
  const [dealer,setDealer]=useState([]);
  const [community,setCommunity]=useState([]);
  const [revealed,setRevealed]=useState(false);
  const [bet,setBet]=useState(10);
  const [pot,setPot]=useState(0);
  const [result,setResult]=useState(null);
  const [balance,setBalance]=useState(user.balance);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState(null);
  const broke=balance<1;

  function fail(e){ if(e.status===401){onError(e);return;} setErr(e.message); }
  function resume(s){setPlayer(s.player);setCommunity(s.community);setPot(s.pot);setPhase(s.phase);setDealer([]);setRevealed(false);setResult(null);}

  // Recover an in-progress hand if the player reloaded mid-hand, so its already-
  // deducted stake isn't stranded server-side.
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{const s=await api.pokerState();if(alive&&s.active)resume(s);}catch{/* start fresh */}
    })();
    return()=>{alive=false;};
  },[]);

  async function deal(){
    if(busy||bet<=0||bet>balance)return;
    setBusy(true);setErr(null);
    try{
      const r=await api.pokerDeal(bet);
      setPlayer(r.player);setDealer([]);setCommunity([]);setRevealed(false);
      setPot(r.pot);setBalance(r.balance);setResult(null);setPhase("deal");
      onUpdate({...user,balance:r.balance});
    }catch(e){
      // Server says a hand is already live — pull it in rather than erroring out.
      if(e.status===409){try{const s=await api.pokerState();if(s.active){resume(s);setErr("Resumed your hand in progress.");}}catch{fail(e);}}
      else fail(e);
    }finally{setBusy(false);}
  }
  async function advance(){
    if(busy)return;
    setBusy(true);setErr(null);
    try{ const r=await api.pokerAdvance(); setCommunity(r.community); setPhase(r.phase); }
    catch(e){fail(e);}finally{setBusy(false);}
  }
  async function showdown(){
    if(busy)return;
    setBusy(true);setErr(null);
    try{
      const r=await api.pokerShowdown();
      setDealer(r.dealer);setCommunity(r.community);setRevealed(true);setBalance(r.balance);
      setResult({label:r.won?"You win!":r.push?"Push — tie hand":"Dealer wins",won:r.won,delta:r.delta,detail:`You: ${r.playerHand} · Dealer: ${r.dealerHand}`});
      setPhase("showdown");onUpdate({...user,balance:r.balance});
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function fold(){
    if(busy)return;
    setBusy(true);setErr(null);
    try{
      const r=await api.pokerFold();
      setBalance(r.balance);
      setResult({label:"Folded",won:false,delta:r.delta,detail:"You surrendered the pot."});
      setPhase("showdown");onUpdate({...user,balance:r.balance});
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  function reset(){setBet(b=>Math.min(b||10,balance));setPhase("bet");setResult(null);setPlayer([]);setDealer([]);setCommunity([]);setRevealed(false);}

  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title="Texas Hold'em Poker" balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={S.panel}>
      <div style={S.sectionTitle}>Dealer's hand</div>
      <div style={{minHeight:78,display:"flex",alignItems:"center",flexWrap:"wrap",gap:2}}>{phase==="bet"?<span style={{color:C.mutedDim,fontSize:12}}>waiting for deal…</span>:revealed?dealer.map((c,i)=><CardEl key={i} card={c}/>):[0,1].map(i=><CardEl key={i} card={{}} hidden/>)}</div>
      <div style={{...S.sectionTitle,marginTop:18}}>Community cards</div>
      <div style={{minHeight:78,display:"flex",alignItems:"center",flexWrap:"wrap",gap:2}}>{community.map((c,i)=><CardEl key={i} card={c}/>)}{!community.length&&<span style={{color:C.mutedDim,fontSize:12}}>awaiting flop…</span>}</div>
      <div style={{...S.sectionTitle,marginTop:18}}>Your hand</div>
      <div style={{minHeight:78,display:"flex",alignItems:"center",flexWrap:"wrap",gap:2}}>{player.map((c,i)=><CardEl key={i} card={c}/>)}{!player.length&&<span style={{color:C.mutedDim,fontSize:12}}>waiting for deal…</span>}</div>
      <div style={{marginTop:14}}>
        {phase==="bet"&&(broke?<BrokeNotice onAtm={onAtm}/>:<><BetInput balance={balance} bet={bet} setBet={setBet} disabled={busy}/><button style={{...S.btn("gold"),marginTop:8}} onClick={deal} disabled={busy||bet<=0||bet>balance}>{busy?"Dealing…":"Deal cards"}</button></>)}
        {phase==="deal"&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={S.btn("green")} onClick={advance} disabled={busy}>Check / see flop</button><button style={S.btn("red")} onClick={fold} disabled={busy}>Fold</button></div>}
        {phase==="flop"&&<button style={S.btn("green")} onClick={advance} disabled={busy}>Check / see turn</button>}
        {phase==="turn"&&<button style={S.btn("green")} onClick={advance} disabled={busy}>Check / see river</button>}
        {phase==="river"&&<button style={S.btn("gold")} onClick={showdown} disabled={busy}>Go to showdown</button>}
      </div>
      <div style={{marginTop:6,color:C.muted,fontSize:12}} aria-live="polite">Pot: ${pot}</div>
      <ResultBanner result={result}/>
      <ErrorNotice error={err}/>
      {phase==="showdown"&&<button style={{...S.btn("gold"),marginTop:14}} onClick={reset}>New hand</button>}
    </div>
  </div>);
}

function RouletteGame({user,onUpdate,onBack,onAtm,onError,config}){
  const [balance,setBalance]=useState(user.balance);
  const [bets,setBets]=useState({});
  const [chipVal,setChipVal]=useState(5);
  const [spinning,setSpinning]=useState(false);
  const [landed,setLanded]=useState(null);
  const [result,setResult]=useState(null);
  const [history,setHistory]=useState([]);
  const [err,setErr]=useState(null);
  const totalBet=Object.values(bets).reduce((a,b)=>a+b,0);
  const broke=balance<1;
  const redNums=config.redNums;
  const isRed=(n)=>redNums.includes(n);
  async function spin(){
    if(totalBet<=0||spinning||totalBet>balance)return;
    setSpinning(true);setResult(null);setErr(null);
    try{
      const [r]=await Promise.all([api.betRoulette(bets),sleep(1400)]);
      setLanded(r.landed);setBalance(r.balance);
      const wins=r.wins;
      setResult({label:r.delta>0?"You win!":"Dealer wins this round",won:r.delta>0,delta:r.delta,detail:`Ball landed on ${r.landed} ${isRed(r.landed)?"🔴":r.landed===0?"🟢":"⚫"}${wins.length?" · Hits: "+wins.join(", "):""}`});
      setHistory(h=>[{n:r.landed,color:r.landed===0?"green":isRed(r.landed)?"red":"black"},...h].slice(0,14));
      onUpdate({...user,balance:r.balance});
    }catch(e){ if(e.status===401){onError(e);return;} setErr(e.message); }
    finally{setSpinning(false);}
  }
  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title="European Roulette" balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={S.panel}>
      <div style={{textAlign:"center",marginBottom:14}}>{spinning?<div style={{fontSize:52}} role="status" aria-label="Wheel spinning">🎡</div>:landed!==null?<div style={{fontSize:56,fontWeight:700,color:landed===0?"#4ade80":isRed(landed)?"#f87171":C.text}} role="status" aria-label={`Ball landed on ${landed}`}>{landed}</div>:<div style={{fontSize:52,color:C.mutedDim}} aria-hidden="true">🎡</div>}</div>
      {history.length>0&&<div style={{display:"flex",gap:3,marginBottom:14,flexWrap:"wrap"}} aria-label="Recent results">{history.map((h,i)=>(<span key={i} style={{width:24,height:24,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:h.color==="green"?"#1a5a1a":h.color==="red"?"#5a1a1a":"#1a1a2e",border:"1px solid #444",color:C.text}}>{h.n}</span>))}</div>}
      <div style={S.sectionTitle}>Chip value</div>
      <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap"}}>{[1,5,10,25,50,100].map((v,i)=>(<button key={v} onClick={()=>setChipVal(v)} aria-pressed={chipVal===v} style={S.chip(chipColors[i],chipVal===v)}>{v}</button>))}</div>
      {broke?<BrokeNotice onAtm={onAtm}/>:<>
        <div style={S.sectionTitle}>Place bets</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:14}}>{config.roulette.map(b=>(<button key={b.id} aria-pressed={!!bets[b.id]} onClick={()=>{if(!spinning&&balance-totalBet>=chipVal)setBets(p=>({...p,[b.id]:(p[b.id]||0)+chipVal}))}} style={{background:bets[b.id]?C.winBg:C.panelAlt,border:`1px solid ${bets[b.id]?C.winBorder:C.border}`,borderRadius:8,padding:"10px 6px",cursor:"pointer",color:bets[b.id]?C.win:C.text,fontSize:12,fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column",alignItems:"center",gap:3,minHeight:52}}><span>{b.label}</span>{bets[b.id]>0&&<span style={{fontSize:10,color:C.gold}}>${bets[b.id]}</span>}</button>))}</div>
        <div style={{color:C.gold,fontSize:13,marginBottom:10}} aria-live="polite">Total bet: ${totalBet}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={S.btn("gold")} onClick={spin} disabled={spinning||totalBet<=0||totalBet>balance}>{spinning?"Spinning…":"Spin the wheel"}</button><button style={S.btn("ghost")} onClick={()=>setBets({})} disabled={spinning}>Clear bets</button></div>
      </>}
      <ResultBanner result={result}/>
      <ErrorNotice error={err}/>
    </div>
  </div>);
}

function CrapsGame({user,onUpdate,onBack,onAtm,onError}){
  const [balance,setBalance]=useState(user.balance);
  const [bet,setBet]=useState(10);
  const [type,setType]=useState("pass");
  const [phase,setPhase]=useState("comeout");
  const [point,setPoint]=useState(null);
  const [dice,setDice]=useState([null,null]);
  const [rolling,setRolling]=useState(false);
  const [result,setResult]=useState(null);
  const [msg,setMsg]=useState("Choose Pass or Don't Pass, set your bet, then roll.");
  const [err,setErr]=useState(null);
  const diceSymbols=["","⚀","⚁","⚂","⚃","⚄","⚅"];
  const broke=balance<1;
  async function roll(){
    if(rolling)return;
    if(phase==="comeout"&&(bet<=0||bet>balance))return;
    setRolling(true);setResult(null);setErr(null);
    try{
      const [r]=await Promise.all([api.crapsRoll(bet,type),sleep(650)]);
      setDice(r.dice);setBalance(r.balance);setPhase(r.phase);setPoint(r.point);setMsg(r.label);
      if(r.settled){
        setResult({label:r.label,won:r.outcome==="win",delta:r.delta,detail:`Rolled ${r.sum}`});
        onUpdate({...user,balance:r.balance});
      }else{
        onUpdate({...user,balance:r.balance});
      }
    }catch(e){ if(e.status===401){onError(e);return;} setErr(e.message); }
    finally{setRolling(false);}
  }
  function newRound(){setResult(null);setDice([null,null]);setPhase("comeout");setPoint(null);setMsg("Choose Pass or Don't Pass and roll.");}
  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title="Craps" balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={S.panel}>
      <div style={{display:"flex",gap:8,marginBottom:14}} role="group" aria-label="Bet type">
        <button onClick={()=>{if(phase==="comeout"&&!rolling)setType("pass")}} aria-pressed={type==="pass"} style={{...S.btn(type==="pass"?"gold":"ghost"),flex:1}}>Pass Line</button>
        <button onClick={()=>{if(phase==="comeout"&&!rolling)setType("dontpass")}} aria-pressed={type==="dontpass"} style={{...S.btn(type==="dontpass"?"gold":"ghost"),flex:1}}>Don't Pass</button>
      </div>
      {point&&<div style={{color:C.gold,fontSize:20,fontWeight:700,textAlign:"center",marginBottom:10}} aria-live="polite">Point: {point}</div>}
      <div style={{display:"flex",gap:16,justifyContent:"center",margin:"18px 0"}} role="status" aria-label={rolling?"Dice rolling":`Dice showing ${dice[0]||"?"} and ${dice[1]||"?"}`}>{dice.map((d,i)=><div key={i} style={{fontSize:60,lineHeight:1}} aria-hidden="true">{rolling?"🎲":d?diceSymbols[d]:"🎲"}</div>)}</div>
      {dice[0]&&!rolling&&<div style={{textAlign:"center",color:C.muted,fontSize:15,marginBottom:8}} aria-live="polite">Sum: <b>{dice[0]+dice[1]}</b></div>}
      <div style={{color:C.muted,fontSize:12,margin:"8px 0"}} aria-live="polite">{msg}</div>
      {broke&&phase==="comeout"?<BrokeNotice onAtm={onAtm}/>:<>
        {phase==="comeout"&&<BetInput balance={balance} bet={bet} setBet={setBet} disabled={rolling}/>}
        <button style={S.btn("gold")} onClick={roll} disabled={rolling||(phase==="comeout"&&bet<=0)}>{rolling?"Rolling…":"Roll the dice"}</button>
      </>}
      <ResultBanner result={result}/>
      <ErrorNotice error={err}/>
      {result&&phase==="comeout"&&<button style={{...S.btn("green"),marginTop:10}} onClick={newRound}>New round</button>}
    </div>
  </div>);
}

function SicBoGame({user,onUpdate,onBack,onAtm,onError,config}){
  const [balance,setBalance]=useState(user.balance);
  const [bets,setBets]=useState({});
  const [chipVal,setChipVal]=useState(5);
  const [dice,setDice]=useState([null,null,null]);
  const [rolling,setRolling]=useState(false);
  const [result,setResult]=useState(null);
  const [err,setErr]=useState(null);
  const totalBet=Object.values(bets).reduce((a,b)=>a+b,0);
  const diceSymbols=["","⚀","⚁","⚂","⚃","⚄","⚅"];
  const broke=balance<1;
  async function roll(){
    if(totalBet<=0||rolling||totalBet>balance)return;
    setRolling(true);setResult(null);setErr(null);
    try{
      const [r]=await Promise.all([api.betSicbo(bets),sleep(750)]);
      setDice(r.dice);setBalance(r.balance);
      setResult({label:r.delta>0?"You win!":"No match — try again",won:r.delta>0,delta:r.delta,detail:`Dice: ${r.dice.join(" ")} = ${r.sum}${r.wins.length?" · "+r.wins.join(", "):""}`});
      onUpdate({...user,balance:r.balance});
    }catch(e){ if(e.status===401){onError(e);return;} setErr(e.message); }
    finally{setRolling(false);}
  }
  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title="Sic Bo" balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={S.panel}>
      <div style={{display:"flex",gap:16,justifyContent:"center",margin:"14px 0 18px"}} role="status" aria-label={rolling?"Dice rolling":`Dice: ${dice.filter(Boolean).join(", ")}`}>{dice.map((d,i)=><div key={i} style={{fontSize:52}} aria-hidden="true">{rolling?"🎲":d?diceSymbols[d]:"🎲"}</div>)}</div>
      <div style={S.sectionTitle}>Chip value: ${chipVal}</div>
      <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap"}}>{[1,5,10,25].map((v,i)=>(<button key={v} onClick={()=>setChipVal(v)} aria-pressed={chipVal===v} style={S.chip(["#3d8b7a","#3a6ab5","#9e3a3a","#6b4ab5"][i],chipVal===v)}>{v}</button>))}</div>
      {broke?<BrokeNotice onAtm={onAtm}/>:<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:14}}>{config.sicbo.map(b=>(<button key={b.id} aria-pressed={!!bets[b.id]} onClick={()=>{if(!rolling&&balance-totalBet>=chipVal)setBets(p=>({...p,[b.id]:(p[b.id]||0)+chipVal}))}} style={{background:bets[b.id]?C.winBg:C.panelAlt,border:`1px solid ${bets[b.id]?C.winBorder:C.border}`,borderRadius:8,padding:"10px",cursor:"pointer",color:bets[b.id]?C.win:C.text,fontFamily:"'Courier New',monospace",fontSize:12,textAlign:"left",minHeight:52}}>{b.label}<span style={{display:"block",fontSize:10,color:C.gold,marginTop:2}}>{b.payout}:1{bets[b.id]>0&&" · $"+bets[b.id]}</span></button>))}</div>
        <div style={{color:C.gold,fontSize:13,marginBottom:10}} aria-live="polite">Total bet: ${totalBet}</div>
        <div style={{display:"flex",gap:8}}><button style={S.btn("gold")} onClick={roll} disabled={rolling||totalBet<=0||totalBet>balance}>{rolling?"Rolling…":"Roll the dice"}</button><button style={S.btn("ghost")} onClick={()=>setBets({})} disabled={rolling}>Clear bets</button></div>
      </>}
      <ResultBanner result={result}/>
      <ErrorNotice error={err}/>
    </div>
  </div>);
}

function SlotMachine({user,onUpdate,onBack,onAtm,onError,gameId,config}){
  const {name,symbols,reelCount,paylines}=config;
  const [balance,setBalance]=useState(user.balance);
  const [bet,setBet]=useState(5);
  const [spinning,setSpinning]=useState(false);
  const [display,setDisplay]=useState(Array.from({length:reelCount},()=>symbols[0]));
  const [result,setResult]=useState(null);
  const [err,setErr]=useState(null);
  const broke=balance<1;
  async function spin(){
    if(spinning||bet<=0||bet>balance)return;
    setSpinning(true);setResult(null);setErr(null);
    // Animation-only randomness — the blur/whirl. The FINAL symbols come from
    // the server response, never from this loop.
    const intervals=Array.from({length:reelCount},(_,ri)=>setInterval(()=>{
      setDisplay(prev=>{const n=[...prev];n[ri]=symbols[Math.floor(Math.random()*symbols.length)];return n;});
    },80+ri*30));
    const stopAnim=()=>intervals.forEach(clearInterval);
    try{
      const [r]=await Promise.all([api.betSlots(gameId,bet),sleep(700+reelCount*180)]);
      stopAnim();
      setDisplay(r.reels);
      setBalance(r.balance);
      setResult(r.win>0?{label:"You win!",won:true,delta:r.delta,detail:`Won $${r.win} — ${r.reels.join(" ")}`}:{label:"No match — try again",won:false,delta:r.delta,detail:r.reels.join(" ")});
      onUpdate({...user,balance:r.balance});
    }catch(e){
      stopAnim();
      if(e.status===401){onError(e);return;}
      setErr(e.message);
    }finally{setSpinning(false);}
  }
  return (<div style={{...S.app,padding:"0 0 40px"}}>
    <GameHeader title={name} balance={balance} onBack={onBack} onAtm={onAtm}/>
    <div style={{...S.panel,textAlign:"center"}}>
      <div style={{display:"flex",justifyContent:"center",gap:4,margin:"8px 0",background:C.bg,border:`3px solid ${C.goldDim}`,borderRadius:12,padding:"10px 8px"}} role="img" aria-label={spinning?"Reels spinning":`Reels showing: ${display.join(", ")}`}>{display.map((sym,i)=>(<div key={i} style={{width:"clamp(48px,12vw,66px)",height:"clamp(58px,14vw,76px)",borderRadius:8,background:"linear-gradient(180deg,#22203a,#14122a)",border:`2px solid ${C.goldDim}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(22px,5vw,36px)",animation:spinning?"reel-blur 0.15s linear infinite":undefined}}>{sym}</div>))}</div>
      <div style={{marginBottom:14,textAlign:"left"}}><div style={S.sectionTitle}>Payouts</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{paylines.map((p,i)=><div key={i} style={{fontSize:12,color:C.muted}}>{p.s} → {p.m}×</div>)}</div></div>
      {broke?<BrokeNotice onAtm={onAtm}/>:<><BetInput balance={balance} bet={bet} setBet={setBet} disabled={spinning}/><button style={{...S.btn("gold"),padding:"12px 36px",fontSize:17,marginTop:10}} onClick={spin} disabled={spinning||bet<=0||bet>balance}>{spinning?"Spinning…":"Spin 🎰"}</button></>}
      <ResultBanner result={result}/>
      <ErrorNotice error={err}/>
    </div>
  </div>);
}

function AtmModal({user,onClose,onConfirm,busy,error}){
  return (<div role="dialog" aria-modal="true" aria-labelledby="atm-title" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div style={{...S.panel,maxWidth:360,textAlign:"center"}}>
      <div style={{fontSize:40}} aria-hidden="true">🏧</div>
      <div id="atm-title" style={{color:C.gold,fontSize:19,fontWeight:700,margin:"10px 0"}}>Emergency ATM</div>
      <div style={{color:C.muted,fontSize:13,marginBottom:12}}>Running low? No judgment — grab ${ATM_AMOUNT} and get back in the game.</div>
      <div style={{color:C.text,fontSize:13,marginBottom:18}}>Your balance: <b>${user.balance.toFixed(2)}</b> → <b>${(user.balance+ATM_AMOUNT).toFixed(2)}</b></div>
      <div style={{display:"flex",gap:10,justifyContent:"center"}}><button style={S.btn("gold")} onClick={onConfirm} autoFocus disabled={busy}>{busy?"…":`Take $${ATM_AMOUNT}`}</button><button style={S.btn("ghost")} onClick={onClose} disabled={busy}>Cancel</button></div>
      <ErrorNotice error={error}/>
    </div>
  </div>);
}

export default function App(){
  const [user,setUser]=useState(null);
  const [screen,setScreen]=useState("auth");
  const [game,setGame]=useState(null);
  const [showAtm,setShowAtm]=useState(false);
  const [atmBusy,setAtmBusy]=useState(false);
  const [atmError,setAtmError]=useState(null);
  const [config,setConfig]=useState(null);
  const [booting,setBooting]=useState(true);

  // On load: fetch public config and, if a token is cached, restore the session.
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{const cfg=await api.getConfig();if(alive)setConfig(cfg);}catch{/* games will show a notice */}
      if(api.getToken()){
        try{const {user:me}=await api.fetchMe();if(alive){setUser(me);setScreen("lobby");}}
        catch{api.clearToken();}
      }
      if(alive)setBooting(false);
    })();
    return()=>{alive=false;};
  },[]);

  function handleLogin(u){setUser(u);setScreen("lobby");}
  async function handleLogout(){await api.logout();setUser(null);setScreen("auth");setGame(null);}
  // Server already persisted the authoritative balance; this just syncs UI state.
  function handleUpdate(u){setUser({...u});}
  // 401 → session is gone (e.g. server restart). Drop to the login screen.
  function handleAuthError(){api.clearToken();setUser(null);setGame(null);setScreen("auth");}
  async function handleAtm(){
    setAtmBusy(true);setAtmError(null);
    try{
      const r=await api.atm();
      setUser(u=>({...u,balance:r.balance,lastAtm:r.lastAtm}));
      setShowAtm(false);
    }catch(e){
      if(e.status===401){handleAuthError();return;}
      if(e.status===429&&e.data?.remainingMs!=null){
        const mins=Math.ceil(e.data.remainingMs/60000);
        setAtmError(`ATM on cooldown — try again in ${mins} minute${mins===1?"":"s"}.`);
      }else setAtmError(e.message);
    }finally{setAtmBusy(false);}
  }

  const gameProps={user,onUpdate:handleUpdate,onAtm:()=>{setAtmError(null);setShowAtm(true);},onBack:()=>{setGame(null);setScreen("lobby");},onError:handleAuthError};

  if(booting)return (<><style>{GLOBAL_CSS}</style><div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}}>Loading the casino…</div></>);

  const configReady=!!config;
  return (<>
    <style>{GLOBAL_CSS}</style>
    {showAtm&&user&&<AtmModal user={user} onClose={()=>setShowAtm(false)} onConfirm={handleAtm} busy={atmBusy} error={atmError}/>}
    {screen==="auth"&&<AuthScreen onLogin={handleLogin}/>}
    {screen==="lobby"&&user&&<Lobby user={user} onGame={id=>{setGame(id);setScreen("game");}} onAtm={()=>{setAtmError(null);setShowAtm(true);}} onLogout={handleLogout}/>}
    {screen==="game"&&user&&!configReady&&<div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}}>Loading game…</div>}
    {screen==="game"&&user&&configReady&&game==="poker"&&<PokerGame {...gameProps}/>}
    {screen==="game"&&user&&configReady&&game==="roulette"&&<RouletteGame {...gameProps} config={config}/>}
    {screen==="game"&&user&&configReady&&game==="craps"&&<CrapsGame {...gameProps}/>}
    {screen==="game"&&user&&configReady&&game==="sicbo"&&<SicBoGame {...gameProps} config={config}/>}
    {screen==="game"&&user&&configReady&&(game==="slots1"||game==="slots2"||game==="slots3")&&<SlotMachine {...gameProps} gameId={game} config={config.slots[game]}/>}
  </>);
}
