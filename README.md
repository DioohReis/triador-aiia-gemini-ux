# Triador AIIA — Candidate Intelligence

Aplicação fullstack para triagem de currículos com IA. O sistema recebe um currículo em PDF, DOCX ou TXT, recebe a descrição de uma vaga, chama uma LLM via API, valida a resposta no backend, persiste a análise e exibe um histórico privado por usuário.

## Deploy

- Frontend: https://triador-aiia-gemini-ux.vercel.app
- Backend: https://triador-aiia-gemini-ux.onrender.com
- Health check: https://triador-aiia-gemini-ux.onrender.com/api/health
- Swagger/OpenAPI: https://triador-aiia-gemini-ux.onrender.com/docs

> Observação: em plano gratuito do Render, a primeira chamada pode demorar alguns segundos porque o serviço pode dormir.

## Funcionalidades

- Login e criação de conta.
- Histórico isolado por usuário.
- Upload de currículo em PDF, DOCX ou TXT.
- Extração de texto no backend.
- Análise de aderência com Gemini.
- Resposta estruturada com nome do candidato, skills, anos aproximados de experiência, score e resumo.
- Validação da saída da LLM com Pydantic antes de persistir.
- Persistência em banco relacional SQLite.
- Exclusão de análises do histórico.
- Interface responsiva, com dark/light mode, animação visual e experiência mobile.

## Stack

### Frontend

- Next.js
- TypeScript
- CSS responsivo sem biblioteca visual externa
- Deploy na Vercel

### Backend

- Python 3.12
- FastAPI
- SQLAlchemy
- Pydantic
- SQLite
- Gemini API
- Deploy no Render

## Arquitetura

```txt
Next.js Client
  ↓ HTTP/JSON
FastAPI
  ↓
Camada de rotas / handlers
  ↓
Serviços de domínio
  ↓
Serviço de LLM + validação Pydantic
  ↓
Repositório SQLAlchemy
  ↓
SQLite
```

## Autenticação e isolamento de dados

A aplicação usa autenticação por token Bearer. Cada análise é persistida com `user_id`, e as consultas de histórico e exclusão sempre filtram pelo usuário autenticado.

A ideia inicial poderia ser criar um banco físico por usuário, mas a solução profissional adotada foi usar um banco relacional único com escopo por usuário. Essa abordagem é mais segura, escalável e adequada para deploy em serviços como Render, evitando múltiplos arquivos SQLite e reduzindo risco operacional.

## Variáveis de ambiente do backend

Arquivo: `backend/.env`

```env
APP_NAME="Triador aiia"
ENVIRONMENT=local
DATABASE_URL=sqlite:///./triador.db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SECRET_KEY=troque-por-uma-chave-longa-e-segura

LLM_PROVIDER=gemini
GEMINI_API_KEY=COLE_SUA_CHAVE_GEMINI_AQUI
GEMINI_MODEL=gemini-2.5-flash
```

## Variáveis de ambiente do frontend

Arquivo: `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Em produção na Vercel:

```env
NEXT_PUBLIC_API_URL=https://triador-aiia-gemini-ux.onrender.com
```

## Rodando localmente

### Backend

```powershell
cd C:\PORTIFOLIO\triador-aiia-gemini-ux\backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

Teste:

```txt
http://localhost:8000/api/health
http://localhost:8000/docs
```

### Frontend

```powershell
cd C:\PORTIFOLIO\triador-aiia-gemini-ux\frontend
npm install
copy .env.example .env.local
npm run dev
```

Abra:

```txt
http://localhost:3000
```

## Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Status da API |
| POST | `/api/auth/register` | Cria usuário |
| POST | `/api/auth/login` | Autentica usuário |
| GET | `/api/auth/me` | Retorna usuário autenticado |
| POST | `/api/documents/extract` | Extrai texto de PDF/DOCX/TXT |
| POST | `/api/analyses` | Cria análise com LLM |
| GET | `/api/analyses` | Lista histórico do usuário |
| DELETE | `/api/analyses/{id}` | Exclui análise do usuário |

## Decisões técnicas

- **Python/FastAPI** foi escolhido pela produtividade com APIs, Pydantic, SQLAlchemy e SDKs de IA.
- **SQLite** foi escolhido por simplicidade e aderência ao escopo do desafio. Em produção mais robusta, Postgres seria a evolução natural.
- **Skills serializadas em JSON** reduzem a complexidade do escopo. Para filtros avançados, uma tabela `analysis_skills` seria uma evolução.
- **Gemini** foi usado como provedor de LLM por ser acessível via API e adequado para saída estruturada.
- **Validação Pydantic** protege o backend contra respostas malformadas ou fora do contrato.
- **Login com token Bearer** isola os dados por usuário sem expor currículos de outras contas.

## Limitações conhecidas

- PDF escaneado como imagem pode não ser extraído corretamente, pois OCR não foi implementado.
- SQLite em Render gratuito pode ser volátil; para produção real, recomenda-se Postgres.
- O token é simples e suficiente para o desafio, mas em produção seria recomendado usar OAuth, refresh token e rotação de segredo.

## Próximos passos

- Migrar SQLite para Postgres.
- Adicionar Alembic para migrations versionadas.
- Implementar recuperação de senha.
- Adicionar análise de múltiplas vagas.
- Adicionar retry/backoff na chamada do Gemini.
- Implementar OCR para PDFs escaneados.
