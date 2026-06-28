import { useState } from "react";
import { loadUser, saveUser } from "./storage";

const STARTING_BALANCE = 1000;
const ATM_AMOUNT = 500;
const ATM_COOLDOWN_MS = 5 * 60 * 1000;

// Repair accounts saved by older/incompatible versions so a returning user with
// a partial or corrupted record (e.g. missing `balance`) never crashes the app
// on login. This removes the need to manually clear localStorage to recover.
function normalizeUser(email, u) {
  const safe = u && typeof u === "object" ? u : {};
  // Treat null/undefined as "missing" (restore defaults) but preserve a real 0.
  const balance = safe.balance == null ? NaN : Number(safe.balance);
  const lastAtm = safe.lastAtm == null ? NaN : Number(safe.lastAtm);
  const created = safe.created == null ? NaN : Number(safe.created);
  return {
    email: safe.email || email,
    balance: Number.isFinite(balance) ? balance : STARTING_BALANCE,
    lastAtm: Number.isFinite(lastAtm) ? lastAtm : 0,
    created: Number.isFinite(created) ? created : Date.now(),
  };
}

// ─── Card Helpers ─────────────────────────────────────────────────────────────
const SUITS = ["♠","♥","♦","♣"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RANK_VAL = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":10,"Q":10,"K":10,"A":14};

function makeDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({r,s});
  return d;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function cardColor(s) { return (s==="♥"||s==="♦") ? "#e05555" : "#e8d5a3"; }

function CardEl({card, hidden=false, small=false}) {
  const w = small ? 36 : 48, h = small ? 52 : 68;
  if (hidden) return (
    <div style={{width:w,height:h,borderRadius:6,border:"2px solid #c9a84c",
      background:"linear-gradient(135deg,#1a3a24,#0a1f14)",display:"inline-flex",
      alignItems:"center",justifyContent:"center",margin:"0 2px"}}>
      <span style={{color:"#c9a84c",fontSize:small?16:22}}>🂠</span>
    </div>
  );
  return (
    <div style={{width:w,height:h,borderRadius:6,border:"2px solid #c9a84c",
      background:"#1a1a2e",display:"inline-flex",flexDirection:"column",
      alignItems:"flex-start",justifyContent:"flex-start",padding:"2px 3px",
      margin:"0 2px",boxShadow:"0 2px 6px rgba(0,0,0,0.5)"}}>
      <span style={{color:cardColor(card.s),fontWeight:700,fontSize:small?10:13,lineHeight:1}}>{card.r}</span>
      <span style={{color:cardColor(card.s),fontSize:small?12:16,lineHeight:1,margin:"2px auto"}}>{card.s}</span>
      <span style={{color:cardColor(card.s),fontWeight:700,fontSize:small?10:13,lineHeight:1,alignSelf:"flex-end",transform:"rotate(180deg)"}}>{card.r}</span>
    </div>
  );
}

// ─── Poker Hand Evaluator ─────────────────────────────────────────────────────
function getRank(card) { return RANK_VAL[card.r]; }
function evaluateHand(cards) {
  const sorted = [...cards].sort((a,b)=>getRank(b)-getRank(a));
  const ranks = sorted.map(c=>getRank(c));
  const suits = sorted.map(c=>c.s);
  const rankCounts = {};
  ranks.forEach(r=>{rankCounts[r]=(rankCounts[r]||0)+1;});
  const counts = Object.values(rankCounts).sort((a,b)=>b-a);
  const uniqueRanks = [...new Set(ranks)].sort((a,b)=>b-a);
  const isFlush = suits.every(s=>s===suits[0]);
  const isStraight = uniqueRanks.length===5 && (uniqueRanks[0]-uniqueRanks[4]===4);
  const isWheelStraight = uniqueRanks.join(",") === "14,5,4,3,2";
  if ((isStraight||isWheelStraight) && isFlush) {
    const high = isWheelStraight ? 5 : uniqueRanks[0];
    return {rank:8, name: high===14?"Royal Flush":"Straight Flush", tb:[high]};
  }
  if (counts[0]===4) {
    const quad = +Object.keys(rankCounts).find(r=>rankCounts[r]===4);
    return {rank:7, name:"Four of a Kind", tb:[quad,...uniqueRanks.filter(r=>r!==quad)]};
  }
  if (counts[0]===3 && counts[1]===2) {
    const trip = +Object.keys(rankCounts).find(r=>rankCounts[r]===3);
    const pair = +Object.keys(rankCounts).find(r=>rankCounts[r]===2);
    return {rank:6, name:"Full House", tb:[trip,pair]};
  }
  if (isFlush) return {rank:5, name:"Flush", tb:ranks};
  if (isStraight||isWheelStraight) return {rank:4, name:"Straight", tb:[isWheelStraight?5:uniqueRanks[0]]};
  if (counts[0]===3) {
    const trip = +Object.keys(rankCounts).find(r=>rankCounts[r]===3);
    return {rank:3, name:"Three of a Kind", tb:[trip,...uniqueRanks.filter(r=>r!==trip)]};
  }
  if (counts[0]===2 && counts[1]===2) {
    const pairs = Object.keys(rankCounts).filter(r=>rankCounts[r]===2).map(Number).sort((a,b)=>b-a);
    return {rank:2, name:"Two Pair", tb:[...pairs,...uniqueRanks.filter(r=>!pairs.includes(r))]};
  }
  if (counts[0]===2) {
    const pair = +Object.keys(rankCounts).find(r=>rankCounts[r]===2);
    return {rank:1, name:"Pair", tb:[pair,...uniqueRanks.filter(r=>r!==pair)]};
  }
  return {rank:0, name:"High Card ("+sorted[0].r+")", tb:ranks};
}
function bestOf7(cards) {
  let best = null;
  for (let i=0;i<cards.length;i++) for (let j=i+1;j<cards.length;j++) {
    const five = cards.filter((_,idx)=>idx!==i&&idx!==j);
    const ev = evaluateHand(five);
    if (!best || ev.rank > best.rank || (ev.rank===best.rank && compareTB(ev.tb,best.tb)>0)) best=ev;
  }
  return best;
}
function compareTB(a,b) {
  for (let i=0;i<Math.min(a.length,b.length);i++) { if (a[i]!==b[i]) return a[i]-b[i]; }
  return 0;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight:"100vh", background:"linear-gradient(160deg,#060e0a 0%,#0a1f14 40%,#06140d 100%)",
    fontFamily:"'Courier New',monospace", color:"#e8d5a3", padding:"0 0 60px 0" },
  header: { textAlign:"center", padding:"24px 16px 12px", borderBottom:"1px solid #1a3a24" },
  neonTitle: { fontSize:"clamp(28px,6vw,52px)", fontWeight:700, letterSpacing:"0.15em",
    color:"#c9a84c", textShadow:"0 0 10px #c9a84c88, 0 0 30px #c9a84c44",
    fontFamily:"Georgia,serif", margin:0 },
  subtitle: { color:"#6b9e7a", fontSize:13, letterSpacing:"0.2em", marginTop:4 },
  balance: { background:"#0a1f14", border:"1px solid #c9a84c44", borderRadius:8,
    padding:"8px 20px", display:"inline-flex", alignItems:"center", gap:12, margin:"12px auto" },
  btn: (v="gold") => ({
    background: v==="gold" ? "linear-gradient(135deg,#c9a84c,#a07c30)" :
                v==="green" ? "linear-gradient(135deg,#2a5c3a,#1a3a24)" :
                v==="red" ? "linear-gradient(135deg,#7a2020,#4a1010)" : "transparent",
    color: v==="gold" ? "#0a1f14" : "#e8d5a3",
    border: v==="ghost" ? "1px solid #c9a84c44" : "none",
    borderRadius:6, padding:"8px 18px", cursor:"pointer",
    fontFamily:"'Courier New',monospace", fontWeight:700, fontSize:13,
    letterSpacing:"0.05em", transition:"opacity 0.15s"
  }),
  input: { background:"#0a1f14", border:"1px solid #c9a84c44", borderRadius:6,
    color:"#e8d5a3", padding:"8px 12px", fontFamily:"'Courier New',monospace",
    fontSize:14, outline:"none", width:"100%", boxSizing:"border-box" },
  panel: { background:"linear-gradient(135deg,#0d2418,#0a1f14)", border:"1px solid #1a3a2444",
    borderRadius:12, padding:"20px", maxWidth:680, margin:"16px auto" },
  sectionTitle: { color:"#c9a84c", fontSize:11, letterSpacing:"0.25em", textTransform:"uppercase",
    marginBottom:8, borderBottom:"1px solid #c9a84c22", paddingBottom:4 },
  chip: (color) => ({ width:36, height:36, borderRadius:"50%", background:color,
    border:"3px solid #e8d5a344", display:"inline-flex", alignItems:"center",
    justifyContent:"center", fontSize:10, fontWeight:700, cursor:"pointer",
    margin:2, color:"#fff", boxShadow:"0 2px 6px rgba(0,0,0,0.4)" })
};

// ─── Shared Components ────────────────────────────────────────────────────────
function BetInput({balance, bet, setBet, disabled}) {
  const chips = [1,5,10,25,50,100];
  const chipColors = ["#4a7c6f","#3a5c9a","#7a3a3a","#5a4a8a","#8a6a20","#2a5a3a"];
  return (
    <div style={{margin:"10px 0"}}>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
        {chips.map((v,i)=>(
          <button key={v} disabled={disabled||v>balance}
            onClick={()=>setBet(b=>Math.min(b+v,balance))}
            style={{...S.chip(chipColors[i]),opacity:disabled||v>balance?0.4:1}}>{v}</button>
        ))}
        <button disabled={disabled} onClick={()=>setBet(0)}
          style={{...S.btn("ghost"),padding:"4px 10px",fontSize:11}}>CLR</button>
        <button disabled={disabled} onClick={()=>setBet(b=>Math.min(b*2,balance))}
          style={{...S.btn("ghost"),padding:"4px 10px",fontSize:11}}>2x</button>
      </div>
      <div style={{color:"#c9a84c",fontSize:16,fontWeight:700}}>
        BET: <span style={{color:"#e8d5a3"}}>${bet}</span>
      </div>
    </div>
  );
}

function ResultBanner({result}) {
  if (!result) return null;
  const win = result.delta > 0, push = result.delta === 0;
  return (
    <div style={{textAlign:"center",padding:"12px",borderRadius:8,marginTop:12,
      background:win?"#1a3a10":push?"#1a1a3a":"#3a1010",
      border:`1px solid ${win?"#4a9a30":push?"#4a4a9a":"#9a3030"}`,
      color:win?"#7aee4a":push?"#aaaaee":"#ee5555"}}>
      <div style={{fontSize:18,fontWeight:700}}>{result.label}</div>
      {result.delta!==0&&<div style={{fontSize:14}}>{result.delta>0?"+$"+result.delta:"-$"+Math.abs(result.delta)}</div>}
      {result.detail&&<div style={{fontSize:12,marginTop:4,color:"#aaa"}}>{result.detail}</div>}
    </div>
  );
}

function GameHeader({title,balance,onBack}) {
  return (
    <div style={{...S.header,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
      <button style={S.btn("ghost")} onClick={onBack}>← LOBBY</button>
      <div style={{color:"#c9a84c",fontWeight:700,letterSpacing:"0.1em",fontSize:15}}>{title}</div>
      <div style={{color:"#c9a84c",fontWeight:700}}>$<span style={{fontSize:18}}>{typeof balance==="number"?balance.toFixed(2):balance}</span></div>
    </div>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function AuthScreen({onLogin}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  async function handleEnter() {
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) { setMsg("Enter a valid email."); return; }
    setLoading(true);
    let user = await loadUser(e);
    if (!user) {
      user = { email:e, balance:STARTING_BALANCE, lastAtm:0, created:Date.now() };
      await saveUser(e, user);
      setMsg("New account — welcome! Starting balance: $"+STARTING_BALANCE);
    } else {
      // Heal legacy/corrupted records and persist the repaired version.
      const fixed = normalizeUser(e, user);
      if (JSON.stringify(fixed) !== JSON.stringify(user)) await saveUser(e, fixed);
      user = fixed;
    }
    setTimeout(()=>onLogin(user), 400);
    setLoading(false);
  }
  return (
    <div style={{...S.app,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.panel,maxWidth:400,textAlign:"center"}}>
        <div style={S.neonTitle}>🎰 LUCKY FELT</div>
        <div style={S.subtitle}>CASINO & GAMING CLUB</div>
        <div style={{margin:"24px 0 8px",color:"#6b9e7a",fontSize:12}}>ENTER YOUR EMAIL TO PLAY</div>
        <input style={S.input} type="email" placeholder="you@example.com"
          value={email} onChange={e=>setEmail(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleEnter()} />
        <button style={{...S.btn("gold"),marginTop:12,width:"100%",padding:"10px"}}
          onClick={handleEnter} disabled={loading}>
          {loading?"CHECKING...":"ENTER THE CASINO"}
        </button>
        {msg&&<div style={{marginTop:10,color:"#c9a84c",fontSize:12}}>{msg}</div>}
        <div style={{marginTop:16,color:"#3a5a44",fontSize:11}}>No password needed.</div>
      </div>
    </div>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
const GAMES = [
  {id:"poker",    name:"Texas Hold'em",  icon:"🃏", desc:"5-card community poker vs dealer"},
  {id:"roulette", name:"Roulette",        icon:"🎡", desc:"European single-zero wheel"},
  {id:"craps",    name:"Craps",           icon:"🎲", desc:"Pass/don't pass dice classic"},
  {id:"sicbo",    name:"Sic Bo",          icon:"🎲", desc:"Three-dice bet variety"},
  {id:"slots1",   name:"Classic Slots",   icon:"🎰", desc:"3-reel BAR & 7 machine"},
  {id:"slots2",   name:"Fruit Slots",     icon:"🍒", desc:"Cherries, lemons, watermelons"},
  {id:"slots3",   name:"Lucky Stars",     icon:"⭐", desc:"5-reel bonus stars machine"},
];

function Lobby({user,onGame,onAtm,onLogout}) {
  const canAtm = Date.now()-user.lastAtm > ATM_COOLDOWN_MS;
  const cooldownLeft = Math.max(0,Math.ceil((ATM_COOLDOWN_MS-(Date.now()-user.lastAtm))/60000));
  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={S.neonTitle}>🎰 LUCKY FELT</div>
        <div style={S.subtitle}>CASINO & GAMING CLUB</div>
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:8}}>
          <div style={S.balance}>
            <span style={{color:"#6b9e7a",fontSize:11,letterSpacing:"0.15em"}}>BALANCE</span>
            <span style={{color:"#c9a84c",fontSize:20,fontWeight:700}}>${user.balance.toFixed(2)}</span>
          </div>
          <button style={S.btn("ghost")} onClick={()=>canAtm&&onAtm()}>
            {canAtm ? "🏧 FREE ATM (+$"+ATM_AMOUNT+")" : "🏧 ATM ("+cooldownLeft+"m)"}
          </button>
          <button style={{...S.btn("ghost"),fontSize:11}} onClick={onLogout}>← SIGN OUT</button>
        </div>
        <div style={{color:"#3a5a44",fontSize:11,marginTop:4}}>{user.email}</div>
      </div>
      <div style={{maxWidth:680,margin:"24px auto",padding:"0 16px"}}>
        <div style={S.sectionTitle}>CHOOSE YOUR GAME</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:10}}>
          {GAMES.map(g=>(
            <div key={g.id} onClick={()=>onGame(g.id)}
              style={{background:"linear-gradient(135deg,#0d2418,#0a1f14)",
                border:"1px solid #1a3a24",borderRadius:10,padding:"16px",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#c9a84c88"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#1a3a24"}>
              <div style={{fontSize:28}}>{g.icon}</div>
              <div style={{color:"#c9a84c",fontWeight:700,marginTop:6,fontSize:14}}>{g.name}</div>
              <div style={{color:"#6b9e7a",fontSize:11,marginTop:3}}>{g.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Poker ────────────────────────────────────────────────────────────────────
function PokerGame({user,onUpdate,onBack}) {
  const [phase,setPhase]=useState("bet");
  const [deck,setDeck]=useState([]);
  const [player,setPlayer]=useState([]);
  const [dealer,setDealer]=useState([]);
  const [community,setCommunity]=useState([]);
  const [bet,setBet]=useState(10);
  const [pot,setPot]=useState(0);
  const [result,setResult]=useState(null);
  const [balance,setBalance]=useState(user.balance);

  function deal() {
    if(bet<=0||bet>balance) return;
    const d=shuffle(makeDeck());
    setPlayer([d[0],d[2]]); setDealer([d[1],d[3]]);
    setCommunity([]); setDeck(d.slice(4));
    setPot(bet); setBalance(b=>b-bet); setResult(null); setPhase("deal");
  }
  function flop(){setCommunity([deck[0],deck[1],deck[2]]);setDeck(d=>d.slice(3));setPhase("flop");}
  function turn(){setCommunity(p=>[...p,deck[0]]);setDeck(d=>d.slice(1));setPhase("turn");}
  function river(){setCommunity(p=>[...p,deck[0]]);setDeck(d=>d.slice(1));setPhase("river");}
  function showdown(){
    const pH=bestOf7([...player,...community]), dH=bestOf7([...dealer,...community]);
    let win=false,push=false;
    if(pH.rank>dH.rank||(pH.rank===dH.rank&&compareTB(pH.tb,dH.tb)>0)){win=true;}
    else if(pH.rank===dH.rank&&compareTB(pH.tb,dH.tb)===0){push=true;}
    const newBal=balance+(win?pot*2:push?pot:0);
    setBalance(newBal); setResult({label:win?"YOU WIN! 🏆":push?"PUSH":"DEALER WINS",
      delta:win?pot:push?0:-pot,detail:`You: ${pH.name} | Dealer: ${dH.name}`});
    setPhase("showdown");
    const u={...user,balance:newBal}; onUpdate(u);
  }
  function fold(){
    setResult({label:"FOLDED",delta:-pot,detail:"You surrendered the pot."});
    setPhase("showdown"); const u={...user,balance}; onUpdate(u);
  }
  function reset(){setBalance(user.balance);setBet(b=>Math.min(b,user.balance));setPhase("bet");setResult(null);}

  return (
    <div style={{...S.app,padding:"0 0 40px"}}>
      <GameHeader title="Texas Hold'em Poker" balance={balance} onBack={onBack}/>
      <div style={S.panel}>
        <div style={S.sectionTitle}>DEALER</div>
        <div style={{minHeight:72}}>{dealer.map((c,i)=><CardEl key={i} card={c} hidden={phase!=="showdown"}/>)}</div>
        <div style={{...S.sectionTitle,marginTop:16}}>COMMUNITY</div>
        <div style={{minHeight:72}}>
          {community.map((c,i)=><CardEl key={i} card={c}/>)}
          {!community.length&&phase!=="bet"&&<span style={{color:"#3a5a44",fontSize:12}}>awaiting flop...</span>}
        </div>
        <div style={{...S.sectionTitle,marginTop:16}}>YOUR HAND</div>
        <div style={{minHeight:72}}>{player.map((c,i)=><CardEl key={i} card={c}/>)}</div>
        {phase==="showdown"&&<div style={{color:"#c9a84c",fontSize:12,marginTop:8}}>Your hand: <b>{bestOf7([...player,...community])?.name}</b></div>}
        {phase==="bet"&&<><BetInput balance={balance} bet={bet} setBet={setBet}/><button style={{...S.btn("gold"),marginTop:8}} onClick={deal} disabled={bet<=0||bet>balance}>DEAL</button></>}
        {phase==="deal"&&<><button style={{...S.btn("green"),marginRight:8,marginTop:8}} onClick={flop}>CHECK / NEXT</button><button style={{...S.btn("red"),marginTop:8}} onClick={fold}>FOLD</button></>}
        {phase==="flop"&&<button style={{...S.btn("green"),marginTop:8}} onClick={turn}>BET / CHECK</button>}
        {phase==="turn"&&<button style={{...S.btn("green"),marginTop:8}} onClick={river}>BET / CHECK</button>}
        {phase==="river"&&<button style={{...S.btn("gold"),marginTop:8}} onClick={showdown}>SHOWDOWN</button>}
        <div style={{marginTop:4,color:"#6b9e7a",fontSize:12}}>POT: ${pot}</div>
        <ResultBanner result={result}/>
        {phase==="showdown"&&<button style={{...S.btn("gold"),marginTop:12}} onClick={reset}>NEW HAND</button>}
      </div>
    </div>
  );
}

// ─── Roulette ─────────────────────────────────────────────────────────────────
const RED_NUMS=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const ROULETTE_BETS=[
  {id:"red",   label:"🔴 RED",   payout:1, check:n=>RED_NUMS.includes(n)},
  {id:"black", label:"⚫ BLACK", payout:1, check:n=>n>0&&!RED_NUMS.includes(n)},
  {id:"odd",   label:"ODD",      payout:1, check:n=>n%2!==0&&n>0},
  {id:"even",  label:"EVEN",     payout:1, check:n=>n%2===0&&n>0},
  {id:"1-18",  label:"1–18",     payout:1, check:n=>n>=1&&n<=18},
  {id:"19-36", label:"19–36",    payout:1, check:n=>n>=19&&n<=36},
  {id:"1st12", label:"1st 12",   payout:2, check:n=>n>=1&&n<=12},
  {id:"2nd12", label:"2nd 12",   payout:2, check:n=>n>=13&&n<=24},
  {id:"3rd12", label:"3rd 12",   payout:2, check:n=>n>=25&&n<=36},
  {id:"0",     label:"0 (35:1)", payout:35,check:n=>n===0},
];

function RouletteGame({user,onUpdate,onBack}) {
  const [balance,setBalance]=useState(user.balance);
  const [bets,setBets]=useState({});
  const [chipVal,setChipVal]=useState(5);
  const [spinning,setSpinning]=useState(false);
  const [landed,setLanded]=useState(null);
  const [result,setResult]=useState(null);
  const [history,setHistory]=useState([]);
  const totalBet=Object.values(bets).reduce((a,b)=>a+b,0);

  function spin() {
    if(totalBet<=0||spinning) return;
    setSpinning(true); setBalance(b=>b-totalBet); setResult(null);
    setTimeout(()=>{
      const n=Math.floor(Math.random()*37);
      setLanded(n);
      let winnings=0; const wins=[];
      for(const [id,amount] of Object.entries(bets)){
        const bt=ROULETTE_BETS.find(b=>b.id===id);
        if(bt&&bt.check(n)){winnings+=amount*(bt.payout+1);wins.push(bt.label);}
      }
      setBalance(b=>b+winnings);
      const newBal=balance-totalBet+winnings;
      setResult({label:winnings>0?"YOU WIN!":"HOUSE WINS",delta:winnings-totalBet,
        detail:`Ball: ${n} ${RED_NUMS.includes(n)?"🔴":n===0?"🟢":"⚫"}${wins.length?" | "+wins.join(", "):""}`});
      setHistory(h=>[{n,color:n===0?"green":RED_NUMS.includes(n)?"red":"black"},...h].slice(0,12));
      const u={...user,balance:newBal}; onUpdate(u); setSpinning(false);
    },1800);
  }

  return (
    <div style={{...S.app,padding:"0 0 40px"}}>
      <GameHeader title="European Roulette" balance={balance} onBack={onBack}/>
      <div style={S.panel}>
        <div style={{textAlign:"center",marginBottom:12}}>
          {spinning?<div style={{fontSize:48}}>🎡</div>:landed!==null?
            <div style={{fontSize:52,fontWeight:700,color:landed===0?"#4a9a30":RED_NUMS.includes(landed)?"#e05555":"#e8d5a3"}}>{landed}</div>:
            <div style={{fontSize:48,color:"#3a5a44"}}>🎡</div>}
        </div>
        <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
          {history.map((h,i)=>(
            <span key={i} style={{width:22,height:22,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,
              background:h.color==="green"?"#1a5a1a":h.color==="red"?"#5a1a1a":"#1a1a1a",border:"1px solid #333",color:"#e8d5a3"}}>{h.n}</span>
          ))}
        </div>
        <div style={S.sectionTitle}>CHIP VALUE</div>
        <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
          {[1,5,10,25,50,100].map(v=>(
            <button key={v} onClick={()=>setChipVal(v)}
              style={{...S.chip(["#4a7c6f","#3a5c9a","#7a3a3a","#5a4a8a","#8a6a20","#2a5a3a"][[1,5,10,25,50,100].indexOf(v)]),
                border:chipVal===v?"3px solid #c9a84c":"3px solid #e8d5a344",color:"#fff"}}>{v}</button>
          ))}
        </div>
        <div style={S.sectionTitle}>BETS</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:12}}>
          {ROULETTE_BETS.map(b=>(
            <button key={b.id} onClick={()=>{if(!spinning&&balance-totalBet>=chipVal)setBets(p=>({...p,[b.id]:(p[b.id]||0)+chipVal}))}}
              style={{background:bets[b.id]>0?"#1a3a10":"#0d2418",border:`1px solid ${bets[b.id]>0?"#4a9a30":"#1a3a24"}`,
                borderRadius:6,padding:"8px 4px",cursor:"pointer",color:bets[b.id]>0?"#7aee4a":"#e8d5a3",
                fontSize:12,fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <span>{b.label}</span>
              {bets[b.id]>0&&<span style={{fontSize:10,color:"#c9a84c"}}>${bets[b.id]}</span>}
            </button>
          ))}
        </div>
        <div style={{color:"#c9a84c",fontSize:13,marginBottom:8}}>TOTAL BET: ${totalBet}</div>
        <div style={{display:"flex",gap:8}}>
          <button style={S.btn("gold")} onClick={spin} disabled={spinning||totalBet<=0}>{spinning?"SPINNING...":"SPIN"}</button>
          <button style={S.btn("ghost")} onClick={()=>setBets({})} disabled={spinning}>CLEAR</button>
        </div>
        <ResultBanner result={result}/>
      </div>
    </div>
  );
}

// ─── Craps ────────────────────────────────────────────────────────────────────
function CrapsGame({user,onUpdate,onBack}) {
  const [balance,setBalance]=useState(user.balance);
  const [bet,setBet]=useState(10);
  const [type,setType]=useState("pass");
  const [phase,setPhase]=useState("comeout");
  const [point,setPoint]=useState(null);
  const [dice,setDice]=useState([null,null]);
  const [rolling,setRolling]=useState(false);
  const [result,setResult]=useState(null);
  const [msg,setMsg]=useState("Select Pass or Don't Pass, set bet, and roll.");
  const diceSymbols=["","⚀","⚁","⚂","⚃","⚄","⚅"];

  function roll() {
    if(rolling) return;
    if(phase==="comeout"&&bet>balance) return;
    setRolling(true); setResult(null);
    if(phase==="comeout") setBalance(b=>b-bet);
    setTimeout(()=>{
      const d1=Math.ceil(Math.random()*6),d2=Math.ceil(Math.random()*6),sum=d1+d2;
      setDice([d1,d2]);
      if(phase==="comeout"){
        if(type==="pass"){
          if(sum===7||sum===11){setResult({label:"NATURAL! WIN",delta:bet,detail:`Rolled ${sum}`});setBalance(b=>b+bet*2);const u={...user,balance:balance+bet};onUpdate(u);setPhase("comeout");setPoint(null);}
          else if(sum===2||sum===3||sum===12){setResult({label:"CRAPS — LOSE",delta:-bet,detail:`Rolled ${sum}`});const u={...user,balance:balance-bet};onUpdate(u);setPhase("comeout");setPoint(null);}
          else{setPoint(sum);setPhase("point");setMsg(`Point is ${sum}. Hit it again before 7.`);}
        } else {
          if(sum===2||sum===3){setResult({label:"WIN! (Craps)",delta:bet,detail:`Rolled ${sum}`});setBalance(b=>b+bet*2);const u={...user,balance:balance+bet};onUpdate(u);setPhase("comeout");setPoint(null);}
          else if(sum===12){setResult({label:"PUSH (Bar 12)",delta:0,detail:`Rolled 12`});setBalance(b=>b+bet);const u={...user,balance};onUpdate(u);setPhase("comeout");setPoint(null);}
          else if(sum===7||sum===11){setResult({label:"DON'T PASS LOSES",delta:-bet,detail:`Rolled ${sum}`});const u={...user,balance:balance-bet};onUpdate(u);setPhase("comeout");setPoint(null);}
          else{setPoint(sum);setPhase("point");setMsg(`Point is ${sum}. 7 wins for Don't Pass.`);}
        }
      } else {
        if(type==="pass"){
          if(sum===point){setResult({label:"HIT THE POINT! WIN",delta:bet,detail:`Rolled ${sum}`});setBalance(b=>b+bet*2);const u={...user,balance:balance+bet};onUpdate(u);setPhase("comeout");setPoint(null);}
          else if(sum===7){setResult({label:"SEVEN OUT — LOSE",delta:-bet,detail:`Rolled 7`});const u={...user,balance};onUpdate(u);setPhase("comeout");setPoint(null);}
          else setMsg(`Point: ${point}. Keep rolling...`);
        } else {
          if(sum===7){setResult({label:"7 BEFORE POINT — WIN",delta:bet,detail:`Rolled 7`});setBalance(b=>b+bet*2);const u={...user,balance:balance+bet};onUpdate(u);setPhase("comeout");setPoint(null);}
          else if(sum===point){setResult({label:"POINT HIT — LOSE",delta:-bet,detail:`Rolled ${sum}`});const u={...user,balance};onUpdate(u);setPhase("comeout");setPoint(null);}
          else setMsg(`Point: ${point}. Keep rolling...`);
        }
      }
      setRolling(false);
    },800);
  }

  return (
    <div style={{...S.app,padding:"0 0 40px"}}>
      <GameHeader title="Craps" balance={balance} onBack={onBack}/>
      <div style={S.panel}>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button onClick={()=>{if(phase==="comeout")setType("pass")}} style={{...S.btn(type==="pass"?"gold":"ghost"),flex:1}}>PASS LINE</button>
          <button onClick={()=>{if(phase==="comeout")setType("dontpass")}} style={{...S.btn(type==="dontpass"?"gold":"ghost"),flex:1}}>DON'T PASS</button>
        </div>
        {phase==="comeout"&&<BetInput balance={balance} bet={bet} setBet={setBet} disabled={rolling}/>}
        {point&&<div style={{color:"#c9a84c",fontSize:18,fontWeight:700,textAlign:"center",marginBottom:8}}>POINT: {point}</div>}
        <div style={{display:"flex",gap:16,justifyContent:"center",margin:"16px 0"}}>
          {dice.map((d,i)=><div key={i} style={{fontSize:56}}>{rolling?"🎲":d?diceSymbols[d]:"🎲"}</div>)}
        </div>
        {dice[0]&&!rolling&&<div style={{textAlign:"center",color:"#6b9e7a",fontSize:14}}>Sum: {dice[0]+dice[1]}</div>}
        <div style={{color:"#6b9e7a",fontSize:12,margin:"8px 0"}}>{msg}</div>
        <button style={S.btn("gold")} onClick={roll} disabled={rolling||(phase==="comeout"&&bet<=0)}>{rolling?"ROLLING...":"ROLL DICE"}</button>
        <ResultBanner result={result}/>
        {result&&phase==="comeout"&&<button style={{...S.btn("green"),marginTop:8}} onClick={()=>{setResult(null);setDice([null,null]);setMsg("Select bet type and roll.");}}>NEW ROUND</button>}
      </div>
    </div>
  );
}

// ─── Sic Bo ───────────────────────────────────────────────────────────────────
const SIC_BO_BETS=[
  {id:"small", label:"SMALL (4–10)", payout:1, check:(s,d)=>s>=4&&s<=10&&!(d[0]===d[1]&&d[1]===d[2])},
  {id:"big",   label:"BIG (11–17)",  payout:1, check:(s,d)=>s>=11&&s<=17&&!(d[0]===d[1]&&d[1]===d[2])},
  {id:"even",  label:"EVEN SUM",     payout:1, check:(s)=>s%2===0},
  {id:"odd",   label:"ODD SUM",      payout:1, check:(s)=>s%2!==0},
  {id:"triple",label:"ANY TRIPLE",   payout:30,check:(_,d)=>d[0]===d[1]&&d[1]===d[2]},
  {id:"sum7",  label:"SUM = 7",      payout:12,check:(s)=>s===7},
  {id:"sum14", label:"SUM = 14",     payout:12,check:(s)=>s===14},
  {id:"sum4",  label:"SUM = 4",      payout:50,check:(s)=>s===4},
  {id:"sum17", label:"SUM = 17",     payout:50,check:(s)=>s===17},
];

function SicBoGame({user,onUpdate,onBack}) {
  const [balance,setBalance]=useState(user.balance);
  const [bets,setBets]=useState({});
  const [chipVal,setChipVal]=useState(5);
  const [dice,setDice]=useState([null,null,null]);
  const [rolling,setRolling]=useState(false);
  const [result,setResult]=useState(null);
  const totalBet=Object.values(bets).reduce((a,b)=>a+b,0);
  const diceSymbols=["","⚀","⚁","⚂","⚃","⚄","⚅"];

  function roll(){
    if(totalBet<=0||rolling) return;
    setRolling(true); setResult(null); setBalance(b=>b-totalBet);
    setTimeout(()=>{
      const d=[Math.ceil(Math.random()*6),Math.ceil(Math.random()*6),Math.ceil(Math.random()*6)];
      const s=d.reduce((a,b)=>a+b,0);
      setDice(d);
      let winnings=0; const wins=[];
      for(const [id,amount] of Object.entries(bets)){
        const bt=SIC_BO_BETS.find(b=>b.id===id);
        if(bt&&bt.check(s,d)){winnings+=amount*(bt.payout+1);wins.push(bt.label);}
      }
      setBalance(b=>b+winnings);
      const newBal=balance-totalBet+winnings;
      setResult({label:winnings>0?"WIN!":"LOSE",delta:winnings-totalBet,detail:`Dice: ${d.join(" ")} = ${s}${wins.length?" | "+wins.join(", "):""}`});
      const u={...user,balance:newBal}; onUpdate(u); setRolling(false);
    },900);
  }

  return (
    <div style={{...S.app,padding:"0 0 40px"}}>
      <GameHeader title="Sic Bo" balance={balance} onBack={onBack}/>
      <div style={S.panel}>
        <div style={{display:"flex",gap:16,justifyContent:"center",margin:"12px 0 16px"}}>
          {dice.map((d,i)=><div key={i} style={{fontSize:48}}>{rolling?"🎲":d?diceSymbols[d]:"🎲"}</div>)}
        </div>
        <div style={S.sectionTitle}>CHIP: ${chipVal}</div>
        <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
          {[1,5,10,25].map(v=><button key={v} onClick={()=>setChipVal(v)} style={{...S.btn(chipVal===v?"gold":"ghost"),padding:"4px 10px",fontSize:12}}>{v}</button>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
          {SIC_BO_BETS.map(b=>(
            <button key={b.id} onClick={()=>{if(!rolling&&balance-totalBet>=chipVal)setBets(p=>({...p,[b.id]:(p[b.id]||0)+chipVal}))}}
              style={{background:bets[b.id]>0?"#1a3a10":"#0d2418",border:`1px solid ${bets[b.id]>0?"#4a9a30":"#1a3a24"}`,
                borderRadius:6,padding:"8px",cursor:"pointer",color:bets[b.id]>0?"#7aee4a":"#e8d5a3",
                fontFamily:"'Courier New',monospace",fontSize:11,textAlign:"left"}}>
              {b.label}<span style={{display:"block",fontSize:9,color:"#c9a84c"}}>{b.payout}:1{bets[b.id]>0&&" · $"+bets[b.id]}</span>
            </button>
          ))}
        </div>
        <div style={{color:"#c9a84c",fontSize:13,marginBottom:8}}>TOTAL BET: ${totalBet}</div>
        <div style={{display:"flex",gap:8}}>
          <button style={S.btn("gold")} onClick={roll} disabled={rolling||totalBet<=0}>{rolling?"ROLLING...":"ROLL DICE"}</button>
          <button style={S.btn("ghost")} onClick={()=>setBets({})} disabled={rolling}>CLEAR</button>
        </div>
        <ResultBanner result={result}/>
      </div>
    </div>
  );
}

// ─── Slots ────────────────────────────────────────────────────────────────────
const SLOT_CONFIGS = {
  slots1: {
    name:"Classic Slots",
    reels:[["7","BAR","BAR","🍒","🔔","💎","⭐","BAR","🍒"],["7","BAR","🍒","BAR","🔔","💎","⭐","BAR","🍒"],["7","BAR","🍒","BAR","🔔","💎","BAR","⭐","🍒"]],
    symbols:["🍒","BAR","7","💎","⭐","🔔"],
    paylines:[{s:["7","7","7"],m:100},{s:["💎","💎","💎"],m:50},{s:["BAR","BAR","BAR"],m:20},{s:["⭐","⭐","⭐"],m:10},{s:["🍒","🍒","🍒"],m:5},{s:["🍒","🍒"],m:2}],
    getWin(r,bet){const[a,b,c]=r;if(a==="7"&&b==="7"&&c==="7")return bet*100;if(a==="💎"&&b==="💎"&&c==="💎")return bet*50;if(a==="BAR"&&b==="BAR"&&c==="BAR")return bet*20;if(a===b&&b===c)return bet*10;if(a==="🍒"&&b==="🍒")return bet*2;if(a==="🍒")return Math.ceil(bet*0.5);return 0;}
  },
  slots2: {
    name:"Fruit Slots",
    reels:[["🍒","🍋","🍊","🍇","🍉","🍓","🍑","⭐","🍒","🍋"],["🍒","🍋","🍊","🍇","🍉","🍓","🍑","⭐","🍒","🍋"],["🍒","🍋","🍊","🍇","🍉","🍓","🍑","⭐","🍒","🍋"]],
    symbols:["🍒","🍋","🍊","🍇","🍉","🍓","🍑","⭐"],
    paylines:[{s:["⭐","⭐","⭐"],m:75},{s:["🍉","🍉","🍉"],m:30},{s:["🍇","🍇","🍇"],m:25},{s:["🍒","🍒","🍒"],m:8},{s:["🍒","🍒"],m:3}],
    getWin(r,bet){const[a,b,c]=r;if(a===b&&b===c){if(a==="⭐")return bet*75;if(a==="🍉")return bet*30;if(a==="🍇")return bet*25;if(a==="🍑")return bet*20;if(a==="🍓")return bet*15;if(a==="🍊")return bet*12;if(a==="🍋")return bet*10;if(a==="🍒")return bet*8;}if(a==="🍒"&&b==="🍒")return bet*3;if(a==="🍒")return Math.ceil(bet*0.5);return 0;}
  },
  slots3: {
    name:"Lucky Stars — 5 Reel",
    reels:[["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"]],
    symbols:["⭐","🌟","💫","✨","🌙","☀️","🪐","🚀"],
    paylines:[{s:["🚀×5"],m:500},{s:["☀️×5"],m:200},{s:["🌟×5"],m:100},{s:["⭐×5"],m:50},{s:["any×4"],m:3}],
    getWin(r,bet){if(r.every(x=>x===r[0])){const s=r[0];if(s==="🚀")return bet*500;if(s==="☀️")return bet*200;if(s==="🪐")return bet*150;if(s==="🌟")return bet*100;if(s==="⭐")return bet*50;if(s==="💫")return bet*30;return bet*10;}if(r.slice(0,4).every(x=>x===r[0]))return bet*3;if(r.slice(0,3).every(x=>x===r[0]))return bet*2;if(r[0]===r[1])return Math.ceil(bet*0.5);return 0;}
  }
};

function SlotMachine({user,onUpdate,onBack,config}) {
  const {name,reels,symbols,paylines,getWin}=config;
  const [balance,setBalance]=useState(user.balance);
  const [bet,setBet]=useState(5);
  const [spinning,setSpinning]=useState(false);
  const [display,setDisplay]=useState(reels.map(()=>symbols[0]));
  const [result,setResult]=useState(null);

  function spin(){
    if(spinning||bet<=0||bet>balance) return;
    setSpinning(true); setResult(null); setBalance(b=>b-bet);
    const intervals=reels.map((_,ri)=>setInterval(()=>{
      setDisplay(prev=>{const n=[...prev];n[ri]=symbols[Math.floor(Math.random()*symbols.length)];return n;});
    },80+ri*30));
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
          setResult(win>0?{label:"🎉 WIN!",delta:win-bet,detail:`Won $${win} — ${final.join(" ")}`}:{label:"NO WIN",delta:-bet,detail:final.join(" ")});
          const u={...user,balance:newBal}; onUpdate(u); setSpinning(false);
        }
      },stops[i]);
    });
  }

  return (
    <div style={{...S.app,padding:"0 0 40px"}}>
      <GameHeader title={name} balance={balance} onBack={onBack}/>
      <div style={{...S.panel,textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"center",gap:4,margin:"12px 0",
          background:"#060e0a",border:"3px solid #c9a84c44",borderRadius:10,padding:"12px 8px"}}>
          {display.map((sym,i)=>(
            <div key={i} style={{width:64,height:72,borderRadius:6,
              background:"linear-gradient(180deg,#1a1a2e,#0d0d1e)",
              border:"2px solid #c9a84c44",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:36}}>{sym}</div>
          ))}
        </div>
        <div style={{marginBottom:12,textAlign:"left"}}>
          <div style={S.sectionTitle}>PAYOUTS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            {paylines.map((p,i)=>(
              <div key={i} style={{fontSize:11,color:"#6b9e7a"}}>
                {Array.isArray(p.s)?p.s.join(" "):p.s} → {p.m}x
              </div>
            ))}
          </div>
        </div>
        <BetInput balance={balance} bet={bet} setBet={setBet} disabled={spinning}/>
        <button style={{...S.btn("gold"),padding:"10px 32px",fontSize:16,marginTop:8}}
          onClick={spin} disabled={spinning||bet<=0||bet>balance}>
          {spinning?"SPINNING...":"SPIN 🎰"}
        </button>
        <ResultBanner result={result}/>
      </div>
    </div>
  );
}

// ─── ATM Modal ────────────────────────────────────────────────────────────────
function AtmModal({user,onClose,onConfirm}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{...S.panel,maxWidth:340,textAlign:"center"}}>
        <div style={{fontSize:36}}>🏧</div>
        <div style={{color:"#c9a84c",fontSize:18,fontWeight:700,margin:"8px 0"}}>EMERGENCY ATM</div>
        <div style={{color:"#6b9e7a",fontSize:13,marginBottom:12}}>Running low? We'll top you up with ${ATM_AMOUNT}.</div>
        <div style={{color:"#e8d5a3",fontSize:12,marginBottom:16}}>Current balance: <b>${user.balance.toFixed(2)}</b></div>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          <button style={S.btn("gold")} onClick={onConfirm}>TAKE ${ATM_AMOUNT}</button>
          <button style={S.btn("ghost")} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null);
  const [screen,setScreen]=useState("auth");
  const [game,setGame]=useState(null);
  const [showAtm,setShowAtm]=useState(false);

  function handleLogin(u){setUser(u);setScreen("lobby");}
  function handleLogout(){setUser(null);setScreen("auth");setGame(null);}

  async function handleUpdate(u){setUser({...u});await saveUser(u.email,u);}

  async function handleAtm(){
    const updated={...user,balance:user.balance+ATM_AMOUNT,lastAtm:Date.now()};
    await handleUpdate(updated); setShowAtm(false);
  }

  const gameProps={user,onUpdate:handleUpdate,onBack:()=>{setGame(null);setScreen("lobby");}};

  return (
    <>
      <style>{`*{box-sizing:border-box;}body{margin:0;}button:hover{opacity:0.85;}button:disabled{opacity:0.4!important;cursor:not-allowed!important;}::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-track{background:#0a1f14;}::-webkit-scrollbar-thumb{background:#1a3a24;border-radius:3px;}`}</style>
      {showAtm&&user&&<AtmModal user={user} onClose={()=>setShowAtm(false)} onConfirm={handleAtm}/>}
      {screen==="auth"&&<AuthScreen onLogin={handleLogin}/>}
      {screen==="lobby"&&user&&<Lobby user={user} onGame={id=>{setGame(id);setScreen("game");}} onAtm={()=>setShowAtm(true)} onLogout={handleLogout}/>}
      {screen==="game"&&user&&game==="poker"&&<PokerGame {...gameProps}/>}
      {screen==="game"&&user&&game==="roulette"&&<RouletteGame {...gameProps}/>}
      {screen==="game"&&user&&game==="craps"&&<CrapsGame {...gameProps}/>}
      {screen==="game"&&user&&game==="sicbo"&&<SicBoGame {...gameProps}/>}
      {screen==="game"&&user&&(game==="slots1"||game==="slots2"||game==="slots3")&&<SlotMachine {...gameProps} config={SLOT_CONFIGS[game]}/>}
    </>
  );
}
