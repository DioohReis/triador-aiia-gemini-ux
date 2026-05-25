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

const STORAGE_TOKEN = "triador_access_token";
const STORAGE_THEME = "triador_theme";

const suggestionSlots = [
  "Cole aqui uma vaga de Desenvolvedor Fullstack Júnior com requisitos técnicos claros.",
  "Use descrições reais de LinkedIn, Gupy ou documento interno da empresa.",
  "Prefira vagas com tecnologias, senioridade, responsabilidades e diferenciais.",
];

function Icon({ name }: { name: "office" | "file" | "lock" | "spark" | "briefcase" | "trash" | "upload" | "logout" }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const paths: Record<typeof name, JSX.Element> = {
    office: <><path d="M4 21V5.8c0-.9.6-1.7 1.5-1.9l7-1.6c.8-.2 1.5.4 1.5 1.2V21"/><path d="M14 8h4a2 2 0 0 1 2 2v11"/><path d="M7 8h3M7 12h3M7 16h3M17 13h1M17 17h1M3 21h18"/></>,
    file: <><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h4"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></>,
    spark: <><path d="M12 2l1.7 5.2L19 9l-5.3 1.8L12 16l-1.7-5.2L5 9l5.3-1.8L12 2z"/><path d="M19 15l.9 2.6L22 18.5l-2.1.9L19 22l-.9-2.6-2.1-.9 2.1-.9L19 15z"/></>,
    briefcase: <><path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"/><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 12h18M12 12v2"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
    upload: <><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
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
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function normalizeProvider(value?: string) {
  return value ? value.toUpperCase() : "--";
}

function SmokeLayer() {
  return (
    <div className="smoke-stage" aria-hidden="true">
      <span className="smoke smoke-a" />
      <span className="smoke smoke-b" />
      <span className="smoke smoke-c" />
    </div>
  );
}

function AuthPanel({ onAuth, theme, setTheme }: { onAuth: (token: string, user: User) => void; theme: Theme; setTheme: (theme: Theme) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = mode === "register" ? await registerUser(name, email, password) : await loginUser(email, password);
      localStorage.setItem(STORAGE_TOKEN, response.access_token);
      onAuth(response.access_token, response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <SmokeLayer />
      <section className="auth-hero glass-panel">
        <nav className="topbar">
          <div className="brand-mark"><span>ai</span><strong>Triador AIIA</strong></div>
          <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>
        </nav>
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><Icon name="office" /> Candidate intelligence</span>
            <h1>Triagem de currículos com uma experiência de produto real.</h1>
            <p>
              Envie currículos, compare com a vaga e mantenha cada histórico protegido por usuário. Uma camada de IA para transformar seleção técnica em decisão clara.
            </p>
            <div className="hero-actions">
              <a href="#auth-card" className="primary-link">Start</a>
              <span className="microcopy"><Icon name="lock" /> dados isolados por conta</span>
            </div>
          </div>
          <div className="office-card">
            <div className="desk-scene">
              <div className="desk-window" />
              <div className="desk-lamp" />
              <div className="desk-monitor"><span>AI fit score</span><strong>87%</strong></div>
              <div className="desk-doc doc-one" />
              <div className="desk-doc doc-two" />
              <div className="desk-cup" />
            </div>
          </div>
        </div>
      </section>

      <section className="auth-card glass-panel" id="auth-card">
        <div className="auth-tabs" role="tablist">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Criar conta</button>
        </div>
        <div className="auth-title">
          <Icon name="lock" />
          <div>
            <h2>{mode === "login" ? "Acesse seu workspace" : "Crie seu workspace"}</h2>
            <p>Cada usuário visualiza apenas os próprios currículos e análises.</p>
          </div>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>Nome
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" minLength={2} required />
            </label>
          )}
          <label>E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" type="email" required />
          </label>
          <label>Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" type="password" minLength={6} required />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="primary-button" disabled={loading} type="submit">{loading ? "Processando..." : mode === "login" ? "Entrar no Triador" : "Criar conta e começar"}</button>
        </form>
      </section>
    </main>
  );
}

export default function Home() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [history, setHistory] = useState<Analysis[]>([]);
  const [result, setResult] = useState<Analysis | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resumeReady = resumeText.trim().length >= 30;
  const jobReady = jobText.trim().length >= 30;
  const canSubmit = Boolean(token) && resumeReady && jobReady && !loading && !extracting;
  const provider = normalizeProvider(health?.llm_provider);
  const readiness = (resumeReady ? 35 : 0) + (jobReady ? 35 : 0) + (health ? 30 : 0);
  const averageScore = history.length ? Math.round(history.reduce((sum, item) => sum + item.fit_score, 0) / history.length) : 0;
  const activeResult = result ?? history[0] ?? null;

  function setTheme(nextTheme: Theme) {
    setThemeState(nextTheme);
    localStorage.setItem(STORAGE_THEME, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  async function loadPrivateData(authToken: string) {
    const [status, items] = await Promise.all([getHealth(), listAnalyses(authToken)]);
    setHealth(status);
    setHistory(items);
  }

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_THEME) as Theme | null;
    const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(storedTheme ?? preferred);

    const storedToken = localStorage.getItem(STORAGE_TOKEN);
    if (!storedToken) return;

    setToken(storedToken);
    getMe(storedToken)
      .then((me) => {
        setUser(me);
        return loadPrivateData(storedToken);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_TOKEN);
        setToken(null);
        setUser(null);
      });
  }, []);

  async function onAuth(authToken: string, authUser: User) {
    setToken(authToken);
    setUser(authUser);
    await loadPrivateData(authToken);
  }

  function logout() {
    localStorage.removeItem(STORAGE_TOKEN);
    setToken(null);
    setUser(null);
    setHistory([]);
    setResult(null);
    setResumeText("");
    setJobText("");
  }

  async function handleFile(file?: File) {
    if (!file || !token) return;
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    const hasAllowedExtension = /\.(pdf|docx|txt)$/i.test(file.name);

    if (!allowed.includes(file.type) && !hasAllowedExtension) {
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
    const confirmed = window.confirm(`Excluir a análise de ${candidateName}?`);
    if (!confirmed) return;
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
    return <AuthPanel onAuth={onAuth} theme={theme} setTheme={setTheme} />;
  }

  return (
    <main className="app-shell">
      <SmokeLayer />
      <header className="workspace-header glass-panel">
        <div className="brand-mark"><span>ai</span><strong>Triador AIIA</strong></div>
        <div className="user-zone">
          <div className="user-chip"><Icon name="lock" /> {user.name}</div>
          <button className="ghost-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">{theme === "dark" ? "Modo claro" : "Modo escuro"}</button>
          <button className="icon-button" onClick={logout} type="button" title="Sair"><Icon name="logout" /></button>
        </div>
      </header>

      <section className="dashboard-hero glass-panel">
        <div className="hero-copy">
          <span className="eyebrow"><Icon name="briefcase" /> Workspace privado</span>
          <h1>Compare candidatos com precisão, contexto e histórico isolado.</h1>
          <p>Seu banco de currículos é independente dos demais usuários. Envie um arquivo, cole a vaga e receba uma análise estruturada com Gemini e validação backend.</p>
        </div>
        <div className="readiness-card">
          <span>Prontidão</span>
          <strong>{readiness}%</strong>
          <div className="meter"><span style={{ width: `${readiness}%` }} /></div>
          <small>{provider} · {health?.database ?? "sqlite"}</small>
        </div>
      </section>

      <section className="metrics-grid">
        <div className="metric-card"><Icon name="file" /><span>Análises no banco</span><strong>{history.length}</strong><small>visíveis somente para sua conta</small></div>
        <div className="metric-card"><Icon name="spark" /><span>Média de aderência</span><strong>{averageScore}/100</strong><small>baseada no seu histórico</small></div>
        <div className="metric-card"><Icon name="office" /><span>Entrada aceita</span><strong>PDF · DOCX · TXT</strong><small>extração server-side</small></div>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="workbench-grid">
        <form className="analysis-panel glass-panel" onSubmit={onSubmit}>
          <div className="section-heading">
            <span><Icon name="upload" /></span>
            <div><h2>Nova análise</h2><p>Envie currículo e informe a vaga alvo.</p></div>
          </div>

          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <Icon name="file" />
            <strong>{extracting ? "Extraindo currículo..." : "Enviar currículo"}</strong>
            <span>{fileInfo || "Arraste ou selecione PDF, DOCX ou TXT"}</span>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={onFileChange} hidden />
          </div>

          <label className="field-block">Texto extraído do currículo
            <textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="O texto do currículo aparecerá aqui após o upload." rows={8} />
            <small>{wordCount(resumeText)} palavras</small>
          </label>

          <label className="field-block">Descrição da vaga
            <textarea value={jobText} onChange={(event) => setJobText(event.target.value)} placeholder="Cole a descrição da vaga aqui." rows={8} />
            <small>{wordCount(jobText)} palavras</small>
          </label>

          <div className="suggestion-board">
            <strong>Sugestões de uso</strong>
            {suggestionSlots.map((suggestion) => <span key={suggestion}>{suggestion}</span>)}
          </div>

          <button className="primary-button" disabled={!canSubmit} type="submit">{loading ? "Analisando com IA..." : "Gerar análise"}</button>
        </form>

        <aside className="result-panel glass-panel">
          <div className="section-heading"><span><Icon name="spark" /></span><div><h2>Resultado executivo</h2><p>Score, decisão sugerida e justificativa.</p></div></div>
          {loading ? <div className="loading-card">A IA está validando aderência, skills e experiência...</div> : activeResult ? (
            <div className="result-card">
              <div className="score-ring"><strong>{activeResult.fit_score}</strong><span>/100</span></div>
              <h3>{activeResult.candidate_name}</h3>
              <p className="verdict">{fitVerdict(activeResult.fit_score)} · {scoreLabel(activeResult.fit_score)}</p>
              <p>{activeResult.summary}</p>
              <div className="skill-cloud">{activeResult.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
            </div>
          ) : <div className="empty-state">Nenhuma análise gerada ainda.</div>}
        </aside>
      </section>

      <section className="history-section glass-panel">
        <div className="section-heading"><span><Icon name="briefcase" /></span><div><h2>Histórico privado</h2><p>Somente análises criadas pela sua conta aparecem aqui.</p></div></div>
        <div className="history-list">
          {history.length ? history.map((item) => (
            <article className="history-item" key={item.id}>
              <button className="history-main" type="button" onClick={() => setResult(item)}>
                <strong>{item.candidate_name}</strong>
                <span>{item.fit_score}/100 · {formatDate(item.created_at)}</span>
              </button>
              <button className="danger-button" onClick={() => handleDelete(item.id, item.candidate_name)} disabled={deletingId === item.id} type="button">
                <Icon name="trash" /> {deletingId === item.id ? "Excluindo" : "Excluir"}
              </button>
            </article>
          )) : <div className="empty-state">Seu histórico ainda está vazio.</div>}
        </div>
      </section>
    </main>
  );
}
