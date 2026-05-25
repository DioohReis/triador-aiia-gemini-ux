"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Analysis,
  Health,
  User,
  createAnalysis,
  deleteAnalysis,
  extractDocument,
  getHealth,
  getMe,
  listAnalyses,
  loginUser,
  registerUser,
} from "@/lib/api";

type Theme = "dark" | "light";
type AuthMode = "login" | "register";

type IconName = "briefcase" | "file" | "lock" | "spark" | "upload" | "trash" | "logout" | "user" | "office" | "check" | "moon" | "sun";

const STORAGE_TOKEN = "triador_access_token";
const STORAGE_SESSION_TOKEN = "triador_session_token";
const STORAGE_THEME = "triador_theme";

const jobSuggestions = [
  "Desenvolvedor Fullstack Júnior com Next.js, TypeScript, Python/FastAPI, SQL e consumo de APIs.",
  "Analista de IA para RH com experiência em LLM, prompts estruturados, validação de dados e dashboards.",
  "Backend Júnior com Python, banco relacional, testes básicos, Git e integração com serviços externos.",
];

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  const paths: Record<IconName, JSX.Element> = {
    briefcase: <><path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"/><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 12h18M12 12v2"/></>,
    file: <><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h4"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></>,
    spark: <><path d="M12 2l1.7 5.2L19 9l-5.3 1.8L12 16l-1.7-5.2L5 9l5.3-1.8L12 2z"/><path d="M19 15l.9 2.6L22 18.5l-2.1.9L19 22l-.9-2.6-2.1-.9 2.1-.9L19 15z"/></>,
    upload: <><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></>,
    user: <><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></>,
    office: <><path d="M4 21V5.8c0-.9.6-1.7 1.5-1.9l7-1.6c.8-.2 1.5.4 1.5 1.2V21"/><path d="M14 8h4a2 2 0 0 1 2 2v11"/><path d="M7 8h3M7 12h3M7 16h3M17 13h1M17 17h1M3 21h18"/></>,
    check: <><path d="M20 6L9 17l-5-5"/></>,
    moon: <><path d="M21 12.7A8.5 8.5 0 1 1 11.3 3 7 7 0 0 0 21 12.7z"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function readStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_TOKEN) ?? sessionStorage.getItem(STORAGE_SESSION_TOKEN);
}

function storeAuthToken(token: string, remember: boolean) {
  if (remember) {
    localStorage.setItem(STORAGE_TOKEN, token);
    sessionStorage.removeItem(STORAGE_SESSION_TOKEN);
    return;
  }
  sessionStorage.setItem(STORAGE_SESSION_TOKEN, token);
  localStorage.removeItem(STORAGE_TOKEN);
}

function clearStoredToken() {
  localStorage.removeItem(STORAGE_TOKEN);
  sessionStorage.removeItem(STORAGE_SESSION_TOKEN);
}

function scoreLabel(score: number) {
  if (score >= 85) return "Match excelente";
  if (score >= 70) return "Alta aderência";
  if (score >= 55) return "Aderência moderada";
  if (score >= 35) return "Gap relevante";
  return "Baixa aderência";
}

function fitVerdict(score: number) {
  if (score >= 85) return "Priorizar entrevista técnica";
  if (score >= 70) return "Avançar para triagem humana";
  if (score >= 55) return "Avaliar gaps antes de avançar";
  if (score >= 35) return "Manter em banco de talentos";
  return "Não recomendado para esta vaga";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function SmokeLayer() {
  return (
    <div className="smoke-layer" aria-hidden="true">
      <span className="smoke smoke-one" />
      <span className="smoke smoke-two" />
      <span className="smoke smoke-three" />
    </div>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button className="theme-toggle" type="button" onClick={onToggle} aria-label="Alternar tema">
      <Icon name={theme === "dark" ? "sun" : "moon"} />
      {theme === "dark" ? "Modo claro" : "Modo escuro"}
    </button>
  );
}

function ApiStatus({ health }: { health: Health | null }) {
  const ready = health?.status === "ok";
  return (
    <div className={`api-status ${ready ? "online" : "offline"}`}>
      <span />
      <div>
        <strong>{ready ? "Gemini conectado" : "API indisponível"}</strong>
        <small>{ready ? `${health.llm_provider.toUpperCase()} · ${health.database}` : "Verifique Render e NEXT_PUBLIC_API_URL"}</small>
      </div>
    </div>
  );
}

function AuthPanel({ onAuth, health, theme, setTheme }: { onAuth: (token: string, user: User) => void; health: Health | null; theme: Theme; setTheme: (theme: Theme) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && password.length >= 6 && (!isRegister || name.trim().length >= 2) && !loading;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!canSubmit) {
      setError("Preencha os dados corretamente para continuar.");
      return;
    }

    setLoading(true);
    try {
      const response = isRegister
        ? await registerUser(name.trim(), email.trim().toLowerCase(), password)
        : await loginUser(email.trim().toLowerCase(), password);
      storeAuthToken(response.access_token, remember);
      onAuth(response.access_token, response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <SmokeLayer />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Triador AIIA">
          <span><Icon name="briefcase" /></span>
          <div><strong>Triador AIIA</strong><small>Candidate Intelligence</small></div>
        </a>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="#recursos">Recursos</a>
          <a href="#fluxo">Fluxo</a>
          <a href="#seguranca">Segurança</a>
        </nav>
        <ThemeToggle theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />
      </header>

      <section className="hero-section" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><Icon name="spark" /> IA aplicada à triagem de currículos</div>
          <h1>Transforme currículos em decisões claras.</h1>
          <p>Uma plataforma fullstack para analisar currículos com Gemini, validar a resposta no backend e manter cada histórico privado por usuário.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#auth">Começar agora</a>
            <a className="secondary-button" href="#recursos">Ver recursos</a>
          </div>
        </div>

        <aside className="hero-panel glass-card">
          <ApiStatus health={health} />
          <div className="office-illustration" aria-hidden="true">
            <div className="window-card" />
            <div className="monitor-card"><span>AI</span><strong>92%</strong></div>
            <div className="paper-card paper-a" />
            <div className="paper-card paper-b" />
          </div>
        </aside>
      </section>

      <section className="feature-grid" id="recursos">
        <article className="glass-card feature-card"><Icon name="file" /><h2>Upload prático</h2><p>Envie PDF, DOCX ou TXT. O texto é extraído no servidor e enviado para análise.</p></article>
        <article className="glass-card feature-card"><Icon name="lock" /><h2>Dados privados</h2><p>Cada usuário acessa apenas suas próprias análises, histórico e exclusões.</p></article>
        <article className="glass-card feature-card"><Icon name="spark" /><h2>Gemini + contrato</h2><p>A IA responde em JSON estruturado e o backend valida antes de persistir.</p></article>
      </section>

      <section className="auth-grid" id="auth">
        <div className="glass-card auth-card">
          <div className="auth-tabs">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Criar conta</button>
          </div>

          <div className="section-title"><Icon name="user" /><div><h2>{isRegister ? "Crie seu workspace" : "Acesse seu workspace"}</h2><p>{isRegister ? "Seu histórico será isolado dos demais usuários." : "Entre para continuar suas análises."}</p></div></div>

          <form className="form-stack" onSubmit={submit}>
            {isRegister && <label>Nome completo<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" autoComplete="name" /></label>}
            <label>E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="voce@email.com" autoComplete="email" /></label>
            <label>Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Mínimo 6 caracteres" autoComplete={isRegister ? "new-password" : "current-password"} /></label>
            <label className="check-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Manter conectado neste dispositivo</label>
            {error && <div className="alert error">{error}</div>}
            <button className="primary-button full" disabled={!canSubmit}>{loading ? "Validando..." : isRegister ? "Criar conta" : "Entrar"}</button>
          </form>
        </div>

        <div className="glass-card flow-card" id="fluxo">
          <div className="section-title"><Icon name="office" /><div><h2>Fluxo pensado para RH</h2><p>Menos fricção, mais clareza na tomada de decisão.</p></div></div>
          {["Crie sua conta", "Envie currículo", "Cole a vaga", "Receba score e justificativa"].map((item, index) => (
            <div className="flow-step" key={item}><span>{index + 1}</span><strong>{item}</strong></div>
          ))}
        </div>
      </section>

      <section className="security-strip" id="seguranca">
        <Icon name="lock" /> Seu histórico fica separado por login. Uma conta não visualiza currículos enviados por outra conta.
      </section>
    </main>
  );
}

export default function Home() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [health, setHealth] = useState<Health | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [result, setResult] = useState<Analysis | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resumeReady = resumeText.trim().length >= 30;
  const jobReady = jobText.trim().length >= 30;
  const readiness = (health ? 25 : 0) + (resumeReady ? 35 : 0) + (jobReady ? 35 : 0) + (token ? 5 : 0);
  const canSubmit = Boolean(token) && resumeReady && jobReady && !loading && !extracting;
  const averageScore = useMemo(() => history.length ? Math.round(history.reduce((sum, item) => sum + item.fit_score, 0) / history.length) : 0, [history]);
  const activeResult = result ?? history[0] ?? null;

  function setTheme(nextTheme: Theme) {
    setThemeState(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(STORAGE_THEME, nextTheme);
  }

  async function refreshPrivateData(authToken: string) {
    const [status, items] = await Promise.all([getHealth(), listAnalyses(authToken)]);
    setHealth(status);
    setHistory(items);
    setResult(items[0] ?? null);
  }

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_THEME) as Theme | null;
    const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(storedTheme ?? preferred);

    getHealth().then(setHealth).catch(() => setHealth(null));

    const storedToken = readStoredToken();
    if (!storedToken) return;
    setToken(storedToken);
    getMe(storedToken)
      .then((me) => {
        setUser(me);
        return refreshPrivateData(storedToken);
      })
      .catch(() => {
        clearStoredToken();
        setToken(null);
        setUser(null);
      });
  }, []);

  async function onAuth(authToken: string, authUser: User) {
    setToken(authToken);
    setUser(authUser);
    await refreshPrivateData(authToken);
  }

  function logout() {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setHistory([]);
    setResult(null);
    setResumeText("");
    setJobText("");
    setFileInfo("");
  }

  async function handleFile(file?: File) {
    if (!file || !token) return;
    const extensionAllowed = /\.(pdf|docx|txt)$/i.test(file.name);
    const mimeAllowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"].includes(file.type);
    if (!extensionAllowed && !mimeAllowed) {
      setError("Formato não suportado. Envie PDF, DOCX ou TXT.");
      return;
    }

    setError("");
    setExtracting(true);
    setFileInfo(`Lendo ${file.name} · ${formatFileSize(file.size)}`);
    try {
      const extracted = await extractDocument(file, token);
      setResumeText(extracted.text);
      setFileInfo(`${extracted.filename} · ${extracted.characters.toLocaleString("pt-BR")} caracteres extraídos`);
    } catch (err) {
      setFileInfo("");
      setError(err instanceof Error ? err.message : "Erro ao extrair texto do arquivo.");
    } finally {
      setExtracting(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const analysis = await createAnalysis(resumeText.trim(), jobText.trim(), token);
      setResult(analysis);
      setHistory((current) => [analysis, ...current.filter((item) => item.id !== analysis.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar currículo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, candidateName: string) {
    if (!token) return;
    if (!window.confirm(`Excluir a análise de ${candidateName}?`)) return;
    setDeletingId(id);
    setError("");
    try {
      await deleteAnalysis(id, token);
      setHistory((current) => current.filter((item) => item.id !== id));
      if (result?.id === id) setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!token || !user) {
    return <AuthPanel onAuth={onAuth} health={health} theme={theme} setTheme={setTheme} />;
  }

  return (
    <main className="dashboard-page">
      <SmokeLayer />
      <header className="site-header dashboard-header">
        <a className="brand" href="#top" aria-label="Triador AIIA">
          <span><Icon name="briefcase" /></span>
          <div><strong>Triador AIIA</strong><small>{user.name}</small></div>
        </a>
        <nav className="desktop-nav" aria-label="Navegação do workspace"><a href="#nova-analise">Nova análise</a><a href="#historico">Histórico</a></nav>
        <div className="header-actions"><ThemeToggle theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} /><button className="ghost-button" type="button" onClick={logout}><Icon name="logout" />Sair</button></div>
      </header>

      <section className="dashboard-hero glass-card">
        <div>
          <div className="eyebrow"><Icon name="lock" /> Workspace privado</div>
          <h1>Seu banco de currículos, separado por login.</h1>
          <p>Faça upload do currículo, cole a vaga e gere uma análise estruturada com Gemini. Cada usuário visualiza somente seus próprios registros.</p>
        </div>
        <aside className="readiness-card">
          <ApiStatus health={health} />
          <strong>{readiness}%</strong>
          <div className="meter"><span style={{ width: `${readiness}%` }} /></div>
          <small>Prontidão da análise</small>
        </aside>
      </section>

      <section className="metrics-grid">
        <article className="metric-card"><Icon name="file" /><span>Análises</span><strong>{history.length}</strong><small>somente sua conta</small></article>
        <article className="metric-card"><Icon name="spark" /><span>Média</span><strong>{averageScore}/100</strong><small>aderência histórica</small></article>
        <article className="metric-card"><Icon name="office" /><span>Provider</span><strong>{health?.llm_provider?.toUpperCase() ?? "--"}</strong><small>{health?.database ?? "sqlite"}</small></article>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="workbench-grid" id="nova-analise">
        <form className="glass-card analysis-card" onSubmit={onSubmit}>
          <div className="section-title"><Icon name="upload" /><div><h2>Nova análise</h2><p>Envie currículo e cole a vaga alvo.</p></div></div>

          <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}>
            <Icon name="file" />
            <strong>{extracting ? "Extraindo texto..." : "Enviar currículo"}</strong>
            <span>{fileInfo || "Arraste ou selecione PDF, DOCX ou TXT"}</span>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={onFileChange} hidden />
          </div>

          <label className="field-block">Texto do currículo<textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} rows={8} placeholder="O texto extraído aparecerá aqui." /><small>{wordCount(resumeText)} palavras</small></label>
          <label className="field-block">Descrição da vaga<textarea value={jobText} onChange={(event) => setJobText(event.target.value)} rows={8} placeholder="Cole a descrição da vaga aqui." /><small>{wordCount(jobText)} palavras</small></label>

          <div className="suggestion-board"><strong>Sugestões para testar</strong>{jobSuggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setJobText(suggestion)}>{suggestion}</button>)}</div>
          <button className="primary-button full" disabled={!canSubmit}>{loading ? "Analisando com Gemini..." : "Gerar análise"}</button>
        </form>

        <aside className="glass-card result-card">
          <div className="section-title"><Icon name="spark" /><div><h2>Resultado</h2><p>Score, decisão e justificativa.</p></div></div>
          {loading ? <div className="empty-state">Gemini está avaliando aderência, habilidades e experiência...</div> : activeResult ? (
            <div className="result-content">
              <div className="score-ring"><strong>{activeResult.fit_score}</strong><span>/100</span></div>
              <h3>{activeResult.candidate_name}</h3>
              <p className="verdict">{fitVerdict(activeResult.fit_score)} · {scoreLabel(activeResult.fit_score)}</p>
              <p>{activeResult.summary}</p>
              <div className="skill-cloud">{activeResult.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
            </div>
          ) : <div className="empty-state">O resultado aparecerá aqui após a primeira análise.</div>}
        </aside>
      </section>

      <section className="glass-card history-section" id="historico">
        <div className="section-title"><Icon name="file" /><div><h2>Histórico privado</h2><p>Registros vinculados ao seu usuário.</p></div></div>
        {history.length ? <div className="history-list">{history.map((item) => (
          <article className="history-item" key={item.id}>
            <button className="history-main" type="button" onClick={() => setResult(item)}><strong>{item.candidate_name}</strong><span>{item.fit_score}/100 · {formatDate(item.created_at)}</span><small>{item.summary}</small></button>
            <button className="danger-button" type="button" disabled={deletingId === item.id} onClick={() => handleDelete(item.id, item.candidate_name)}><Icon name="trash" />{deletingId === item.id ? "Excluindo" : "Excluir"}</button>
          </article>
        ))}</div> : <div className="empty-state">Nenhuma análise criada nesta conta ainda.</div>}
      </section>
    </main>
  );
}
