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
  isAuthError,
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
const STORAGE_SESSION_TOKEN = "triador_session_token";
const STORAGE_THEME = "triador_theme";

function storeAuthToken(token: string, remember: boolean) {
  if (remember) {
    localStorage.setItem(STORAGE_TOKEN, token);
    sessionStorage.removeItem(STORAGE_SESSION_TOKEN);
    return;
  }

  sessionStorage.setItem(STORAGE_SESSION_TOKEN, token);
  localStorage.removeItem(STORAGE_TOKEN);
}

function readStoredToken() {
  return localStorage.getItem(STORAGE_TOKEN) ?? sessionStorage.getItem(STORAGE_SESSION_TOKEN);
}

function clearStoredToken() {
  localStorage.removeItem(STORAGE_TOKEN);
  sessionStorage.removeItem(STORAGE_SESSION_TOKEN);
}

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

    const canvasEl = canvas;
    const context = canvasEl.getContext("2d", { willReadFrequently: true });
    if (!context) return;

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
    let stageWidth = 0;
    let stageHeight = 0;

    const mouse = {
      x: -9999,
      y: -9999,
      radius: 150,
    };

    function clamp(value: number, min: number, max: number) {
      return Math.min(Math.max(value, min), max);
    }

    function getInitialFontSize() {
      if (stageWidth < 380) return clamp(stageWidth * 0.145, 42, 56);
      if (stageWidth < 520) return clamp(stageWidth * 0.155, 54, 70);
      if (stageWidth < 760) return clamp(stageWidth * 0.135, 70, 92);
      if (stageWidth < 1080) return clamp(stageWidth * 0.115, 92, 128);
      return clamp(stageWidth * 0.095, 128, 172);
    }

    function getFittedFontSize(lines: string[]) {
      let fontSize = getInitialFontSize();
      const maxWidth = stageWidth * (stageWidth < 620 ? 0.76 : stageWidth < 980 ? 0.68 : 0.58);
      const maxHeight = stageHeight * (stageHeight < 520 ? 0.58 : 0.52);

      while (fontSize > 34) {
        ctx.font = `900 ${fontSize}px Inter, Arial, sans-serif`;
        const widestLine = Math.max(...lines.map((line) => ctx.measureText(line).width));
        const totalHeight = fontSize + fontSize * 0.76 * (lines.length - 1);

        if (widestLine <= maxWidth && totalHeight <= maxHeight) break;
        fontSize -= 2;
      }

      return fontSize;
    }

    function resize() {
      const rect = canvasEl.getBoundingClientRect();
      stageWidth = Math.max(280, Math.round(rect.width || canvasEl.clientWidth || window.innerWidth));
      stageHeight = Math.max(300, Math.round(rect.height || canvasEl.clientHeight || window.innerHeight));

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = Math.round(stageWidth * dpr);
      canvasEl.height = Math.round(stageHeight * dpr);
      canvasEl.style.width = "100%";
      canvasEl.style.height = "100%";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    }

    function buildParticles() {
      particles = [];
      const w = stageWidth;
      const h = stageHeight;
      const lines = ["triador", "your", "career"];
      const fontSize = getFittedFontSize(lines);
      const lineHeight = fontSize * 0.76;
      const visualCenterY = h * (w < 620 ? 0.49 : 0.5);
      const startY = visualCenterY - lineHeight;

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

      const gap = w < 420 ? 4 : w < 760 ? 3.5 : 3;
      for (let y = 0; y < h; y += gap) {
        for (let x = 0; x < w; x += gap) {
          const index = (Math.floor(y) * w + Math.floor(x)) * 4;
          const alpha = imageData.data[index + 3];

          if (alpha > 116) {
            particles.push({
              x: x + (Math.random() - 0.5) * 300,
              y: y + (Math.random() - 0.5) * 300,
              baseX: x,
              baseY: y,
              size: Math.random() * 1.55 + 0.58,
              velocity: Math.random() * 0.15 + 0.045,
              density: Math.random() * 54 + 14,
              opacity: Math.random() * 0.7 + 0.32,
              drift: Math.random() * 0.55 + 0.14,
              angle: Math.random() * Math.PI * 2,
            });
          }
        }
      }
    }

    function animate() {
      const w = stageWidth;
      const h = stageHeight;
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

    function setLocalPointer(clientX: number, clientY: number) {
      const rect = canvasEl.getBoundingClientRect();
      mouse.x = clientX - rect.left;
      mouse.y = clientY - rect.top;
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      setLocalPointer(event.clientX, event.clientY);
    }

    function onPointerLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    const observer = new ResizeObserver(() => resize());
    observer.observe(canvasEl);
    resize();
    animate();

    canvasEl.addEventListener("pointermove", onPointerMove, { passive: true });
    canvasEl.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      canvasEl.removeEventListener("pointermove", onPointerMove);
      canvasEl.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
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
          <div className="resume-document-lines"><b /><b /><b /><b /><b /><b /></div>
        </div>
      )}
      <div className="resume-open-overlay">
        <span>Abrir currículo</span>
      </div>
    </div>
  );
}

function AuthPanel({ onAuth, theme, setTheme }: { onAuth: (token: string, user: User) => void; theme: Theme; setTheme: (theme: Theme) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState(2);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const passwordChecks = [
    password.length >= 8,
    /[A-ZÀ-Ý]/.test(password),
    /[a-zà-ÿ]/.test(password),
    /\d/.test(password),
    /[^A-Za-zÀ-ÿ0-9]/.test(password),
  ];
  const passwordScore = passwordChecks.filter(Boolean).length;
  const passwordStrongEnough = passwordScore >= 3;
  const passwordsMatch = mode === "login" || password === confirmPassword;
  const canAuthenticate = mode === "login"
    ? emailValid && password.length >= 1
    : name.trim().length >= 2 && emailValid && passwordStrongEnough && passwordsMatch && acceptedTerms;

  function getPasswordStrengthLabel() {
    if (!password) return "Aguardando senha";
    if (passwordScore <= 2) return "Senha fraca";
    if (passwordScore === 3) return "Senha aceitável";
    if (passwordScore === 4) return "Senha forte";
    return "Senha excelente";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!emailValid) {
      setError("Informe um e-mail válido para continuar.");
      return;
    }

    if (mode === "register") {
      if (name.trim().length < 2) {
        setError("Informe seu nome com pelo menos 2 caracteres.");
        return;
      }
      if (!passwordStrongEnough) {
        setError("Use uma senha com pelo menos 8 caracteres e uma combinação de letras, números ou símbolos.");
        return;
      }
      if (!passwordsMatch) {
        setError("A confirmação de senha não confere.");
        return;
      }
      if (!acceptedTerms) {
        setError("Confirme que aceita o uso privado dos dados para análise dos currículos.");
        return;
      }
    }

    setLoading(true);
    try {
      const response = mode === "register"
        ? await registerUser(name.trim(), normalizedEmail, password)
        : await loginUser(normalizedEmail, password);

      storeAuthToken(response.access_token, rememberSession);
      onAuth(response.access_token, response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell proto-shell">
      <section className="proto-hero proto-hero-stage-only">
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

        <div className="proto-particle-stage" aria-label="Identidade visual Triador">
          <ParticleTextCanvas />
        </div>
      </section>

      <section className="proto-intro-auth-section" id="auth-card">
        <div className="proto-copy proto-rise proto-intro-copy">
          <div className="proto-pill"><Icon name="spark" /> Plataforma profissional para triagem de currículos com IA</div>
          <h1>Transforme experiência em oportunidade.</h1>
          <p>
            Login seguro, dados isolados por usuário e uma experiência premium para analisar currículos com clareza, contexto e inteligência artificial.
          </p>

          <div className="proto-actions">
            <a className="proto-primary" href="#auth-form">Começar agora <span>→</span></a>
            <a className="proto-secondary" href="#preview">Ver protótipo</a>
          </div>
        </div>

        <div className="proto-auth-card glass-panel auth-pro-card" id="auth-form">
          <div className="auth-tabs" role="tablist" aria-label="Alternar entre login e cadastro">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Criar conta</button>
          </div>

          <div className="auth-title">
            <Icon name="lock" />
            <div>
              <h2>{mode === "login" ? "Acesse seu workspace" : "Crie seu workspace privado"}</h2>
              <p>{mode === "login" ? "Entre com sua conta para acessar seus currículos." : "Cadastro com validação, senha forte e sessão protegida."}</p>
            </div>
          </div>

          <form onSubmit={submit} className="auth-form professional-auth-form" noValidate>
            {mode === "register" && (
              <label>Nome completo
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Seu nome"
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label>E-mail
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@email.com"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                aria-invalid={email.length > 0 && !emailValid}
                required
              />
              {email.length > 0 && !emailValid && <small className="field-feedback">Digite um e-mail válido.</small>}
            </label>

            <label>Senha
              <div className="password-field">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "login" ? "Sua senha" : "Mínimo 8 caracteres"}
                  type={showPassword ? "text" : "password"}
                  minLength={mode === "register" ? 8 : 1}
                  maxLength={128}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>

            {mode === "register" && (
              <>
                <div className="password-strength" aria-live="polite">
                  <span><i style={{ width: `${Math.max(16, passwordScore * 20)}%` }} /></span>
                  <strong>{getPasswordStrengthLabel()}</strong>
                </div>
                <div className="auth-checklist">
                  <span className={passwordChecks[0] ? "ok" : ""}>8+ caracteres</span>
                  <span className={passwordChecks[1] && passwordChecks[2] ? "ok" : ""}>maiúscula e minúscula</span>
                  <span className={passwordChecks[3] || passwordChecks[4] ? "ok" : ""}>número ou símbolo</span>
                </div>

                <label>Confirmar senha
                  <input
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repita sua senha"
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                    required
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && <small className="field-feedback">As senhas precisam ser iguais.</small>}
                </label>
              </>
            )}

            <div className="auth-options-row">
              <label className="checkbox-line">
                <input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} />
                <span>Manter conectado neste dispositivo</span>
              </label>
            </div>

            {mode === "register" && (
              <label className="checkbox-line auth-terms">
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
                <span>Confirmo que os currículos serão usados apenas para gerar minhas análises privadas no Triador.</span>
              </label>
            )}

            {error && <div className="alert error" role="alert">{error}</div>}
            <button className="primary-button" disabled={loading || !canAuthenticate} type="submit">
              {loading ? "Processando..." : mode === "login" ? "Entrar no Triador" : "Criar conta segura"}
            </button>
          </form>
        </div>
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

    const storedToken = readStoredToken();
    if (!storedToken) return;

    setToken(storedToken);
    getMe(storedToken)
      .then((me) => {
        setUser(me);
        return loadPrivateData(storedToken);
      })
      .catch(() => {
        clearStoredToken();
        setToken(null);
        setUser(null);
        setError("Sua sessão anterior expirou. Entre novamente para continuar.");
      });
  }, []);


  async function onAuth(authToken: string, authUser: User) {
    setError("");
    setToken(authToken);
    setUser(authUser);
    try {
      await loadPrivateData(authToken);
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthExpired(err instanceof Error ? err.message : undefined);
        return;
      }
      setError(err instanceof Error ? err.message : "Não foi possível carregar seus dados.");
    }
  }

  function logout() {
    clearStoredToken();
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

  function handleAuthExpired(message = "Sua sessão expirou. Entre novamente para continuar.") {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setHistory([]);
    setResult(null);
    setError(message);
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
      if (isAuthError(err)) {
        handleAuthExpired(err instanceof Error ? err.message : undefined);
      } else {
        setError(err instanceof Error ? err.message : "Erro ao extrair texto do arquivo.");
      }
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
      if (isAuthError(err)) {
        handleAuthExpired(err instanceof Error ? err.message : undefined);
      } else {
        setError(err instanceof Error ? err.message : "Erro ao analisar currículo.");
      }
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
      if (isAuthError(err)) {
        handleAuthExpired(err instanceof Error ? err.message : undefined);
      } else {
        setError(err instanceof Error ? err.message : "Não foi possível excluir.");
      }
    } finally {
      setDeletingId(null);
    }
  }


  function openResumeFile(item: ResumeCarouselItem) {
    if (item.file.previewUrl) {
      window.open(item.file.previewUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const safeTitle = item.file.fileName.replace(/[<>&]/g, "");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${safeTitle}</title><style>body{margin:0;background:#111;font-family:Inter,Arial,sans-serif;color:#111}.page{width:min(820px,calc(100% - 32px));min-height:1040px;margin:24px auto;padding:56px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.35)}.tag{display:inline-flex;background:#050505;color:#fff;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}h1{font-size:56px;line-height:.94;letter-spacing:-.07em;margin:28px 0 8px}.score{font-size:92px;font-weight:1000;letter-spacing:-.1em;margin:22px 0}.muted{color:#667085}.line{height:12px;background:#e8e8e8;border-radius:999px;margin:12px 0}.skills{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.skills span{border:1px solid #ddd;border-radius:999px;padding:8px 12px;font-weight:800}.summary{font-size:18px;line-height:1.7;margin-top:28px}</style></head><body><main class="page"><span class="tag">prévia gerada pelo Triador</span><h1>${item.candidate_name}</h1><p class="muted">${item.file.fileName}</p><div class="score">${item.fit_score}</div><p><strong>${scoreLabel(item.fit_score)}</strong> · ${fitVerdict(item.fit_score)}</p><p class="summary">${item.summary}</p><div class="skills">${item.skills.map((skill) => `<span>${skill.replace(/[<>&]/g, "")}</span>`).join("")}</div><div style="margin-top:36px"><div class="line"></div><div class="line" style="width:84%"></div><div class="line" style="width:68%"></div><div class="line" style="width:92%"></div></div></main></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
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
                <article
                  className={`resume-carousel-card ${isActive ? "active" : ""}`}
                  key={`${item.id}-${index}`}
                >
                  <button
                    className="resume-document-button"
                    type="button"
                    onClick={() => openResumeFile(item)}
                    aria-label={`Abrir currículo ${item.file.fileName}`}
                    title={`Abrir ${item.file.fileName}`}
                  >
                    <ResumeDocumentPreview item={item} />
                  </button>

                  <button
                    className="resume-card-body"
                    type="button"
                    onClick={() => {
                      setSelectedCarouselId(item.id);
                      if (realId) {
                        const selected = history.find((historyItem) => historyItem.id === realId);
                        if (selected) setResult(selected);
                      }
                    }}
                    aria-label={`Selecionar análise de ${item.candidate_name}`}
                  >
                    <span>{item.fit_score}</span>
                    <div>
                      <strong>{item.candidate_name}</strong>
                      <small>{item.file.fileName}</small>
                    </div>
                    <i>{item.skills.slice(0, 3).join(" · ")}</i>
                  </button>
                </article>
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
