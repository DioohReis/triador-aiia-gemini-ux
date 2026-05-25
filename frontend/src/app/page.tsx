"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Analysis, Health, createAnalysis, deleteAnalysis, extractDocument, getHealth, listAnalyses } from "@/lib/api";

const sampleResume = `Nome: Ana Ribeiro
Desenvolvedora Fullstack Júnior com 2 anos de experiência em Python, FastAPI, React, TypeScript, SQL, SQLite, Postgres, Git e integração com APIs REST. Atuou em sistemas internos, modelagem de dados relacionais, consumo de serviços de IA e criação de interfaces com foco em usabilidade.`;

const sampleJob = `Vaga: Desenvolvedor(a) Fullstack Júnior
Requisitos: Python ou Go no backend, Next.js com TypeScript no frontend, banco relacional, integração com LLM via API, validação de saída estruturada, uso de SQL, Git, arquitetura em camadas e boa comunicação técnica.`;

type StepStatus = "done" | "active" | "pending";
type ThemeMode = "light" | "dark";

function scoreLabel(score: number) {
  if (score >= 85) return "Match excelente";
  if (score >= 70) return "Alta aderência";
  if (score >= 55) return "Aderência moderada";
  if (score >= 35) return "Gap relevante";
  return "Baixa aderência";
}

function scoreTone(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "strong";
  if (score >= 55) return "medium";
  if (score >= 35) return "watch";
  return "low";
}

function fitVerdict(score: number) {
  if (score >= 85) return "Priorizar entrevista técnica";
  if (score >= 70) return "Avançar para triagem humana";
  if (score >= 55) return "Avaliar gaps antes de avançar";
  if (score >= 35) return "Manter em banco de talentos";
  return "Não recomendado para esta vaga";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

function normalizeProvider(value?: string) {
  if (!value) return "--";
  return value.toUpperCase();
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function Stepper({ resumeReady, jobReady, resultReady }: { resumeReady: boolean; jobReady: boolean; resultReady: boolean }) {
  const steps: Array<{ label: string; detail: string; status: StepStatus }> = [
    { label: "Currículo", detail: resumeReady ? "Texto pronto" : "Envie PDF/DOCX/TXT", status: resumeReady ? "done" : "active" },
    { label: "Vaga", detail: jobReady ? "Descrição pronta" : "Cole os requisitos", status: resumeReady ? (jobReady ? "done" : "active") : "pending" },
    { label: "Análise", detail: resultReady ? "Score gerado" : "Gemini + validação", status: resultReady ? "done" : resumeReady && jobReady ? "active" : "pending" },
  ];

  return (
    <div className="stepper" aria-label="Progresso da análise">
      {steps.map((step, index) => (
        <div className={`step ${step.status}`} key={step.label}>
          <span className="step-index">{index + 1}</span>
          <div>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="skeleton-stack" aria-label="Análise em processamento">
      <div className="skeleton-row">
        <span className="skeleton-avatar" />
        <div>
          <span className="skeleton-line wide" />
          <span className="skeleton-line small" />
        </div>
      </div>
      <span className="skeleton-line full" />
      <span className="skeleton-line full" />
      <span className="skeleton-line half" />
    </div>
  );
}

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [history, setHistory] = useState<Analysis[]>([]);
  const [result, setResult] = useState<Analysis | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resumeReady = resumeText.trim().length >= 30;
  const jobReady = jobText.trim().length >= 30;
  const canSubmit = resumeReady && jobReady && !loading && !extracting;
  const provider = normalizeProvider(health?.llm_provider);
  const activeHistory = history.find((item) => item.id === activeHistoryId) ?? history[0] ?? null;

  const readiness = useMemo(() => {
    let value = 0;
    if (resumeReady) value += 40;
    if (jobReady) value += 40;
    if (health) value += 20;
    return value;
  }, [resumeReady, jobReady, health]);

  const averageScore = useMemo(() => {
    if (!history.length) return 0;
    return Math.round(history.reduce((sum, item) => sum + item.fit_score, 0) / history.length);
  }, [history]);

  const topSkills = useMemo(() => {
    const count = new Map<string, number>();
    history.forEach((item) => item.skills.forEach((skill) => count.set(skill, (count.get(skill) ?? 0) + 1)));
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([skill]) => skill);
  }, [history]);

  async function boot() {
    setInitialLoading(true);
    setError("");
    try {
      const [status, items] = await Promise.all([getHealth(), listAnalyses()]);
      setHealth(status);
      setHistory(items);
      setActiveHistoryId((current) => current ?? items[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a aplicação.");
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("triador-theme") as ThemeMode | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(savedTheme ?? (prefersDark ? "dark" : "light"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("triador-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function handleFile(file?: File) {
    if (!file) return;
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    const hasAllowedExtension = /\.(pdf|docx|txt)$/i.test(file.name);

    if (!allowed.includes(file.type) && !hasAllowedExtension) {
      setError("Formato não suportado. Envie PDF, DOCX ou TXT. Arquivos .doc antigos não entram neste fluxo.");
      return;
    }

    setError("");
    setExtracting(true);
    setFileInfo(`Lendo ${file.name} · ${formatFileSize(file.size)}`);

    try {
      const extracted = await extractDocument(file);
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
    setError("");
    setLoading(true);
    try {
      const analysis = await createAnalysis(resumeText.trim(), jobText.trim());
      setResult(analysis);
      setActiveHistoryId(analysis.id);
      setHistory((current) => [analysis, ...current.filter((item) => item.id !== analysis.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar currículo.");
    } finally {
      setLoading(false);
    }
  }


  async function handleDeleteAnalysis(id: number, candidateName: string) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a análise de ${candidateName}? Essa ação remove o registro do histórico.`
    );

    if (!confirmed) return;

    setError("");
    setDeletingId(id);

    try {
      await deleteAnalysis(id);

      setHistory((current) => {
        const updated = current.filter((item) => item.id !== id);

        if (activeHistoryId === id) {
          setActiveHistoryId(updated[0]?.id ?? null);
        }

        return updated;
      });

      if (result?.id === id) {
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a análise.");
    } finally {
      setDeletingId(null);
    }
  }

  function fillSample() {
    setResumeText(sampleResume);
    setJobText(sampleJob);
    setFileInfo("Exemplo carregado para demonstração");
    setError("");
  }

  function clearForm() {
    setResumeText("");
    setJobText("");
    setResult(null);
    setFileInfo("");
    setError("");
  }

  return (
    <main className="app-shell">
      <section className="hero-grid">
        <div className="hero-card hero-copy">
          <div className="hero-topbar">
            <div className="brand-row">
              <span className="brand-mark">ai</span>
              <span>Triador AIIA · Candidate Intelligence</span>
            </div>

            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
              aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              <span className="theme-toggle-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
              <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
            </button>
          </div>
          <h1>Uma central inteligente para transformar currículos em decisões de triagem.</h1>
          <p>
            Faça upload do currículo, cole a vaga e gere uma avaliação estruturada com score, skills, experiência,
            resumo executivo e histórico persistido. Visual pensado para parecer produto real, não apenas teste técnico.
          </p>
          <div className="hero-actions">
            <button className="primary large" type="button" onClick={() => fileInputRef.current?.click()}>
              Enviar currículo
            </button>
            <button className="secondary large" type="button" onClick={fillSample}>
              Rodar demo guiada
            </button>
          </div>
        </div>

        <aside className="hero-card command-panel">
          <div className="panel-topline">
            <span className={`pulse ${health ? "online" : "offline"}`} />
            <div>
              <strong>{health ? "Sistema operacional" : initialLoading ? "Sincronizando API" : "API indisponível"}</strong>
              <small>{health ? `${provider} · ${health.database}` : "localhost:8000"}</small>
            </div>
          </div>
          <div className="readiness" style={{ "--readiness": readiness } as CSSProperties}>
            <div>
              <span>Prontidão</span>
              <strong>{readiness}%</strong>
            </div>
          </div>
          <Stepper resumeReady={resumeReady} jobReady={jobReady} resultReady={Boolean(result)} />
        </aside>
      </section>

      <section className="kpi-grid" aria-label="Indicadores principais">
        <article>
          <span>Análises no banco</span>
          <strong>{history.length}</strong>
          <small>histórico consultável</small>
        </article>
        <article>
          <span>Média de aderência</span>
          <strong>{averageScore}/100</strong>
          <small>baseada no histórico</small>
        </article>
        <article>
          <span>Provider ativo</span>
          <strong>{provider}</strong>
          <small>configurado no backend</small>
        </article>
        <article>
          <span>Entrada aceita</span>
          <strong>PDF · DOCX · TXT</strong>
          <small>extração server-side</small>
        </article>
      </section>

      {health?.llm_provider === "mock" && (
        <div className="notice warning">
          O backend está em modo mock. Para usar Gemini real, ajuste <code>LLM_PROVIDER=gemini</code> e <code>GEMINI_API_KEY</code> no <code>backend/.env</code>.
        </div>
      )}
      {health?.llm_provider === "gemini" && (
        <div className="notice success">Gemini conectado. A chave fica somente no backend, protegida fora do navegador.</div>
      )}
      {error && <div className="notice danger">{error}</div>}

      <section className="workspace-grid">
        <form className="glass-card form-card" onSubmit={onSubmit}>
          <div className="card-title-row">
            <div>
              <span className="eyebrow">Entrada de dados</span>
              <h2>Currículo + descrição da vaga</h2>
              <p>Revise o texto extraído antes de acionar o modelo. Isso demonstra controle humano sobre a IA.</p>
            </div>
            <button className="icon-button" type="button" onClick={boot} title="Atualizar status e histórico">
              ↻
            </button>
          </div>

          <div
            className={`dropzone ${dragging ? "dragging" : ""} ${extracting ? "loading" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={onFileChange}
              hidden
            />
            <div className="drop-icon">↑</div>
            <div>
              <strong>{extracting ? "Extraindo texto do currículo..." : "Arraste ou selecione o currículo"}</strong>
              <span>PDF, DOCX ou TXT. O texto é extraído no backend e aparece para conferência.</span>
            </div>
            <button className="secondary compact" type="button">Selecionar arquivo</button>
          </div>

          {fileInfo && <div className="file-pill">✓ {fileInfo}</div>}

          <div className="editor-grid">
            <label className="field-card">
              <div className="field-header">
                <strong>Currículo extraído</strong>
                <span>{wordCount(resumeText)} palavras</span>
              </div>
              <textarea
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="Faça upload de um currículo ou cole o texto manualmente."
              />
            </label>
            <label className="field-card">
              <div className="field-header">
                <strong>Vaga alvo</strong>
                <span>{wordCount(jobText)} palavras</span>
              </div>
              <textarea
                value={jobText}
                onChange={(event) => setJobText(event.target.value)}
                placeholder="Cole a descrição da vaga, requisitos técnicos, senioridade e diferenciais."
              />
            </label>
          </div>

          <div className="sticky-action-bar">
            <div className="micro-hint">
              <strong>{canSubmit ? "Tudo pronto para analisar" : "Complete currículo e vaga"}</strong>
              <span>{resumeReady ? "Currículo ok" : "Currículo precisa de mais texto"} · {jobReady ? "Vaga ok" : "Vaga precisa de mais contexto"}</span>
            </div>
            <div className="action-cluster">
              <button className="ghost" type="button" onClick={clearForm}>Limpar</button>
              <button className="primary" type="submit" disabled={!canSubmit}>
                {loading ? "Analisando..." : "Analisar aderência"}
              </button>
            </div>
          </div>
        </form>

        <aside className="side-stack">
          <section className="glass-card result-card">
            <div className="card-title-row compact-row">
              <div>
                <span className="eyebrow">Resultado executivo</span>
                <h2>Decisão sugerida</h2>
              </div>
            </div>

            {loading && <ResultSkeleton />}

            {!loading && !result && (
              <div className="empty-state">
                <span>◇</span>
                <strong>Nenhuma análise nesta sessão</strong>
                <p>Envie um currículo e uma vaga para visualizar score, skills e justificativa aqui.</p>
              </div>
            )}

            {!loading && result && (
              <div className="result-content">
                <div className="candidate-line">
                  <div>
                    <small>Candidato</small>
                    <strong>{result.candidate_name}</strong>
                    <span className={`status-pill ${scoreTone(result.fit_score)}`}>{scoreLabel(result.fit_score)}</span>
                  </div>
                  <div className="score-ring" style={{ "--score": result.fit_score } as CSSProperties}>
                    <strong>{result.fit_score}</strong>
                    <small>/100</small>
                  </div>
                </div>

                <div className="decision-box">
                  <span>Recomendação</span>
                  <strong>{fitVerdict(result.fit_score)}</strong>
                  <p>{result.summary}</p>
                </div>

                <div className="two-stat-grid">
                  <div>
                    <span>Experiência estimada</span>
                    <strong>{result.years_experience} ano(s)</strong>
                  </div>
                  <div>
                    <span>Skills detectadas</span>
                    <strong>{result.skills.length}</strong>
                  </div>
                </div>

                <ul className="skill-cloud">
                  {result.skills.map((skill) => <li key={skill}>{skill}</li>)}
                </ul>
              </div>
            )}
          </section>

          <section className="glass-card insight-card">
            <div className="card-title-row compact-row">
              <div>
                <span className="eyebrow">Inteligência do histórico</span>
                <h2>Skills recorrentes</h2>
              </div>
            </div>
            {topSkills.length ? (
              <ul className="skill-cloud subtle">
                {topSkills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            ) : (
              <p className="muted-text">As skills aparecerão aqui conforme novas análises forem salvas.</p>
            )}
          </section>
        </aside>
      </section>

      <section className="history-section glass-card">
        <div className="card-title-row">
          <div>
            <span className="eyebrow">Auditoria</span>
            <h2>Histórico de análises</h2>
            <p>Lista persistida no banco relacional. Clique em uma análise para revisar a leitura resumida.</p>
          </div>
          <span className="history-count">{history.length} registros</span>
        </div>

        {!history.length && <div className="empty-inline">Ainda não existe histórico. Faça a primeira análise.</div>}

        {!!history.length && (
          <div className="history-grid">
            <div className="history-list">
              {history.map((item) => (
                <div
                  className={`history-row ${activeHistory?.id === item.id ? "selected" : ""}`}
                  key={item.id}
                >
                  <button
                    type="button"
                    className="history-select"
                    onClick={() => setActiveHistoryId(item.id)}
                    aria-label={`Abrir análise de ${item.candidate_name}`}
                  >
                    <span className={`mini-score ${scoreTone(item.fit_score)}`}>{item.fit_score}</span>
                    <span>
                      <strong>{item.candidate_name}</strong>
                      <small>{formatDate(item.created_at)} · {scoreLabel(item.fit_score)}</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="delete-analysis-button"
                    onClick={() => handleDeleteAnalysis(item.id, item.candidate_name)}
                    disabled={deletingId === item.id}
                    aria-label={`Excluir análise de ${item.candidate_name}`}
                    title="Excluir análise"
                  >
                    {deletingId === item.id ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              ))}
            </div>

            {activeHistory && (
              <article className="history-preview">
                <div className="candidate-line small-line">
                  <div>
                    <small>Análise selecionada</small>
                    <strong>{activeHistory.candidate_name}</strong>
                    <span className={`status-pill ${scoreTone(activeHistory.fit_score)}`}>{fitVerdict(activeHistory.fit_score)}</span>
                  </div>
                  <div className="score-ring small" style={{ "--score": activeHistory.fit_score } as CSSProperties}>
                    <strong>{activeHistory.fit_score}</strong>
                  </div>
                </div>
                <p>{activeHistory.summary}</p>
                <ul className="skill-cloud subtle">
                  {activeHistory.skills.map((skill) => <li key={skill}>{skill}</li>)}
                </ul>
              </article>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
