import { useState, useRef, useEffect, useCallback } from "react";

function getPriceContext() {
  const now = new Date();
  const toKST = (d) => new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const toEST = (d) => new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const kst = toKST(now);
  const est = toEST(now);
  const kstDay = kst.getDay();
  const kstMin = kst.getHours() * 60 + kst.getMinutes();
  const kstWeekday = kstDay >= 1 && kstDay <= 5;
  let krPriceRule = "";
  if (!kstWeekday) krPriceRule = "한국 증시 휴장일(주말). 직전 거래일 종가 기준.";
  else if (kstMin < 540) krPriceRule = "한국 증시 개장 전. 직전 거래일 종가 기준.";
  else if (kstMin < 930) krPriceRule = "한국 증시 장중(개장 중). 시가(당일 시작가) 기준으로 분석.";
  else krPriceRule = "한국 증시 장마감 후(15:30 이후). 당일 종가 기준으로 분석.";
  const estDay = est.getDay();
  const estMin = est.getHours() * 60 + est.getMinutes();
  const estWeekday = estDay >= 1 && estDay <= 5;
  let usPriceRule = "";
  if (!estWeekday) usPriceRule = "미국 증시 휴장일(주말). 직전 거래일 종가 기준.";
  else if (estMin < 570) usPriceRule = "미국 증시 개장 전. 직전 거래일 종가 기준.";
  else if (estMin < 960) usPriceRule = "미국 증시 장중(본장 진행 중). 당일 시가(opening price) 기준으로 분석.";
  else usPriceRule = "미국 증시 장마감 후(16:00 ET 이후). 당일 종가(closing price) 기준으로 분석.";
  return {
    krPriceRule, usPriceRule,
    kstStr: kst.toLocaleString("ko-KR", { hour12: false }),
    estStr: est.toLocaleString("en-US", { hour12: false }),
  };
}

function buildSystemPrompt() {
  const { krPriceRule, usPriceRule, kstStr, estStr } = getPriceContext();
  return `당신은 월스트리트 투자은행 출신의 시니어 재무 분석가입니다.

■ 현재 시각 및 주가 기준 (반드시 준수)
현재 한국 시각: ${kstStr} (KST)
현재 미국 시각: ${estStr} (ET)
한국 주식(KRX/KOSPI/KOSDAQ): → ${krPriceRule}
미국 주식(NYSE/NASDAQ): → ${usPriceRule}
반드시 위 규칙에 따라 적합한 현재가를 웹 검색으로 확인 후 분석에 사용하세요.

■ 핵심 작동 방식
사용자가 기업명 또는 티커만 입력하면 즉시 분석을 실행합니다. 질문 없이 바로 분석 결과를 출력하세요.
분석 출발점은 "현 주가가 암시하는 시장 기대치(Expectations) 해부"입니다.
Forward DCF 이전에 반드시 Reverse DCF를 선행합니다.

■ 할루시네이션 방어 규칙 (최우선)
▸ 데이터 태깅 필수
• [실제] → 웹 검색 확인 공시 데이터 (출처 명시)
• [추정] → 실제 데이터 기반 산출 (근거 명시)
• [가정] → 분석용 설정값 (변경 가능)
출처 없는 숫자에 [실제] 태그 금지.
▸ 숫자 지어내기 금지
매출/이익/부채/주가는 반드시 웹 검색 확인 후 사용.

■ 자동 판단 로직
기업명/티커 단독 입력 → 상장사: Narrative + Reverse DCF + DCF + Comps + 민감도 + So What
비상장 스타트업 → 운영모델 + 유닛이코노믹스 + DCF
지주사/대기업 → SOTP + 부문별 Comps

■ 딜 레이더 (Deal Radar) — 모든 분석에 자동 적용
웹 검색으로 반드시 탐색:
1. Pending M&A / 2. 관계사/모회사/자회사 딜 / 3. 경쟁사 딜
4. 규제/반독점 이슈 / 5. 주주행동주의/분사 압력 / 6. 대주주 지분 변동
출력:
🔍 딜 레이더
• [딜 제목] — [루머/공식발표/규제심사중], 밸류에이션 임팩트

■ 출력 규칙
[금기사항] 1. 행/열 테이블 절대 사용 금지 2. 마크다운 사용 금지

▸ 최상단: 핵심 인사이트 10 Key Points
🎯 [기업명] 분석 핵심 인사이트 10 Key Points
① [최종 판단] — 종합 결론 한 줄
② [Narrative 정의]
③ [Reverse DCF 인사이트]
④ [Narrative 현실성 검증]
⑤ [DCF 인사이트]
⑥ [Comps 인사이트]
⑦ [가장 중요한 변수]
⑧ [시장이 놓치고 있는 것]
⑨ [최대 리스크 + 딜 레이더]
⑩ [업사이드 촉매 + 액션 아이템]

▸ So What 블록
💡 So What — 투자 판단 요약
■ 확률 가중 적정가
Bull [X]% × [값] = [가중값]
Base [X]% × [값] = [가중값]
Bear [X]% × [값] = [가중값]
→ 확률가중 적정가: [합계]/주
→ 현 주가 대비: [X]% 업사이드 or 다운사이드
■ 한 줄 판단
■ 이벤트별 주가 영향

▸ 역산 검증 필수
현 주가 정당화 조건: 필요 매출 CAGR, EBIT 마진, 재투자율 명시.

▸ 신뢰도 체크리스트
📋 신뢰도 체크리스트
• 실제 데이터 출처 • 추정/가정 비율 • 불확실 가정 Top 3 • 한계 1~2문장

한국어 + 재무용어 영문 병기. Bull/Base/Bear 필수. 단위 명시.`;
}

const SUGGESTIONS = [
  { label: "엔비디아", sub: "NVDA" }, { label: "삼성전자", sub: "005930" },
  { label: "테슬라", sub: "TSLA" }, { label: "카카오", sub: "035720" },
  { label: "애플", sub: "AAPL" }, { label: "네이버", sub: "035420" },
  { label: "메타", sub: "META" }, { label: "SK하이닉스", sub: "000660" },
];

export default function App() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState([]);
  const [activeIdx, setActiveIdx] = useState(null);
  const [streaming, setStreaming] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [priceCtx, setPriceCtx] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setPriceCtx(getPriceContext());
    const t = setInterval(() => setPriceCtx(getPriceContext()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streaming, statusMsg]);

  const analyze = useCallback(async (company) => {
    if (!company.trim() || loading) return;
    const q = company.trim();
    setQuery("");
    setLoading(true);
    setPhase("searching");
    setStatusMsg("웹 검색 중 — 실시간 데이터 수집...");
    setStreaming("");
    setActiveIdx(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: buildSystemPrompt(),
          stream: true,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `${q} 분석해줘` }],
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let buf = "";
      let searchCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const evt = JSON.parse(jsonStr);

            // 웹 검색 시작 감지
            if (evt.type === "content_block_start") {
              if (evt.content_block?.type === "tool_use" &&
                  evt.content_block?.name === "web_search") {
                searchCount++;
                setStatusMsg(`웹 검색 중 (${searchCount}회)... 데이터 수집 중`);
                setPhase("searching");
              }
              if (evt.content_block?.type === "text") {
                setPhase("analyzing");
                setStatusMsg("AI 분석 생성 중 — IB 모델 계산...");
              }
            }

            // 텍스트 스트리밍
            if (evt.type === "content_block_delta") {
              if (evt.delta?.type === "text_delta" && evt.delta?.text) {
                full += evt.delta.text;
                setStreaming(full);
              }
            }

            // 에러 처리
            if (evt.type === "error") {
              throw new Error(evt.error?.message || "API 오류");
            }

          } catch (parseErr) {
            // JSON 파싱 실패는 무시 (불완전한 청크)
          }
        }
      }

      if (!full) {
        full = "⚠️ 분석 결과를 받지 못했습니다. API 키를 확인하거나 다시 시도해주세요.";
      }

      setHistory(prev => [{ query: q, result: full, ts: new Date() }, ...prev]);
      setActiveIdx(0);
      setStreaming("");
      setPhase("done");
      setStatusMsg("");
    } catch (err) {
      const errMsg = `⚠️ 오류: ${err.message}\n\nAPI 키가 올바르게 설정되었는지 확인해주세요.\nVercel Dashboard → Settings → Environment Variables → ANTHROPIC_API_KEY`;
      setHistory(prev => [{ query: q, result: errMsg, ts: new Date() }, ...prev]);
      setActiveIdx(0);
      setPhase("idle");
      setStatusMsg("");
    }
    setLoading(false);
  }, [loading]);

  const currentResult = activeIdx !== null ? history[activeIdx]?.result : null;
  const displayText = streaming || currentResult || "";
  const showWelcome = !loading && !displayText;
  const formatTime = (d) => d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4F8", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=JetBrains+Mono:wght@300;400;500;600&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes dotBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .chip-btn { transition: all 0.15s; cursor: pointer; border: 1.5px solid #E2E8F0; background: #fff; }
        .chip-btn:hover { background: #1E3A5F; border-color: #1E3A5F; color: #fff !important; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(30,58,95,0.2); }
        .sidebar-item { transition: background 0.15s; cursor: pointer; }
        .sidebar-item:hover { background: #EFF6FF !important; }
        .send-btn { transition: all 0.15s; cursor: pointer; border: none; }
        .send-btn:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.04); }
        .input-row:focus-within .input-inner { border-color: #2563EB !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important; }
        input::placeholder { color: #94A3B8; } input:focus { outline: none; }
        .new-btn { transition: all 0.15s; cursor: pointer; }
        .new-btn:hover { background: #1E3A5F !important; color: #fff !important; border-color: #1E3A5F !important; }
      `}</style>

      {/* NAV */}
      <nav style={{ background: "#1E3A5F", borderBottom: "1px solid #162E4D", padding: "0 24px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxShadow: "0 2px 12px rgba(15,23,42,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">{[0,5,10].map((y,i) => <rect key={i} x="0" y={y} width={i===1?12:16} height="2" rx="1" fill="currentColor"/>)}</svg>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>📊</div>
            <div>
              <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "16px", fontWeight: 700, color: "#F8FAFC" }}>IB Analyst</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>WALL STREET GRADE · AI</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {priceCtx && [
            { flag: "🇰🇷", label: "KRX", rule: priceCtx.krPriceRule },
            { flag: "🇺🇸", label: "NYSE", rule: priceCtx.usPriceRule }
          ].map(({ flag, label, rule }) => {
            const isOpen = rule.includes("장중") || rule.includes("진행");
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px", background: isOpen ? "rgba(5,150,105,0.15)" : "rgba(255,255,255,0.07)", border: `1px solid ${isOpen ? "rgba(5,150,105,0.3)" : "rgba(255,255,255,0.12)"}`, borderRadius: "20px", padding: "4px 10px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: isOpen ? "#10B981" : "#94A3B8", animation: isOpen ? "pulse 2s ease infinite" : "none" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: isOpen ? "#6EE7B7" : "#94A3B8", fontWeight: 500 }}>{flag} {label} {isOpen ? "OPEN" : "CLOSED"}</span>
              </div>
            );
          })}
          {loading && (
            <div style={{ display: "flex", gap: "4px", alignItems: "center", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "20px", padding: "4px 12px" }}>
              {[0,1,2].map(i => <div key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#93C5FD", animation: `dotBounce 1s ease infinite`, animationDelay: `${i*0.15}s` }} />)}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#93C5FD", marginLeft: "4px" }}>
                {phase === "searching" ? "SEARCHING" : "ANALYZING"}
              </span>
            </div>
          )}
        </div>
      </nav>

      {/* BODY */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "calc(100vh - 56px)" }}>

        {/* SIDEBAR */}
        <aside style={{ width: sidebarOpen ? "240px" : "0", minWidth: sidebarOpen ? "240px" : "0", background: "#F7F9FC", borderRight: "1.5px solid #E2E8F0", overflow: "hidden", transition: "width 0.25s ease, min-width 0.25s ease", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #E2E8F0" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#94A3B8", letterSpacing: "0.1em" }}>ANALYSIS HISTORY</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {history.length === 0 ? (
              <div style={{ padding: "20px 8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#CBD5E1", lineHeight: 1.7 }}>분석 결과가<br/>여기 저장됩니다</div>
            ) : history.map((h, i) => (
              <div key={i} className="sidebar-item" onClick={() => { setActiveIdx(i); setStreaming(""); }}
                style={{ padding: "10px 12px", borderRadius: "10px", marginBottom: "4px", background: activeIdx === i ? "#EFF6FF" : "transparent", border: `1.5px solid ${activeIdx === i ? "#BFDBFE" : "transparent"}` }}>
                <div style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: "13px", fontWeight: 600, color: "#1E3A5F" }}>{h.query}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#94A3B8", marginTop: "3px" }}>{formatTime(h.ts)}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Input bar */}
          <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1.5px solid #E2E8F0", flexShrink: 0, boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
            <div className="input-row" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div className="input-inner" style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px", background: "#F7F9FC", border: "1.5px solid #E2E8F0", borderRadius: "14px", padding: "10px 16px", transition: "border-color 0.2s, box-shadow 0.2s" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#94A3B8" strokeWidth="2"/><path d="M21 21L16 16" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/></svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && analyze(query)}
                  placeholder="기업명 또는 티커 입력 (예: 삼성전자 / NVDA / 005930)"
                  disabled={loading}
                  style={{ flex: 1, background: "transparent", border: "none", fontFamily: "'Noto Sans KR', sans-serif", fontSize: "14px", fontWeight: 500, color: "#0F172A" }}
                />
                {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "18px" }}>×</button>}
              </div>
              <button className="send-btn" onClick={() => analyze(query)} disabled={loading || !query.trim()}
                style={{ height: "46px", padding: "0 20px", background: query.trim() && !loading ? "linear-gradient(135deg, #1E3A5F, #2563EB)" : "#E2E8F0", borderRadius: "12px", color: query.trim() && !loading ? "#fff" : "#94A3B8", fontFamily: "'Noto Sans KR', sans-serif", fontSize: "13px", fontWeight: 600, boxShadow: query.trim() && !loading ? "0 4px 14px rgba(37,99,235,0.3)" : "none", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", gap: "7px", whiteSpace: "nowrap" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                분석 시작
              </button>
              {(currentResult || streaming) && !loading && (
                <button className="new-btn" onClick={() => { setActiveIdx(null); setStreaming(""); setQuery(""); }}
                  style={{ height: "46px", padding: "0 16px", background: "transparent", border: "1.5px solid #E2E8F0", borderRadius: "12px", fontFamily: "'Noto Sans KR', sans-serif", fontSize: "13px", color: "#64748B", whiteSpace: "nowrap" }}>
                  새 분석
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginTop: "12px" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#94A3B8", alignSelf: "center", marginRight: "2px" }}>빠른 시작:</span>
              {SUGGESTIONS.map(s => (
                <button key={s.label} className="chip-btn" onClick={() => analyze(s.label)}
                  style={{ borderRadius: "20px", padding: "5px 12px", fontFamily: "'Noto Sans KR', sans-serif", fontSize: "12px", fontWeight: 500, color: "#334155", display: "flex", alignItems: "center", gap: "5px" }}>
                  {s.label}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#94A3B8" }}>{s.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Result area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

            {/* Welcome */}
            {showWelcome && (
              <div style={{ maxWidth: "760px", margin: "0 auto", animation: "fadeUp 0.5s ease" }}>
                <div style={{ background: "linear-gradient(135deg, #1E3A5F 0%, #2D5185 60%, #2563EB 100%)", borderRadius: "20px", padding: "36px 40px", marginBottom: "24px", position: "relative", overflow: "hidden", boxShadow: "0 16px 40px rgba(30,58,95,0.25)" }}>
                  <div style={{ position: "absolute", top: -40, right: -40, width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
                  <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "26px", fontWeight: 700, color: "#fff", marginBottom: "10px", lineHeight: 1.3 }}>월스트리트 IB급<br/>AI 주식 분석 시스템</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: 2 }}>Reverse DCF · Narrative Analysis · Deal Radar<br/>Trading Comps · So What · Bull / Base / Bear</div>
                  {priceCtx && (
                    <div style={{ marginTop: "20px", display: "inline-flex", gap: "16px", flexWrap: "wrap", background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "10px 16px" }}>
                      {[{ flag: "🇰🇷", rule: priceCtx.krPriceRule }, { flag: "🇺🇸", rule: priceCtx.usPriceRule }].map(({ flag, rule }) => (
                        <div key={flag} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{flag} {rule}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                  {[["🔍","딜 레이더","M&A·IPO·규제 현황 실시간 탐색"],["⚡","Reverse DCF","현 주가 내재 기대치 역산"],["🎯","So What 블록","확률가중 적정가 + 시나리오"],["📋","데이터 투명성","[실제]/[추정]/[가정] 3단계 태깅"]].map(([icon,title,desc]) => (
                    <div key={title} style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "14px", padding: "16px", display: "flex", gap: "12px" }}>
                      <div style={{ width: "38px", height: "38px", background: "#EFF6FF", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{icon}</div>
                      <div>
                        <div style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: "13px", fontWeight: 700, color: "#1E3A5F" }}>{title}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#64748B", marginTop: "4px", lineHeight: 1.6 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: "12px", padding: "14px 18px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: "#92400E", lineHeight: 1.8 }}>
                  ⚠️ 본 분석은 AI가 공개 정보를 기반으로 생성한 참고 자료이며, 투자 권유가 아닙니다.<br/>실제 투자 결정 시 공인 재무 전문가와 상담하세요.
                </div>
              </div>
            )}

            {/* Loading — 웹 검색 중 상태 표시 */}
            {loading && !streaming && (
              <div style={{ maxWidth: "760px", margin: "0 auto", animation: "fadeUp 0.3s ease" }}>
                <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "16px", padding: "28px", boxShadow: "0 2px 12px rgba(15,23,42,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", gap: "5px" }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: phase === "searching" ? "#F59E0B" : "#2563EB", animation: `dotBounce 1s ease infinite`, animationDelay: `${i*0.15}s` }} />)}
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: phase === "searching" ? "#D97706" : "#2563EB" }}>
                      {statusMsg}
                    </span>
                  </div>
                  {[90,70,85,55,75,65,80].map((w,i) => (
                    <div key={i} style={{ height: "10px", width: `${w}%`, borderRadius: "5px", marginBottom: "10px", background: "linear-gradient(90deg, #EEF2F7 25%, #E2E8F0 50%, #EEF2F7 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.5s infinite linear", animationDelay: `${i*0.08}s` }} />
                  ))}
                  <div style={{ marginTop: "16px", padding: "10px 14px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "8px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#92400E" }}>
                    💡 웹 검색으로 실시간 데이터를 수집 후 분석합니다. 약 1~2분 소요됩니다.
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {displayText && (
              <div style={{ maxWidth: "760px", margin: "0 auto" }}>
                <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 20px rgba(15,23,42,0.08)", animation: "fadeUp 0.35s ease" }}>
                  <div style={{ background: "linear-gradient(135deg, #1E3A5F, #2D5185)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                        📊 {loading ? query || "분석 중..." : (activeIdx !== null ? history[activeIdx]?.query : "")}
                      </div>
                      {streaming && <div style={{ display: "flex", gap: "3px" }}>{[0,1,2].map(i => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#93C5FD", animation: `dotBounce 1s ease infinite`, animationDelay: `${i*0.15}s` }} />)}</div>}
                    </div>
                    {activeIdx !== null && !streaming && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>{formatTime(history[activeIdx]?.ts)}</span>
                    )}
                  </div>
                  <div style={{ padding: "24px 28px" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#334155", lineHeight: "1.9" }}>
                      {displayText.split("\n").map((line, i) => {
                        const t = line.trim();
                        if (/^[🎯💡📋🔍]/.test(t)) return <div key={i} style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "15px", fontWeight: 700, color: "#1E3A5F", padding: "14px 0 6px", borderBottom: "1.5px solid #E2E8F0", marginBottom: "8px" }}>{t}</div>;
                        if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(t)) return <div key={i} style={{ background: "#F8FAFF", border: "1px solid #DBEAFE", borderLeft: "3px solid #2563EB", borderRadius: "0 10px 10px 0", padding: "9px 14px", margin: "6px 0", fontFamily: "'Noto Sans KR', sans-serif", fontSize: "12.5px", lineHeight: 1.7, color: "#1E3A5F" }}>{t}</div>;
                        if (/^■/.test(t)) return <div key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", fontWeight: 600, color: "#B45309", padding: "10px 0 2px" }}>{t}</div>;
                        if (/^Bull/.test(t)) return <div key={i} style={{ color: "#059669", padding: "2px 0", fontWeight: 600 }}>{t}</div>;
                        if (/^Bear/.test(t)) return <div key={i} style={{ color: "#DC2626", padding: "2px 0", fontWeight: 600 }}>{t}</div>;
                        if (/^Base/.test(t)) return <div key={i} style={{ color: "#2563EB", padding: "2px 0", fontWeight: 600 }}>{t}</div>;
                        if (/^→/.test(t)) return <div key={i} style={{ color: "#1E3A5F", fontWeight: 700, padding: "4px 0 2px", borderTop: "1px dashed #E2E8F0", marginTop: "4px" }}>{t}</div>;
                        if (/^[▸•]/.test(t)) return <div key={i} style={{ display: "flex", gap: "8px", padding: "2px 0 2px 4px" }}><span style={{ color: "#2563EB", flexShrink: 0 }}>›</span><span style={{ lineHeight: 1.8 }}>{t.slice(1).trim()}</span></div>;
                        if (t === "") return <div key={i} style={{ height: "6px" }} />;
                        return <div key={i} style={{ lineHeight: 1.85, padding: "1px 0" }}>{line}</div>;
                      })}
                      {streaming && <span style={{ display: "inline-block", width: "2px", height: "14px", background: "#2563EB", marginLeft: "2px", verticalAlign: "middle", animation: "blink 1s step-end infinite" }} />}
                    </div>
                    <div ref={bottomRef} />
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
