"use client";

import { useEffect, useMemo, useState } from "react";

type Prize = { id: string; name: string; chance: number; color: string };
type Game = "wheel" | "match";

const defaultPrizes: Prize[] = [
  { id: "star", name: "星星贴纸", chance: 35, color: "#ff8a3d" },
  { id: "candy", name: "水果糖", chance: 30, color: "#ffd35a" },
  { id: "badge", name: "勇气徽章", chance: 20, color: "#60c7ff" },
  { id: "toy", name: "神秘玩具", chance: 10, color: "#9c7cff" },
  { id: "crown", name: "超级大奖", chance: 5, color: "#ff70a6" },
];

const icons: Record<string, React.ReactNode> = {
  wheel: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 6M12 12l-7 3"/></svg>,
  match: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="8" height="8" rx="2"/><rect x="13" y="12" width="8" height="8" rx="2"/><path d="m5.5 8 1.5 1.5L9.5 7M15.5 16l1.5 1.5 2.5-2.5"/></svg>,
  settings: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>,
  gift: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18v11H3zM2 6h20v4H2zM12 6v15M12 6c-1.5-4-6-4-6-1 0 2 3 2 6 1Zm0 0c1.5-4 6-4 6-1 0 2-3 2-6 1Z"/></svg>,
};

const todayKey = () => new Date().toLocaleDateString("zh-CN");

export default function Home() {
  const [game, setGame] = useState<Game>("wheel");
  const [prizes, setPrizes] = useState<Prize[]>(defaultPrizes);
  const [draft, setDraft] = useState<Prize[]>(defaultPrizes);
  const [adminOpen, setAdminOpen] = useState(false);
  const [usedToday, setUsedToday] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [cards, setCards] = useState<number[]>([]);
  const [opened, setOpened] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [message, setMessage] = useState("准备好了吗？今天的好运在等你！");

  useEffect(() => {
    fetch("/api/game").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.prizes) { setPrizes(data.prizes); setDraft(data.prizes); }
    }).catch(() => undefined);
    setUsedToday(localStorage.getItem("star-prize-draw") === todayKey());
  }, []);

  const gradient = useMemo(() => {
    let at = 0;
    return `conic-gradient(${prizes.map(p => { const start = at; at += p.chance * 3.6; return `${p.color} ${start}deg ${at}deg`; }).join(",")})`;
  }, [prizes]);

  function resetMatch() {
    setCards([0, 1, 2, 0, 1, 2].sort(() => Math.random() - .5));
    setOpened([]); setMatched([]); setResult(null);
    setMessage("找出三组一样的图案，就能揭晓奖品！");
  }

  useEffect(() => { if (game === "match" && cards.length === 0) resetMatch(); }, [game, cards.length]);

  async function drawPrize() {
    if (usedToday || spinning) return;
    setSpinning(true); setResult(null); setMessage("好运正在转过来……");
    try {
      const response = await fetch("/api/game", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "今天已经抽过啦");
      const prize = data.prize as Prize;
      const index = prizes.findIndex(p => p.id === prize.id);
      setRotation(v => v + 1800 + (360 - index * (360 / prizes.length)));
      setTimeout(() => {
        setResult(prize); setUsedToday(true); setSpinning(false);
        localStorage.setItem("star-prize-draw", todayKey());
        setMessage(`太棒了！你获得了「${prize.name}」`);
      }, 2400);
    } catch (error) {
      setSpinning(false); setUsedToday(true);
      setMessage(error instanceof Error ? error.message : "稍后再试试");
    }
  }

  function flipCard(index: number) {
    if (usedToday || opened.includes(index) || matched.includes(index) || opened.length === 2) return;
    const next = [...opened, index]; setOpened(next);
    if (next.length === 2) {
      if (cards[next[0]] === cards[next[1]]) setTimeout(() => {
        const done = [...matched, ...next]; setMatched(done); setOpened([]);
        if (done.length === cards.length) void drawPrize();
      }, 500);
      else setTimeout(() => setOpened([]), 750);
    }
  }

  async function saveRules() {
    const total = draft.reduce((sum, p) => sum + Number(p.chance), 0);
    if (total !== 100 || draft.some(p => !p.name.trim() || p.chance < 0)) { setMessage("奖品概率合计必须等于 100%"); return; }
    const response = await fetch("/api/game", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ prizes: draft }) });
    if (response.ok) { setPrizes(draft); setAdminOpen(false); setMessage("规则保存成功，下一次抽奖生效"); }
  }

  const cardSymbols = ["star", "heart", "bolt"];

  return <main>
    <header><a className="brand" href="#top" aria-label="星愿乐园首页"><span className="logo">{icons.gift}</span><span><b>星愿乐园</b><small>LUCKY CLUB</small></span></a><div className="headerActions"><span className="dailyPill"><i/>今日机会 <b>{usedToday ? 0 : 1}</b>/1</span><button className="iconButton" onClick={() => setAdminOpen(true)} aria-label="打开规则设置">{icons.settings}</button></div></header>
    <section className="intro" id="top"><div className="kicker"><span>★</span>每日一份小惊喜</div><h1>今天，幸运会<br/><em>落在谁身上？</em></h1><p>{message}</p></section>
    <nav className="gameTabs" aria-label="选择小游戏"><button className={game === "wheel" ? "active" : ""} onClick={() => { setGame("wheel"); setResult(null); }}><span>{icons.wheel}</span><b>幸运转盘</b><small>转一转，好运来</small></button><button className={game === "match" ? "active" : ""} onClick={() => { setGame("match"); setResult(null); resetMatch(); }}><span>{icons.match}</span><b>快乐对对碰</b><small>翻一翻，找朋友</small></button></nav>
    <section className="playground" aria-live="polite"><div className="cloud cloudOne"/><div className="cloud cloudTwo"/>{game === "wheel" ? <div className="wheelGame"><div className="pointer" aria-hidden="true"/><div className="wheelShell"><div className="wheel" style={{ background: gradient, transform: `rotate(${rotation}deg)` }}>{prizes.map((p, i) => <span className="wheelLabel" key={p.id} style={{ transform: `rotate(${i * (360 / prizes.length) + 36}deg)` }}>{p.name}</span>)}<div className="wheelCenter">★</div></div></div><button className="playButton" disabled={usedToday || spinning} onClick={drawPrize}>{spinning ? "转动中…" : usedToday ? "明天再来" : "开始转动"}</button></div> : <div className="matchGame"><div className="matchGrid">{cards.map((value, index) => { const shown = opened.includes(index) || matched.includes(index); return <button key={index} className={`matchCard ${shown ? "flipped" : ""} ${matched.includes(index) ? "matched" : ""}`} onClick={() => flipCard(index)} aria-label={shown ? `卡片：${cardSymbols[value]}` : `翻开第 ${index + 1} 张卡片`} disabled={usedToday || matched.includes(index)}><span className={`symbol ${cardSymbols[value]}`}/><i>?</i></button>; })}</div><button className="playButton secondary" onClick={resetMatch} disabled={usedToday}>{usedToday ? "明天再来" : "重新排列"}</button></div>}{result && <div className="result"><span>{icons.gift}</span><div><small>恭喜你获得</small><strong>{result.name}</strong></div></div>}</section>
    <section className="rules"><h2>简单三步，收获快乐</h2><div><article><b>1</b><span>选择游戏<small>挑一个喜欢的小游戏</small></span></article><article><b>2</b><span>完成挑战<small>转转盘或完成对对碰</small></span></article><article><b>3</b><span>领取惊喜<small>每天都有一次机会</small></span></article></div></section>
    {adminOpen && <div className="modalBackdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setAdminOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-title"><button className="close" onClick={() => setAdminOpen(false)} aria-label="关闭">×</button><div className="modalTitle"><span>{icons.settings}</span><div><h2 id="admin-title">抽奖规则设置</h2><p>配置奖品名称与中奖概率</p></div></div><div className="notice">每日限制：每位访客每天最多参与 1 次</div><div className="prizeEditor">{draft.map((p, i) => <div className="prizeRow" key={p.id}><i style={{ background: p.color }}/><label>奖品 {i + 1}<input value={p.name} onChange={e => setDraft(d => d.map(x => x.id === p.id ? {...x, name:e.target.value} : x))}/></label><label>中奖概率<div className="percent"><input type="number" min="0" max="100" value={p.chance} onChange={e => setDraft(d => d.map(x => x.id === p.id ? {...x, chance:Number(e.target.value)} : x))}/><span>%</span></div></label></div>)}</div><div className="total">概率合计 <b className={draft.reduce((s,p)=>s+p.chance,0) === 100 ? "valid" : "invalid"}>{draft.reduce((s,p)=>s+p.chance,0)}%</b></div><button className="saveButton" onClick={saveRules}>保存规则</button></section></div>}
    <footer><span className="logo mini">{icons.gift}</span><b>星愿乐园</b><p>每一份好运，都值得期待</p></footer>
  </main>;
}
