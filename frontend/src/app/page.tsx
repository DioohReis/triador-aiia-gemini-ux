"use client";

import { ChangeEvent, CSSProperties, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
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


type ResumeFilePreview = {
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl?: string;
  uploadedAt: string;
};

type ResumeCarouselItem = {
  id: string;
  candidate_name: string;
  fit_score: number;
  summary: string;
  skills: string[];
  years_experience: number;
  created_at: string;
  source: "history" | "demo";
  file: ResumeFilePreview;
};

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


function ParticleTextCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const canvasEl = canvas;
    const ctx = context;

    type Particle = {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      velocity: number;
      density: number;
      opacity: number;
      drift: number;
      angle: number;
    };

    let particles: Particle[] = [];
    let frameId = 0;

    const mouse = {
      x: -9999,
      y: -9999,
      radius: 145,
    };

    const getFontSize = () => {
      if (window.innerWidth < 520) return 66;
      if (window.innerWidth < 900) return 92;
      return 148;
    };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = window.innerWidth * dpr;
      canvasEl.height = window.innerHeight * dpr;
      canvasEl.style.width = `${window.innerWidth}px`;
      canvasEl.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    }

    function buildParticles() {
      particles = [];
      const w = window.innerWidth;
      const h = window.innerHeight;
      const fontSize = getFontSize();
      const lines = ["triador", "your", "career"];
      const lineHeight = fontSize * 0.76;
      const startY = h * 0.34 - lineHeight;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${fontSize}px Inter, Arial, sans-serif`;

      lines.forEach((line, index) => {
        ctx.fillText(line, w / 2, startY + index * lineHeight);
      });

      const imageData = ctx.getImageData(0, 0, w, h);
      ctx.clearRect(0, 0, w, h);

      const gap = w < 640 ? 4 : 3;
      for (let y = 0; y < h; y += gap) {
        for (let x = 0; x < w; x += gap) {
          const index = (y * w + x) * 4;
          const alpha = imageData.data[index + 3];

          if (alpha > 120) {
            particles.push({
              x: x + (Math.random() - 0.5) * 360,
              y: y + (Math.random() - 0.5) * 360,
              baseX: x,
              baseY: y,
              size: Math.random() * 1.55 + 0.55,
              velocity: Math.random() * 0.16 + 0.045,
              density: Math.random() * 52 + 14,
              opacity: Math.random() * 0.65 + 0.28,
              drift: Math.random() * 0.55 + 0.15,
              angle: Math.random() * Math.PI * 2,
            });
          }
        }
      }
    }

    function animate() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      particles.forEach((p) => {
        p.angle += 0.012;
        p.x += Math.cos(p.angle) * p.drift * 0.12;
        p.y += Math.sin(p.angle) * p.drift * 0.12;

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        if (distance < mouse.radius) {
          const force = (mouse.radius - distance) / mouse.radius;
          const directionX = dx / distance;
          const directionY = dy / distance;

          p.x -= directionX * force * p.density * 1.18;
          p.y -= directionY * force * p.density * 1.18;
        } else {
          p.x += (p.baseX - p.x) * p.velocity;
          p.y += (p.baseY - p.y) * p.velocity;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
      });

      frameId = requestAnimationFrame(animate);
    }

    function onMouseMove(event: MouseEvent) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    }

    function onMouseLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    function onTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      mouse.x = touch.clientX;
      mouse.y = touch.clientY;
    }

    resize();
    animate();

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-text-canvas" aria-hidden="true" />;
}

const landingFeatures = [
  {
    icon: "file" as const,
    title: "Currículos inteligentes",
    description: "Crie análises diferentes para vagas, tecnologias e níveis profissionais.",
  },
  {
    icon: "lock" as const,
    title: "Dados separados por usuário",
    description: "Cada conta visualiza apenas seus próprios currículos, feedbacks e histórico.",
  },
  {
    icon: "spark" as const,
    title: "Sugestões com IA",
    description: "Apoio para melhorar aderência, stack, experiência e apresentação profissional.",
  },
];

const landingSteps = ["Login seguro", "Upload do currículo", "Vaga alvo", "Análise IA", "Histórico privado"];

const demoResumeItems: ResumeCarouselItem[] = [
  {
    id: "demo-java",
    candidate_name: "Fullstack Java",
    fit_score: 92,
    summary: "Perfil forte para vagas com Spring Boot, APIs REST, banco relacional e frontend moderno.",
    skills: ["Spring Boot", "React", "Oracle SQL", "APIs REST"],
    years_experience: 2,
    created_at: new Date().toISOString(),
    file: {
      fileName: "fullstack-java.pdf",
      fileType: "application/pdf",
      fileSize: 428000,
      uploadedAt: new Date().toISOString(),
    },
    source: "demo",
  },
  {
    id: "demo-front",
    candidate_name: "Frontend UX",
    fit_score: 86,
    summary: "Boa aderência para interfaces responsivas, componentes reutilizáveis e experiência do usuário.",
    skills: ["React", "Next.js", "UI/UX", "TypeScript"],
    years_experience: 1,
    created_at: new Date().toISOString(),
    file: {
      fileName: "frontend-ux.pdf",
      fileType: "application/pdf",
      fileSize: 392000,
      uploadedAt: new Date().toISOString(),
    },
    source: "demo",
  },
  {
    id: "demo-data",
    candidate_name: "Dados & Banco",
    fit_score: 78,
    summary: "Base sólida em modelagem, consultas SQL, persistência e integração com backend.",
    skills: ["PostgreSQL", "MySQL", "Oracle", "Python"],
    years_experience: 1,
    created_at: new Date().toISOString(),
    file: {
      fileName: "dados-banco.pdf",
      fileType: "application/pdf",
      fileSize: 365000,
      uploadedAt: new Date().toISOString(),
    },
    source: "demo",
  },
  {
    id: "demo-ai",
    candidate_name: "IA Aplicada",
    fit_score: 88,
    summary: "Destaque para uso de LLM, análise textual, prompts e automações inteligentes.",
    skills: ["LLM", "Gemini", "Tokens", "Prompting"],
    years_experience: 1,
    created_at: new Date().toISOString(),
    file: {
      fileName: "ia-aplicada.pdf",
      fileType: "application/pdf",
      fileSize: 441000,
      uploadedAt: new Date().toISOString(),
    },
    source: "demo",
  },
];

function createSyntheticResumeFile(item: Analysis): ResumeFilePreview {
  const safeName = item.candidate_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "curriculo";

  return {
    fileName: `${safeName}.pdf`,
    fileType: "application/pdf",
    fileSize: 0,
    uploadedAt: item.created_at,
  };
}

function toCarouselItem(item: Analysis, file?: ResumeFilePreview): ResumeCarouselItem {
  return {
    id: `history-${item.id}`,
    candidate_name: item.candidate_name,
    fit_score: item.fit_score,
    summary: item.summary,
    skills: item.skills,
    years_experience: item.years_experience,
    created_at: item.created_at,
    file: file ?? createSyntheticResumeFile(item),
    source: "history",
  };
}

function isPdfFile(file: ResumeFilePreview) {
  return file.fileType.includes("pdf") || /\.pdf$/i.test(file.fileName);
}

function ResumeDocumentPreview({ item }: { item: ResumeCarouselItem }) {
  const file = item.file;
  const extension = file.fileName.split(".").pop()?.toUpperCase() || "PDF";
  const hasPdfPreview = Boolean(file.previewUrl && isPdfFile(file));

  return (
    <div className="resume-document-preview" aria-label={`Prévia do arquivo ${file.fileName}`}>
      {hasPdfPreview ? (
        <iframe
          className="resume-pdf-frame"
          src={`${file.previewUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`}
          title={`Prévia de ${file.fileName}`}
        />
      ) : (
        <div className="resume-document-cover">
          <div className="resume-document-topline"><span>{extension}</span><i>{item.fit_score}</i></div>
          <strong>{item.candidate_name}</strong>
          <small>{file.fileName}</small>
          <div className="resume-document-lines"><b /><b /><b /><b /></div>
        </div>
      )}
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
  const [activeStep, setActiveStep] = useState(2);

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
    <main className="auth-shell proto-shell">
      <section className="proto-hero">
        <ParticleTextCanvas />
        <div className="proto-hero-overlay" />
        <div className="proto-glow" />

        <nav className="proto-nav">
          <div className="proto-brand">
            <div className="proto-brand-icon"><Icon name="briefcase" /></div>
            <div>
              <p>TRIADOR AIIA</p>
              <span>AI Resume Platform</span>
            </div>
          </div>

          <div className="proto-menu">
            <a href="#features">Recursos</a>
            <a href="#flow">Fluxo</a>
            <a href="#preview">Dashboard</a>
          </div>

          <button className="proto-login-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>
        </nav>

        <div className="proto-hero-content">
          <div className="proto-copy proto-rise">
            <div className="proto-pill"><Icon name="spark" /> Plataforma profissional para triagem de currículos com IA</div>
            <h1>Transforme experiência em oportunidade.</h1>
            <p>
              Interface premium com partículas interativas, login individual, dados isolados por conta e dashboard focado na análise inteligente de currículos.
            </p>

            <div className="proto-actions">
              <a className="proto-primary" href="#auth-card">Começar agora <span>→</span></a>
              <a className="proto-secondary" href="#preview">Ver protótipo</a>
            </div>
          </div>
        </div>
      </section>

      <section className="proto-auth-card glass-panel" id="auth-card">
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

      <section id="features" className="proto-features">
        {landingFeatures.map((feature, index) => (
          <article className="proto-feature-card proto-rise" style={{ animationDelay: `${index * 90}ms` }} key={feature.title}>
            <div className="proto-card-icon"><Icon name={feature.icon} /></div>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section id="flow" className="proto-flow glass-panel">
        <div>
          <p className="proto-kicker">UX Flow</p>
          <h2>Uma jornada clara para o usuário não se perder.</h2>
          <p>
            O fluxo reduz fricção: o usuário entra, envia o currículo, cola a vaga, recebe sugestões e acompanha tudo em um painel limpo.
          </p>
        </div>

        <div className="proto-step-list">
          {landingSteps.map((step, index) => (
            <button
              key={step}
              onClick={() => setActiveStep(index)}
              className={activeStep === index ? "active" : ""}
              type="button"
            >
              <span><strong>{index + 1}</strong>{step}</span>
              <i>→</i>
            </button>
          ))}
        </div>
      </section>

      <section id="preview" className="proto-preview">
        <div className="proto-browser">
          <div className="proto-browser-bar">
            <div><span /><span /><span /></div>
            <p>Dashboard Preview</p>
          </div>

          <div className="proto-dashboard-grid">
            <aside className="proto-sidebar">
              <div className="proto-profile">
                <div><Icon name="office" /></div>
                <span><strong>Diogo Reis</strong><small>Fullstack Developer</small></span>
              </div>
              {["Meus currículos", "Sugestões IA", "Vagas alvo", "Feedbacks"].map((item, index) => (
                <div key={item} className={index === 0 ? "selected" : ""}>{item}</div>
              ))}
            </aside>

            <div className="proto-dashboard-main">
              <div className="proto-active-resume">
                <div className="proto-card-head">
                  <div>
                    <p>Currículo ativo</p>
                    <h3>Desenvolvedor Fullstack Java</h3>
                  </div>
                  <Icon name="lock" />
                </div>
                {["Spring Boot e APIs REST", "Frontend responsivo com React", "Oracle SQL, MySQL e PostgreSQL", "Conhecimento em LLM e tokens de IA"].map((item) => (
                  <div className="proto-check-row" key={item}><span>{item}</span><small>ok</small></div>
                ))}
              </div>

              <div className="proto-score-card">
                <p>Score IA</p>
                <strong>92</strong>
                <span>Seu currículo está forte para vagas júnior e estágio em desenvolvimento backend/fullstack.</span>
                <a href="#auth-card">Melhorar texto</a>
              </div>
            </div>
          </div>
        </div>
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
  const [pendingFilePreview, setPendingFilePreview] = useState<ResumeFilePreview | null>(null);
  const [resumePreviews, setResumePreviews] = useState<Record<number, ResumeFilePreview>>({});
  const [parallaxY, setParallaxY] = useState(0);
  const [selectedCarouselId, setSelectedCarouselId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resumeReady = resumeText.trim().length >= 30;
  const jobReady = jobText.trim().length >= 30;
  const canSubmit = Boolean(token) && resumeReady && jobReady && !loading && !extracting;
  const provider = normalizeProvider(health?.llm_provider);
  const readiness = (resumeReady ? 35 : 0) + (jobReady ? 35 : 0) + (health ? 30 : 0);
  const averageScore = history.length ? Math.round(history.reduce((sum, item) => sum + item.fit_score, 0) / history.length) : 0;
  const activeResult = result ?? history[0] ?? null;
  const resumeCarouselItems = useMemo(() => {
    const privateItems = history.map((item) => toCarouselItem(item, resumePreviews[item.id]));
    return privateItems.length ? privateItems : demoResumeItems;
  }, [history, resumePreviews]);
  const selectedResume = selectedCarouselId ? resumeCarouselItems.find((item) => item.id === selectedCarouselId) ?? null : null;
  const activeHistoryResume = activeResult ? toCarouselItem(activeResult, resumePreviews[activeResult.id]) : null;
  const featuredResume = selectedResume ?? activeHistoryResume ?? resumeCarouselItems[0];
  const loopResumeItems = [...resumeCarouselItems, ...resumeCarouselItems, ...resumeCarouselItems];

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
    let frame = 0;

    function handleScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setParallaxY(Math.min(window.scrollY, 900));
      });
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

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
    Object.values(resumePreviews).forEach((preview: ResumeFilePreview) => {
      if (preview.previewUrl) URL.revokeObjectURL(preview.previewUrl);
    });
    if (pendingFilePreview?.previewUrl) URL.revokeObjectURL(pendingFilePreview.previewUrl);
    setResumePreviews({});
    setPendingFilePreview(null);
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

    const fileIsPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const nextPreview: ResumeFilePreview = {
      fileName: file.name,
      fileType: file.type || (fileIsPdf ? "application/pdf" : "application/octet-stream"),
      fileSize: file.size,
      previewUrl: fileIsPdf ? URL.createObjectURL(file) : undefined,
      uploadedAt: new Date().toISOString(),
    };

    setError("");
    setPendingFilePreview(nextPreview);
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
      setSelectedCarouselId(`history-${analysis.id}`);
      if (pendingFilePreview) {
        setResumePreviews((current) => ({ ...current, [analysis.id]: pendingFilePreview }));
      }
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
      const previewToRemove = resumePreviews[id];
      if (previewToRemove?.previewUrl) URL.revokeObjectURL(previewToRemove.previewUrl);
      setResumePreviews((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setHistory((current) => current.filter((item) => item.id !== id));
      if (result?.id === id) setResult(null);
      if (selectedCarouselId === `history-${id}`) setSelectedCarouselId(null);
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
      <nav className="proto-nav workspace-proto-nav">
        <div className="proto-brand">
          <div className="proto-brand-icon"><Icon name="briefcase" /></div>
          <div>
            <p>TRIADOR AIIA</p>
            <span>{user.name} · AI Resume Platform</span>
          </div>
        </div>

        <div className="proto-menu">
          <a href="#analysis-experience">Currículos</a>
          <a href="#analysis-form">Nova análise</a>
          <a href="#history">Histórico</a>
        </div>

        <button className="proto-login-button" onClick={logout} type="button">
          Sair
        </button>
      </nav>

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

      <section className="resume-experience glass-panel" id="analysis-experience" style={{ "--parallax-y": `${parallaxY}px` } as CSSProperties}>
        <div className="resume-parallax-orb resume-orb-a" />
        <div className="resume-parallax-orb resume-orb-b" />
        <div className="resume-experience-head">
          <div>
            <span className="eyebrow"><Icon name="spark" /> Experiência de análise</span>
            <h2>Currículos em movimento, decisão em foco.</h2>
            <p>Inspirado no conceito visual do Newmix: camadas com parallax, cards em fluxo contínuo e uma leitura executiva abaixo para o recrutador entender o melhor candidato sem esforço.</p>
          </div>
          <a className="resume-jump" href="#analysis-form">Nova análise <span>→</span></a>
        </div>

        <div className="resume-marquee" aria-label="Carrossel infinito de currículos analisados">
          <div className="resume-track">
            {loopResumeItems.map((item, index) => {
              const realId = item.source === "history" ? Number(item.id.replace("history-", "")) : null;
              const isActive = featuredResume?.id === item.id;

              return (
                <button
                  className={`resume-carousel-card ${isActive ? "active" : ""}`}
                  key={`${item.id}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedCarouselId(item.id);
                    if (realId) {
                      const selected = history.find((historyItem) => historyItem.id === realId);
                      if (selected) setResult(selected);
                    }
                  }}
                >
                  <ResumeDocumentPreview item={item} />
                  <div className="resume-card-body">
                    <span>{item.fit_score}</span>
                    <div>
                      <strong>{item.candidate_name}</strong>
                      <small>{item.file.fileName}</small>
                    </div>
                    <i>{item.skills.slice(0, 3).join(" · ")}</i>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="resume-detail-grid">
          <article className="resume-detail-main">
            <p className="proto-kicker">Currículo selecionado</p>
            <h3>{featuredResume?.candidate_name ?? "Aguardando análise"}</h3>
            <p>{featuredResume?.summary ?? "Envie um currículo para gerar uma leitura detalhada com score, habilidades e recomendação."}</p>
            <div className="resume-tags">
              {(featuredResume?.skills ?? ["PDF", "DOCX", "TXT"]).slice(0, 6).map((skill) => <span key={skill}>{skill}</span>)}
            </div>
            {featuredResume?.file && (
              <div className="resume-file-meta">
                <strong>{featuredResume.file.fileName}</strong>
                <span>{featuredResume.file.fileSize ? formatFileSize(featuredResume.file.fileSize) : "arquivo do histórico"} · {isPdfFile(featuredResume.file) ? "PDF" : "documento"}</span>
              </div>
            )}
          </article>

          <article className="resume-detail-score">
            <span>Match IA</span>
            <strong>{featuredResume?.fit_score ?? readiness}</strong>
            <small>{featuredResume ? scoreLabel(featuredResume.fit_score) : "Pronto para analisar"}</small>
          </article>

          <article className="resume-detail-note">
            <span>Leitura UX</span>
            <p>O carrossel mantém o histórico vivo, enquanto o bloco inferior entrega contexto, score e habilidades sem o usuário precisar abrir várias telas.</p>
          </article>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="workbench-grid">
        <form className="analysis-panel glass-panel" id="analysis-form" onSubmit={onSubmit}>
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
            {pendingFilePreview && <small className="dropzone-preview-name">Prévia carregada no carrossel: {pendingFilePreview.fileName}</small>}
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

      <section className="history-section glass-panel" id="history">
        <div className="section-heading"><span><Icon name="briefcase" /></span><div><h2>Histórico privado</h2><p>Somente análises criadas pela sua conta aparecem aqui.</p></div></div>
        <div className="history-list">
          {history.length ? history.map((item) => (
            <article className="history-item" key={item.id}>
              <button className="history-main" type="button" onClick={() => { setResult(item); setSelectedCarouselId(`history-${item.id}`); }}>
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
