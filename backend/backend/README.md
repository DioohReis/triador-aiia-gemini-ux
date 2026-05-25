# Triador aiia — Fullstack Júnior com Gemini, upload de currículo e UX profissional

Aplicação fullstack para triagem de currículos contra uma vaga específica. O sistema recebe currículo em PDF, DOCX ou TXT, extrai o texto no backend, chama uma LLM para gerar uma avaliação estruturada, valida o retorno e persiste o histórico em banco relacional.

## Stack

- **Frontend:** Next.js + TypeScript
- **Backend:** Python + FastAPI
- **Banco:** SQLite via SQLAlchemy
- **LLM:** mock local, Google Gemini ou OpenAI
- **Extração de documento:** pypdf e python-docx

## Decisão de backend

Python foi escolhido pela boa integração com FastAPI, Pydantic, bibliotecas de extração de documentos e SDKs de LLM. A estrutura separa handler HTTP, serviço de análise, serviço de LLM, extração de documentos e persistência.

## Segurança importante

Nunca suba arquivo `.env` para o GitHub. Use `.env.example` como modelo. Chaves de API ficam somente no backend.

Se uma chave foi exposta em chat, commit ou print público, revogue a chave no Google AI Studio e gere outra.

## Como rodar em ambiente limpo

### 1. Backend

Use Python 3.12.

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
copy .env.example .env
```

Abra `backend/.env` e configure:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=COLE_SUA_CHAVE_GEMINI_AQUI
GEMINI_MODEL=gemini-2.5-flash
```

Depois rode:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Teste:

```txt
http://localhost:8000/api/health
http://localhost:8000/docs
```

### 2. Frontend

Abra outro terminal:

```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Abra:

```txt
http://localhost:3000
```

## Modos de LLM

### Mock local

Não usa IA real. Serve para testar fluxo, banco, upload e interface.

```env
LLM_PROVIDER=mock
```

### Google Gemini

Usa o SDK oficial `google-genai`.

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=COLE_SUA_CHAVE_GEMINI_AQUI
GEMINI_MODEL=gemini-2.5-flash
```

### OpenAI opcional

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=COLE_SUA_CHAVE_OPENAI_AQUI
OPENAI_MODEL=gpt-4o-mini
```

## Endpoints

- `GET /api/health` — status da API
- `POST /api/documents/extract` — upload e extração de PDF/DOCX/TXT
- `POST /api/analyses` — cria análise e persiste no banco
- `GET /api/analyses` — lista histórico

## Arquitetura

```txt
frontend/src/app/page.tsx      Interface Next.js
frontend/src/lib/api.ts        Cliente HTTP
backend/app/api/routes.py      Handlers HTTP
backend/app/services/          LLM, análise e extração de documentos
backend/app/repositories/      Persistência
backend/app/models/            Modelos SQLAlchemy
backend/app/schemas/           Schemas Pydantic
```

## Critérios atendidos

- Saída estruturada da LLM
- Validação da saída antes de persistir
- Tratamento de erro de formato inválido
- Separação entre rota, serviço e persistência
- Banco relacional SQLite
- Upload de PDF/DOCX/TXT
- `.env.example`
- Frontend com loading real, resultado e histórico

## Próximos passos possíveis

- OCR para PDFs escaneados
- Retry com backoff em chamadas de LLM
- Streaming de resposta
- Testes de integração
- Deploy do backend e frontend
