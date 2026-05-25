import json
import re
from typing import Any

from google import genai
from google.genai import types
from pydantic import ValidationError

from app.core_config import settings
from app.schemas.analysis import AnalysisLLMResult


class LLMFormatError(Exception):
    """Erro usado quando o LLM responde fora do contrato esperado."""


class LLMUnavailableError(Exception):
    """Erro usado quando o provedor de LLM está indisponível ou mal configurado."""


class LLMAnalysisService:
    def __init__(self) -> None:
        self.provider = settings.llm_provider.lower()

        if self.provider == "gemini":
            api_key = settings.gemini_api_key

            if not api_key:
                raise LLMUnavailableError("GEMINI_API_KEY não configurada no arquivo .env")

            try:
                self.client = genai.Client(api_key=api_key)
                self.model = settings.gemini_model
            except Exception as exc:
                raise LLMUnavailableError("Falha ao inicializar o cliente Gemini") from exc
        else:
            self.client = None
            self.model = "mock"

    def analyze(self, resume_text: str, job_text: str) -> AnalysisLLMResult:
        if self.provider == "gemini":
            return self._analyze_with_gemini(resume_text, job_text)

        return self._analyze_with_mock(resume_text, job_text)

    def _analyze_with_gemini(self, resume_text: str, job_text: str) -> AnalysisLLMResult:
        prompt = self._build_prompt(resume_text=resume_text, job_text=job_text)

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
        except Exception as exc:
            raise LLMUnavailableError(f"Falha ao chamar o provedor Gemini: {exc}") from exc

        raw_text = response.text or ""

        try:
            payload = self._extract_json(raw_text)

            candidate_name = str(payload.get("candidate_name", "")).strip()
            if self._is_missing_candidate_name(candidate_name):
                fallback_name = self._extract_candidate_name_from_resume(resume_text)
                if fallback_name:
                    payload["candidate_name"] = fallback_name

            return AnalysisLLMResult.model_validate(payload)

        except json.JSONDecodeError as exc:
            raise LLMFormatError("Resposta do LLM não é um JSON válido.") from exc
        except ValidationError as exc:
            raise LLMFormatError(f"Resposta do LLM fora do contrato: {exc}") from exc

    def _analyze_with_mock(self, resume_text: str, job_text: str) -> AnalysisLLMResult:
        resume_lower = resume_text.lower()
        job_lower = job_text.lower()

        possible_skills = [
            "Python",
            "Java",
            "JavaScript",
            "TypeScript",
            "React",
            "Next.js",
            "Node.js",
            "FastAPI",
            "Spring Boot",
            "SQL",
            "PostgreSQL",
            "MySQL",
            "Oracle SQL",
            "Git",
            "Docker",
            "API REST",
            "Machine Learning",
            "LLM",
        ]

        found_skills = [
            skill
            for skill in possible_skills
            if skill.lower() in resume_lower
        ]

        if not found_skills:
            found_skills = ["Análise de requisitos", "Lógica de programação", "Git"]

        matched = sum(
            1
            for skill in found_skills
            if skill.lower() in job_lower
        )

        fit_score = min(100, max(35, 55 + matched * 10))
        candidate_name = self._extract_candidate_name_from_resume(resume_text) or "Nome não identificado"

        return AnalysisLLMResult(
            candidate_name=candidate_name,
            skills=found_skills[:20],
            years_experience=1.0,
            fit_score=fit_score,
            summary=(
                "Análise simulada em modo mock. O candidato apresenta aderência parcial "
                "com base nas tecnologias identificadas no currículo e na descrição da vaga."
            ),
        )

    def _build_prompt(self, resume_text: str, job_text: str) -> str:
        return f"""
Você é um especialista em recrutamento técnico e avaliação de aderência entre currículo e vaga.

Analise o currículo e a vaga abaixo.

Retorne exclusivamente um JSON válido, sem markdown, sem comentários e sem texto antes ou depois.

Contrato obrigatório:
{{
  "candidate_name": "nome completo do candidato",
  "skills": ["lista com no máximo 20 habilidades técnicas relevantes"],
  "years_experience": 0,
  "fit_score": 0,
  "summary": "resumo curto em português justificando a nota"
}}

Regras obrigatórias:
- candidate_name deve ser obrigatoriamente o nome completo do candidato.
- Procure o nome principalmente nas primeiras linhas do currículo, no cabeçalho, antes de e-mail, telefone, LinkedIn ou GitHub.
- Não use cargo, profissão, e-mail, telefone ou nome da vaga como nome do candidato.
- Se houver um nome próprio no topo do currículo, use esse nome.
- Só use "Nome não identificado" se realmente não existir nenhum nome de pessoa no currículo.
- skills deve conter no máximo 20 itens.
- Priorize tecnologias, ferramentas, linguagens, frameworks, bancos de dados e metodologias realmente presentes no currículo.
- Não inclua habilidades genéricas como comunicação, proatividade, trabalho em equipe ou resolução de problemas, exceto se forem decisivas para a vaga.
- years_experience deve ser um número aproximado.
- fit_score deve ser um número inteiro entre 0 e 100.
- summary deve explicar objetivamente por que o candidato se encaixa ou não na vaga.
- Não invente informações que não estejam no currículo.
- Não retorne campos extras além dos campos do contrato.

Currículo:
\"\"\"
{resume_text}
\"\"\"

Vaga:
\"\"\"
{job_text}
\"\"\"
"""

    def _extract_json(self, text: str) -> dict[str, Any]:
        cleaned = text.strip()

        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```json", "", cleaned, flags=re.IGNORECASE).strip()
            cleaned = re.sub(r"^```", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)

            if not match:
                raise

            return json.loads(match.group(0))

    def _is_missing_candidate_name(self, candidate_name: str) -> bool:
        normalized = candidate_name.strip().lower()

        invalid_values = {
            "",
            "nome não identificado",
            "nome nao identificado",
            "candidato identificado pelo currículo",
            "candidato identificado pelo curriculo",
            "não identificado",
            "nao identificado",
            "candidato",
        }

        return normalized in invalid_values

    def _extract_candidate_name_from_resume(self, resume_text: str) -> str | None:
        lines = [
            line.strip()
            for line in resume_text.splitlines()
            if line.strip()
        ]

        ignored_keywords = [
            "currículo",
            "curriculo",
            "resume",
            "cv",
            "desenvolvedor",
            "developer",
            "engenheiro",
            "analista",
            "estagiário",
            "estagiario",
            "frontend",
            "backend",
            "fullstack",
            "full stack",
            "software",
            "dados",
            "email",
            "e-mail",
            "telefone",
            "celular",
            "linkedin",
            "github",
            "portfolio",
            "portfólio",
            "objetivo",
            "resumo",
            "perfil",
            "experiência",
            "experiencia",
            "formação",
            "formacao",
            "habilidades",
            "competências",
            "competencias",
        ]

        for line in lines[:12]:
            clean_line = re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]", " ", line)
            clean_line = re.sub(r"\s+", " ", clean_line).strip()

            if not clean_line:
                continue

            lower_line = clean_line.lower()

            if any(keyword in lower_line for keyword in ignored_keywords):
                continue

            words = clean_line.split()

            if not 2 <= len(words) <= 5:
                continue

            valid_words = []
            for word in words:
                if len(word) < 2:
                    continue

                if not re.match(r"^[A-Za-zÀ-ÖØ-öø-ÿ'-]+$", word):
                    continue

                valid_words.append(word)

            if len(valid_words) < 2:
                continue

            name = " ".join(valid_words).strip()

            if self._looks_like_person_name(name):
                return name

        return None

    def _looks_like_person_name(self, value: str) -> bool:
        words = value.split()

        if not 2 <= len(words) <= 5:
            return False

        blocked_terms = {
            "python",
            "java",
            "javascript",
            "typescript",
            "react",
            "next",
            "node",
            "spring",
            "boot",
            "sql",
            "mysql",
            "postgresql",
            "oracle",
            "docker",
            "git",
            "api",
            "rest",
            "html",
            "css",
        }

        for word in words:
            if word.lower() in blocked_terms:
                return False

        capitalized_count = sum(
            1
            for word in words
            if word[0].isupper()
        )

        return capitalized_count >= 2