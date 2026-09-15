"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { ArrowUpRight, ArrowRight, ArrowLeft, Check, ChevronRight, Copy, Download, FileText, Layers3, Lightbulb, LoaderCircle, MessageSquareText, Plus, RotateCcw, ShieldCheck, Sparkles, Sprout, Target, Trash2, WandSparkles, X } from "lucide-react";
import { emptyAnswers, emptySetup, presetSetup, setupSchema, setupTools, setupStatuses, type SetupAnswers, fields, generateSchema, getQuestions, PRESET_IDEA, presetAnswers, questionListSchema, savedSchema, STORAGE_KEY, synthesizeBrief, type Answers, type Mode, type Question, type SavedBrief } from "@/lib/brief";

type Stage = "landing" | "survey" | "result";
const stageNames = ["아이디어 꺼내기", "생각 구체화하기", "브리프 완성하기"];
const topics = ["나만의 서비스", "반복 업무 자동화", "사이드 프로젝트"];

async function requestApi(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(32000) });
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

export default function BriefForge() {
  const [stage, setStage] = useState<Stage>("landing");
  const [idea, setIdea] = useState("");
  const [preset, setPreset] = useState(false);
  const [answers, setAnswers] = useState<Answers>({ ...emptyAnswers });
  const [setup, setSetup] = useState<SetupAnswers>({ ...emptySetup });
  const [questions, setQuestions] = useState<Question[]>(getQuestions());
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [questionMode, setQuestionMode] = useState<Mode>("offline");
  const [brief, setBrief] = useState<SavedBrief | null>(null);
  const [saved, setSaved] = useState<SavedBrief | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const privacyRef = useRef<HTMLDialogElement>(null);
  const actionLock = useRef(false);

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(data => setApiReady(data.mode === "ai")).catch(() => {});
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const result = savedSchema.safeParse(JSON.parse(data));
        if (result.success) setSaved(result.data);
        else setNotice("이전 저장 형식을 읽을 수 없어 새로 시작합니다.");
      }
    } catch { setNotice("브라우저 저장소를 사용할 수 없습니다. 결과를 다운로드해 보관해 주세요."); }
  }, []);
  useEffect(() => { if (stage !== "landing") headingRef.current?.focus(); }, [stage, step]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2200); return () => clearTimeout(timer); }, [copied]);

  useEffect(() => {
    if (privacy) privacyRef.current?.showModal();
    else privacyRef.current?.close();
  }, [privacy]);

  const stageIndex = stage === "landing" ? 0 : stage === "survey" ? 1 : 2;
  const isSetup = step === questions.length;
  const current = questions[step] ?? questions[questions.length - 1];
  const totalSteps = questions.length + 1;
  const setupComplete = setupSchema.safeParse(setup).success;
  const completed = fields.filter(id => answers[id].trim()).length;

  async function start(usePreset = false) {
    if (actionLock.current) return;
    const value = usePreset ? PRESET_IDEA : idea.trim();
    if (value.length < 3) { setError("만들고 싶은 것을 3자 이상 적어주세요."); return; }
    actionLock.current = true; setBusy(true); setError(""); setNotice("");
    setIdea(value); setPreset(usePreset); setSetup(usePreset ? { ...presetSetup } : { ...emptySetup }); setAnswers(usePreset ? { ...presetAnswers } : { ...emptyAnswers });
    let nextQuestions = getQuestions(usePreset);
    let mode: Mode = "offline";
    if (apiReady && !localOnly) {
      try {
        const data = await requestApi("/api/questions", { idea: value, preset: usePreset, localOnly });
        nextQuestions = questionListSchema.parse(data.questions);
        mode = data.mode === "ai" ? "ai" : "offline";
        if (data.fallback) setNotice("AI 연결이 원활하지 않아 기본 질문으로 이어갑니다.");
      } catch { setNotice("연결 없이도 괜찮아요. 기본 질문으로 이어갑니다."); }
    }
    setQuestions(nextQuestions); setQuestionMode(mode); setStep(0); setStage("survey"); setBusy(false); actionLock.current = false;
  }

  async function generate() {
    if (actionLock.current) return;
    const parsed = generateSchema.safeParse({ idea, preset, answers, setup, localOnly });
    if (!parsed.success) { setError("모든 답변과 준비물 상태를 선택해 주세요."); return; }
    actionLock.current = true; setBusy(true); setError(""); setNotice("");
    let markdown = synthesizeBrief(parsed.data);
    let mode: Mode = "offline";
    if (apiReady && !localOnly) {
      try {
        const data = await requestApi("/api/generate", parsed.data);
        if (typeof data.markdown !== "string" || data.markdown.length < 100 || data.markdown.length > 60000) throw new Error("Invalid brief");
        markdown = data.markdown; mode = data.mode === "ai" ? "ai" : "offline";
        if (data.fallback) setNotice("AI 연결이 원활하지 않아 입력하신 답변으로 기본 브리프를 완성했어요.");
      } catch { setNotice("네트워크 연결 대신 로컬 생성기로 브리프를 완성했어요."); }
    }
    const result: SavedBrief = { version: 2, idea, preset, setup: parsed.data.setup, answers: { ...answers }, markdown, mode, savedAt: new Date().toISOString() };
    setBrief(result); setRaw(false); setCopied(false);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)); setSaved(result); }
    catch { setNotice("브리프는 완성했지만 브라우저에 저장하지 못했어요. 다운로드해 보관해 주세요."); }
    setStage("result"); setBusy(false); actionLock.current = false;
  }

  function restore() {
    if (!saved) return;
    setBrief(saved); setIdea(saved.idea); setPreset(saved.preset); setAnswers(saved.answers); setSetup(saved.setup);
    setQuestions(getQuestions(saved.preset)); setNotice(""); setError(""); setStage("result"); setRaw(false);
  }
  function reset() {
    setStage("landing"); setSetup({ ...emptySetup }); setIdea(""); setPreset(false); setAnswers({ ...emptyAnswers }); setError(""); setNotice(""); setBrief(null);
  }
  async function copy() {
    if (!brief) return;
    try { await navigator.clipboard.writeText(brief.markdown); setCopied(true); }
    catch { setRaw(true); setNotice("복사 권한이 없어요. 원문을 선택해 복사하거나 .md 파일을 다운로드해 주세요."); }
  }
  function download() {
    if (!brief) return;
    const url = URL.createObjectURL(new Blob([brief.markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = preset ? "briefforge-contest-scout.md" : "briefforge-master-prompt.md";
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function removeSaved() {
    try { localStorage.removeItem(STORAGE_KEY); setSaved(null); setNotice("브라우저에 저장된 최근 브리프를 삭제했어요."); }
    catch { setNotice("브라우저 저장소에 접근할 수 없어 삭제하지 못했어요."); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={reset} disabled={busy} aria-label="BriefForge 홈"><span className="brand-mark"><Layers3 size={21} /></span>BriefForge<span className="beta">BETA</span></button>
      <div className="workspace-label">YOUR IDEA WORKSPACE</div>
      <button className="new-brief" onClick={reset} disabled={busy}><Plus size={17} />새 브리프 만들기</button>
      <nav aria-label="브리프 생성 단계" className="step-nav">
        {stageNames.map((name, i) => <div key={name} className={`nav-step ${stageIndex === i ? "active" : ""} ${stageIndex > i ? "done" : ""}`} aria-current={stageIndex === i ? "step" : undefined}><span className="step-number">{stageIndex > i ? <Check size={13} /> : `0${i + 1}`}</span>{name}{stageIndex === i && <span className="active-dot" />}</div>)}
      </nav>
      <div className="sidebar-rule" />
      <div className="recent-label">최근 작업 <span>LOCAL</span></div>
      {saved ? <div className="saved-row"><button onClick={restore} disabled={busy}><FileText size={17} /><span>{saved.preset ? "공모전·해커톤 스카우트" : saved.idea}</span></button><button className="icon-button" aria-label="저장된 브리프 삭제" onClick={removeSaved}><Trash2 size={14} /></button></div> : <p className="empty-recent">완성한 브리프가 여기에 담겨요.</p>}
      <div className="sidebar-bottom"><div className="little-note"><Sprout size={21} /><p>좋은 시작에 필요한 건,<br /><strong>완벽한 아이디어가 아니에요.</strong></p></div><button className="privacy-link" onClick={() => setPrivacy(true)}><ShieldCheck size={14} />개인정보 안내<ArrowUpRight size={13} /></button><div className="sidebar-credit">MADE FOR YOUR NEXT BIG THING</div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">워크스페이스<ChevronRight size={13} /><span>{stageNames[stageIndex]}</span></div><span className="mode-badge"><span />{apiReady && !localOnly ? "AI 연결 모드" : "로컬 모드 · 키 없이 사용"}</span></header>
      <main id="main-content">
        {notice && <div className="notice" role="status">{notice}<button className="icon-button" aria-label="알림 닫기" onClick={() => setNotice("")}><X size={15} /></button></div>}
        {stage === "landing" && <div className="landing fade-in">
          {saved && <div className="mobile-saved"><button className="text-button" onClick={restore} disabled={busy}><FileText size={15} />최근 브리프 열기</button><button className="icon-button" aria-label="최근 브리프 삭제" onClick={removeSaved}><Trash2 size={15} /></button></div>}
          <section className="hero"><div className="eyebrow"><span className="mini-line" />FROM A THOUGHT TO A THING</div><h1>막연한 아이디어를,<br /><span>명확한 시작으로.</span><span className="hero-spark">✳</span></h1><p>무엇을 만들고 싶은지만 알려주세요.<br />좋은 질문을 거쳐, AI가 바로 실행할 수 있는 브리프로 바꿔드릴게요.</p></section>
          <div className="landing-grid"><section className="idea-card"><div className="card-heading"><span className="small-icon"><Lightbulb size={19} /></span><h2>어떤 걸 만들고 싶으세요?</h2><span className="small-tag">STEP 01</span></div><form onSubmit={e => { e.preventDefault(); void start(); }}><label className="sr-only" htmlFor="idea">만들고 싶은 앱이나 서비스</label><textarea id="idea" className="idea-input" placeholder={"예: 나한테 맞는 공모전이나 해커톤을 알아서\n찾아주는 서비스가 있으면 좋겠어."} value={idea} onChange={e => { setIdea(e.target.value); setError(""); }} maxLength={2000} disabled={busy} aria-describedby="idea-help" /><div className="input-meta"><span id="idea-help">잘 정리하지 않아도 괜찮아요. 떠오르는 대로 적어주세요.</span><span>{idea.length.toLocaleString()} / 2,000</span></div><div className="topic-chips">{topics.map(topic => <button type="button" key={topic} onClick={() => setIdea(topic === "반복 업무 자동화" ? "매일 반복하는 업무를 자동으로 정리해주는 도구를 만들고 싶어요." : topic === "사이드 프로젝트" ? "사이드 프로젝트의 아이디어와 할 일을 관리하는 앱을 만들고 싶어요." : "나만의 취향을 기록하고 추천받는 서비스를 만들고 싶어요.")} disabled={busy}><Plus size={12} />{topic}</button>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="primary-button start-button" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} />질문을 준비하고 있어요</> : <>내 아이디어 구체화하기<ArrowRight size={18} /></>}</button></form><div className="card-foot"><span><MessageSquareText size={13} />{fields.length}개 질문 + 준비물 체크</span><span>약 5분</span><span>가입 없이 시작</span></div></section>
          <aside className="preview-card"><div className="preview-top"><span>YOUR NEXT STEP</span><ArrowUpRight size={17} /></div><div className="paper-stack"><div className="paper-back" /><div className="preview-paper"><span className="paper-label"><FileText size={14} />MASTER BRIEF</span><strong>아이디어에<br />실행할 힘을 더해요.</strong><div className="paper-line long" /><div className="paper-line" /><div className="paper-check"><Check size={12} />목적과 사용자</div><div className="paper-check"><Check size={12} />기능·디자인·준비물</div><div className="paper-check"><Check size={12} />구현 계획과 완료 기준</div><div className="paper-bottom"><span>READY TO BUILD</span><Sparkles size={15} /></div></div><div className="floating-spark"><WandSparkles size={23} /></div></div><p>생각은 가볍게.<br /><strong>결과는 바로 쓸 수 있게.</strong></p><div className="agent-tags"><span>Claude</span><span>Codex</span><span>Markdown</span></div></aside></div>
          <section className="preset-section"><div className="section-title"><h2>빈 화면이 막막하다면</h2><span>이 아이디어로 먼저 경험해 보세요</span></div><button className="preset-card" onClick={() => void start(true)} disabled={busy}><span className="preset-icon"><Target size={25} /></span><span className="preset-copy"><span className="preset-title">공모전 스카우트 프롬프트 만들기<span className="demo-tag">DEMO</span></span><span className="preset-description">내 조건에 맞는 공모전·해커톤을 찾아주는 나만의 에이전트</span><span className="preset-tags">한국 오프라인 우선<span>·</span>AI·창업<span>·</span>적합도 A/B<span>·</span>JSON 저장</span></span><ArrowRight size={21} className="preset-arrow" /></button></section>
          <div className="how-it-works">{[{ icon: MessageSquareText, title: "짧게 대화하고", text: "질문에 내 생각을 담으면" }, { icon: WandSparkles, title: "선명하게 정리하고", text: "목적부터 완료 기준까지" }, { icon: FileText, title: "바로 만들기 시작해요", text: "복사해서 코딩 에이전트에게" }].map((item, i) => <div key={item.title}><item.icon size={19} /><span><strong>{item.title}</strong><small>{item.text}</small></span><span className="how-number">0{i + 1}</span></div>)}</div>
          <section className="build-guide" aria-label="개발 접근법"><div><span className="guide-icon"><Sprout size={20} /></span><h2>작게 만들고, 직접 써보고, 하나씩 개선해요.</h2></div><p>아이디어 <span>→</span> 브리프 <span>→</span> Codex/Claude <span>→</span> GitHub <span>→</span> Vercel</p><ol><li><strong>핵심 기능 하나부터</strong>브리프를 코딩 도구에 전달하고 샘플 데이터로 실행해요.</li><li><strong>직접 확인하며 수정</strong>결과와 디자인을 확인한 뒤 필요한 외부 기능을 연결해요.</li><li><strong>저장하고 공유</strong>GitHub에 코드를 보관하고 웹 앱은 선택적으로 Vercel에 배포해요.</li></ol></section><label className="local-toggle"><input type="checkbox" checked={localOnly} onChange={e => setLocalOnly(e.target.checked)} disabled={busy} />항상 로컬에서 생성하기 <span>선택하면 아이디어와 답변을 서버에 보내지 않아요.</span></label>
        </div>}

        {stage === "survey" && <div className="survey-page fade-in"><div className="eyebrow"><span className="mini-line" />LET’S MAKE IT CLEAR</div><h1 className="page-title" ref={headingRef} tabIndex={-1}>좋은 시작은, 좋은 질문에서.</h1><p className="page-description">정답은 없어요. 선택지를 누르거나, 내 말로 편하게 적어주세요.</p><div className="survey-layout"><section className="survey-card"><div className="survey-top"><span className="small-tag">QUESTION {String(step + 1).padStart(2, "0")}</span><span>{step + 1} <span className="muted">/ {totalSteps}</span></span></div><div className="progress-track" role="progressbar" aria-label="설문 진행" aria-valuemin={0} aria-valuemax={totalSteps} aria-valuenow={step + 1}><div style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div>{isSetup ? <><h2>개발 시작 전 준비물을 확인해요</h2><p className="question-hint">가입을 모두 마칠 필요는 없어요. 각 도구의 현재 상태를 골라주세요. Codex 또는 Claude 중 하나부터 시작해도 됩니다.</p><div className="question-why"><strong>왜 이 질문을 하나요?</strong><p>준비 상태를 알면 코딩 에이전트가 바로 가능한 구현과 나중에 연결할 기능을 구분하고, 필요한 계정·샘플 데이터·배포 순서를 브리프에 적을 수 있어요.</p></div>{preset && <p className="preset-tip">데모 준비 상태입니다. 실제 계정 확인 결과가 아니니 내 상황에 맞게 바꿔주세요.</p>}<div className="setup-list">{setupTools.map(tool => <fieldset key={tool.id} className="setup-item"><legend>{tool.name}</legend><p>{tool.purpose}</p><div className="setup-chips">{setupStatuses.map(status => <label key={status} className={setup[tool.id] === status ? "selected" : ""}><input type="radio" name={tool.id} value={status} checked={setup[tool.id] === status} disabled={busy} onChange={() => { setSetup(prev => ({ ...prev, [tool.id]: status })); setError(""); }} />{status}</label>)}</div></fieldset>)}</div><p className="question-hint" role="status">{setupTools.filter(tool => setup[tool.id]).length} / {setupTools.length}개 확인 · 비밀번호나 API 키는 입력하지 않아요.</p></> : <><h2>{current.title}</h2><p className="question-hint">{current.hint}</p><div className="question-why"><strong>왜 이 질문을 하나요?</strong><p>{current.why}</p></div>{preset && <p className="preset-tip"><Sparkles size={14} />데모 답변을 채워두었어요. 내 상황에 맞게 수정해도 좋아요.</p>}<div className="answer-options">{current.options.map(option => <button key={option} disabled={busy} aria-pressed={answers[current.id].includes(option)} className={answers[current.id].includes(option) ? "selected" : ""} onClick={() => setAnswers(prev => ({ ...prev, [current.id]: prev[current.id].includes(option) ? prev[current.id] : `${prev[current.id]}${prev[current.id] ? "\n" : ""}${option}`.slice(0, 2000) }))}><Plus size={14} />{option}</button>)}</div><label className="answer-label" htmlFor="answer">나의 답변 <span>자유롭게 수정할 수 있어요</span></label><textarea id="answer" key={current.id} value={answers[current.id]} onChange={e => { setAnswers(prev => ({ ...prev, [current.id]: e.target.value })); setError(""); }} placeholder={current.placeholder} maxLength={2000} disabled={busy} /><div className="answer-count">{answers[current.id].length} / 2,000</div></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="survey-actions"><button className="secondary-button" disabled={busy} onClick={() => { setError(""); if (step === 0) setStage("landing"); else setStep(step - 1); }}><ArrowLeft size={16} />이전</button><button className="primary-button" disabled={busy || (isSetup ? !setupComplete : !answers[current.id].trim())} onClick={() => { setError(""); if (isSetup) void generate(); else setStep(step + 1); }}>{busy ? <><LoaderCircle className="spin" size={17} />브리프를 만들고 있어요</> : isSetup ? <>마스터 브리프 생성<Sparkles size={17} /></> : <>다음 질문<ArrowRight size={17} /></>}</button></div></section><aside className="context-card"><span className="eyebrow">MY IDEA</span><h3>{preset ? "공모전·해커톤 스카우트" : "내가 만들고 싶은 것"}</h3><p>{idea}</p><div className="context-divider" /><span className="context-label">브리프에 담을 재료 <strong>{completed + (setupComplete ? 1 : 0)}/{totalSteps}</strong></span><div className="question-index">{questions.map((q, i) => <button key={q.id} onClick={() => setStep(i)} disabled={busy} className={i === step ? "current" : ""}><span className={answers[q.id].trim() ? "answered" : ""}>{answers[q.id].trim() ? <Check size={11} /> : i + 1}</span>{["사용자", "목표", "핵심 기능", "제약 조건", "톤과 경험", "색감과 분위기", "화면 배치", "참고 디자인", "구현 형태", "성공 기준"][i]}</button>)}<button onClick={() => setStep(questions.length)} disabled={busy} className={isSetup ? "current" : ""}><span className={setupComplete ? "answered" : ""}>{setupComplete ? <Check size={11} /> : totalSteps}</span>개발 준비물</button></div><p className="context-note"><ShieldCheck size={14} />{questionMode === "ai" ? "아이디어에 맞춘 AI 질문" : "검증된 기본 질문으로 진행 중"}</p></aside></div><p className="privacy-inline">{apiReady && !localOnly ? "생성 시 아이디어와 답변을 OpenAI로 전송합니다. 민감정보는 입력하지 마세요." : "질문과 브리프 생성이 브라우저에서 이루어집니다. 외부 AI로 전송하지 않아요."}</p></div>}

        {stage === "result" && brief && <div className="result-page fade-in"><div className="result-heading"><div><div className="eyebrow"><Check size={15} />READY TO BUILD</div><h1 className="page-title" ref={headingRef} tabIndex={-1}>이제, 만들 준비가 됐어요.</h1><p className="page-description">브리프를 복사해 Codex나 Claude에 붙여넣어 보세요.</p></div><span className="result-seal"><FileText size={28} /></span></div><div className="result-meta"><span><span className="green-dot" />{brief.mode === "ai" ? "AI 맞춤 설계 포함" : "로컬 템플릿으로 생성"}</span><span>{fields.length}개 답변 + 준비물 반영</span><span>{brief.markdown.length.toLocaleString()}자</span></div><section className="build-guide" aria-label="개발 접근법"><div><span className="guide-icon"><Sprout size={20} /></span><h2>작게 만들고, 직접 써보고, 하나씩 개선해요.</h2></div><p>아이디어 <span>→</span> 브리프 <span>→</span> Codex/Claude <span>→</span> GitHub <span>→</span> Vercel</p><ol><li><strong>핵심 기능 하나부터</strong>브리프를 코딩 도구에 전달하고 샘플 데이터로 실행해요.</li><li><strong>직접 확인하며 수정</strong>결과와 디자인을 확인한 뒤 필요한 외부 기능을 연결해요.</li><li><strong>저장하고 공유</strong>GitHub에 코드를 보관하고 웹 앱은 선택적으로 Vercel에 배포해요.</li></ol></section><div className="result-toolbar"><div className="view-tabs" role="group" aria-label="브리프 보기 방식"><button onClick={() => setRaw(false)} className={!raw ? "active" : ""} aria-pressed={!raw}>미리보기</button><button onClick={() => setRaw(true)} className={raw ? "active" : ""} aria-pressed={raw}>Markdown</button></div><div className="export-actions"><button className="secondary-button" onClick={download}><Download size={16} />.md 다운로드</button><button className="primary-button" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "복사 완료!" : "브리프 복사"}</button></div></div><article className="document">{raw ? <textarea className="raw-brief" readOnly value={brief.markdown} aria-label="마스터 브리프 Markdown 원문" onFocus={e => e.target.select()} /> : <div className="markdown"><Markdown>{brief.markdown}</Markdown></div>}</article><div className="result-bottom"><button className="text-button" onClick={() => { setStep(0); setStage("survey"); setError(""); }}><RotateCcw size={15} />답변 수정하기</button><span>최근 브리프 1개만 이 브라우저에 저장돼요.</span><button className="text-button" onClick={reset}>새 아이디어 시작<ArrowRight size={15} /></button></div></div>}
      </main>
      <footer className="footer"><span>BriefForge <span className="footer-dot">·</span> 생각을 실행의 언어로 <button className="footer-privacy" onClick={() => setPrivacy(true)}>개인정보 안내</button></span><span>WANTED AI CHAMPIONSHIP 2026</span></footer>
    </div>
    <dialog ref={privacyRef} className="privacy-modal" aria-labelledby="privacy-title" onClose={() => setPrivacy(false)}><button autoFocus className="icon-button modal-close" aria-label="개인정보 안내 닫기" onClick={() => setPrivacy(false)}><X size={20} /></button><ShieldCheck size={28} /><h2 id="privacy-title">아이디어는 소중하니까요.</h2><p>로그인과 데이터베이스 없이 사용합니다. 최근 완성한 브리프와 답변 1개는 이 브라우저의 localStorage에 저장되며, 왼쪽 최근 작업의 휴지통으로 삭제할 수 있어요.</p><p>로컬 모드에서는 아이디어와 답변을 서버나 외부 AI로 보내지 않습니다. AI 연결 모드에서는 질문·생성을 위해 서버를 거쳐 OpenAI로 전송하며, API 요청은 store: false로 설정합니다. OpenAI의 별도 데이터 처리 정책은 적용될 수 있어요.</p><p>앱은 입력 내용을 서버 로그나 DB에 기록하지 않습니다. 호스팅 서비스는 접속 메타데이터를 기록할 수 있어요. 비밀번호나 민감한 개인정보는 입력하지 마세요.</p><button className="primary-button" onClick={() => setPrivacy(false)}>확인했어요<Check size={16} /></button></dialog>
  </div>;
}
