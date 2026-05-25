# Triador AIIA — Candidate Intelligence

Aplicação fullstack para triagem inteligente de currículos. O sistema recebe um currículo e uma descrição de vaga, extrai o texto do documento, envia os dados para uma LLM, valida a resposta estruturada no backend, persiste a análise em banco relacional e exibe o histórico em uma interface web responsiva.

## Links do projeto

- **Frontend em produção:** https://triador-aiia-gemini-ux.vercel.app
- **Backend em produção:** https://triador-aiia-gemini-ux.onrender.com
- **Health check da API:** https://triador-aiia-gemini-ux.onrender.com/api/health
- **Documentação Swagger da API:** https://triador-aiia-gemini-ux.onrender.com/docs
- **Repositório:** https://github.com/DioohReis/triador-aiia-gemini-ux

> Observação: o backend está hospedado no Render. Em plano gratuito, a primeira requisição pode demorar alguns segundos caso o serviço esteja em repouso.

---

## Visão geral

O **Triador AIIA** foi desenvolvido para apoiar processos de recrutamento técnico. A aplicação permite analisar rapidamente se um candidato possui aderência a uma vaga específica, retornando uma avaliação estruturada com:

- nome do candidato;
- habilidades técnicas identificadas;
- anos aproximados de experiência;
- nota de aderência de 0 a 100;
- resumo executivo justificando a nota;
- histórico persistido das análises realizadas.

Além do fluxo base de currículo + vaga, o projeto inclui upload de arquivos **PDF, DOCX e TXT**, alternância entre **modo claro e modo escuro**, layout responsivo para mobile e exclusão de análises do histórico.

---

## Funcionalidades implementadas

- Upload de currículo em PDF, DOCX ou TXT.
- Extração de texto no backend.
- Campo para descrição da vaga.
- Integração com Gemini via API.
- Provider `mock` para execução local sem chave de IA.
- Validação rígida da resposta da LLM com Pydantic.
- Tratamento controlado de JSON inválido, campos ausentes e tipos incorretos.
- Persistência das análises em SQLite.
- Histórico consultável pela interface.
- Exclusão de análise duplicada ou indesejada.
- Interface em Next.js com TypeScript.
- Modo claro e modo escuro com preferência salva no navegador.
- Layout responsivo para desktop e mobile.
- Deploy do frontend na Vercel.
- Deploy do backend no Render.
- `.env.example` para configuração segura.
- `.python-version` fixando Python 3.12 para deploy estável.

---

## Stack utilizada

### Frontend

- Next.js
- TypeScript
- CSS responsivo
- Fetch API
- Deploy na Vercel

### Backend

- Python 3.12
- FastAPI
- Pydantic
- SQLAlchemy
- SQLite
- Google GenAI SDK
- Uvicorn
- Deploy no Render

### IA

- Gemini API
- Modelo configurável via variável de ambiente
- Modo mock para desenvolvimento local

### Banco de dados

- SQLite em ambiente local e produção simples.
- As skills são persistidas como JSON serializado para manter o escopo enxuto.

---

## Arquitetura

```txt
Frontend Next.js
    |
    | HTTP / JSON
    v
Backend FastAPI
    |
    | Serviço de análise
    v
Provider LLM Gemini
    |
    | Validação Pydantic
    v
Repository SQLAlchemy
    |
    v
SQLite
```

### Separação de responsabilidades

```txt
backend/app/api
    Rotas HTTP e tratamento de requisições.

backend/app/services
    Regras de negócio, prompt, chamada ao Gemini e validação da resposta.

backend/app/repositories
    Acesso ao banco de dados.

backend/app/models
    Modelos SQLAlchemy.

backend/app/schemas
    Contratos Pydantic de entrada, saída e validação.

frontend/src/app
    Interface principal, layout global e estilos.

frontend/src/lib
    Funções de comunicação com a API.
```

---

## Principais endpoints

### Health check

```http
GET /api/health
```

Retorno esperado:

```json
{
  "status": "ok",
  "app": "Triador aiia",
  "environment": "production",
  "llm_provider": "gemini",
  "database": "sqlite"
}
```

### Listar análises

```http
GET /api/analyses
```

### Criar análise

```http
POST /api/analyses
```

Body:

```json
{
  "resume_text": "Texto extraído do currículo...",
  "job_text": "Descrição da vaga..."
}
```

### Extrair documento

```http
POST /api/documents/extract
```

Aceita arquivo `PDF`, `DOCX` ou `TXT`.

### Excluir análise

```http
DELETE /api/analyses/{analysis_id}
```

---

## Variáveis de ambiente

### Backend

Crie o arquivo:

```txt
backend/.env
```

Com base em:

```txt
backend/.env.example
```

Exemplo:

```env
APP_NAME=Triador aiia
ENVIRONMENT=local
DATABASE_URL=sqlite:///./triador.db

LLM_PROVIDER=gemini
GEMINI_API_KEY=sua_chave_gemini_aqui
GEMINI_MODEL=gemini-2.5-flash
```

Para rodar sem IA real:

```env
LLM_PROVIDER=mock
```

### Frontend

Crie o arquivo:

```txt
frontend/.env.local
```

Com base em:

```txt
frontend/.env.example
```

Ambiente local:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Produção:

```env
NEXT_PUBLIC_API_URL=https://triador-aiia-gemini-ux.onrender.com
```

---

## Como rodar localmente

### Pré-requisitos

- Python 3.12
- Node.js 18+
- npm
- Git

### 1. Clonar o repositório

```bash
git clone https://github.com/DioohReis/triador-aiia-gemini-ux.git
cd triador-aiia-gemini-ux
```

### 2. Rodar o backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

Teste:

```txt
http://localhost:8000/api/health
```

Documentação da API:

```txt
http://localhost:8000/docs
```

### 3. Rodar o frontend

Em outro terminal:

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

---

## Como usar

1. Acesse a aplicação.
2. Envie um currículo em PDF, DOCX ou TXT.
3. Aguarde a extração do texto.
4. Cole a descrição da vaga.
5. Clique em analisar.
6. Consulte a nota, skills, experiência e resumo.
7. Veja a análise registrada no histórico.
8. Exclua registros duplicados quando necessário.

---

## Decisões técnicas

### Por que Python no backend?

Python foi escolhido pela produtividade com FastAPI, Pydantic, SQLAlchemy e bibliotecas de extração de documentos. A stack permite criar rapidamente uma API robusta, com contratos claros e validação forte para respostas de IA.

### Por que FastAPI?

FastAPI facilita a criação de APIs HTTP tipadas, com documentação automática via Swagger e integração natural com Pydantic.

### Por que SQLite?

SQLite foi escolhido por simplicidade e aderência ao escopo do desafio. Ele permite rodar o projeto localmente sem depender de serviços externos. Em produção real, a evolução natural seria Postgres.

### Por que Gemini?

Gemini foi escolhido por oferecer uma API acessível para integração com LLM e por permitir retorno em JSON, facilitando a validação estruturada no backend.

### Por que skills serializadas?

As habilidades foram armazenadas como JSON serializado para manter o escopo enxuto. Em uma versão com relatórios avançados, filtros por skill ou analytics, a melhor evolução seria uma tabela relacional `analysis_skills`.

---

## Estratégia de LLM

O backend não persiste diretamente a resposta bruta da LLM. O fluxo é:

```txt
Resposta Gemini
    ↓
Extração de JSON
    ↓
Validação Pydantic
    ↓
Normalização de campos
    ↓
Persistência
```

A resposta esperada contém:

```json
{
  "candidate_name": "Nome do candidato",
  "skills": ["Python", "FastAPI", "SQL"],
  "years_experience": 2,
  "fit_score": 85,
  "summary": "Resumo justificando a aderência."
}
```

Se a LLM retornar JSON inválido, campos ausentes ou tipos incompatíveis, o backend falha de forma controlada e não persiste dados inválidos.

---

## Segurança

- Chaves de API ficam apenas em variáveis de ambiente.
- `.env` e `.env.local` não devem ser enviados ao GitHub.
- `.env.example` contém apenas exemplos sem segredos.
- A chave Gemini nunca deve ser exposta no frontend.
- CORS configurado para ambiente local e domínio de produção.

---

## Deploy

### Backend — Render

Configurações usadas:

```txt
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Variáveis:

```env
PYTHON_VERSION=3.12.8
APP_NAME=Triador aiia
ENVIRONMENT=production
DATABASE_URL=sqlite:///./triador.db
LLM_PROVIDER=gemini
GEMINI_API_KEY=sua_chave_gemini
GEMINI_MODEL=gemini-2.5-flash
```

### Frontend — Vercel

Configurações usadas:

```txt
Framework Preset: Next.js
Root Directory: frontend
Build Command: default
Output Directory: default
Install Command: default
```

Variável:

```env
NEXT_PUBLIC_API_URL=https://triador-aiia-gemini-ux.onrender.com
```

---

## Testes manuais recomendados

- Abrir o frontend publicado.
- Validar o health check da API.
- Enviar currículo PDF.
- Enviar currículo DOCX.
- Enviar currículo TXT.
- Testar vaga compatível.
- Testar vaga incompatível.
- Validar histórico.
- Excluir análise.
- Alternar modo claro e escuro.
- Testar no celular.
- Testar primeira abertura após backend do Render estar em repouso.

---

## Limitações conhecidas

- PDF escaneado como imagem pode não ter texto extraível sem OCR.
- SQLite em produção simples não é ideal para alta concorrência.
- O backend hospedado gratuitamente pode entrar em repouso e demorar na primeira requisição.
- A análise depende da qualidade do texto extraído e da descrição da vaga.
- O sistema não possui autenticação porque isso ficou fora do escopo principal.

---

## Próximos passos

- Migrar banco de SQLite para Postgres.
- Adicionar autenticação.
- Adicionar análise de um currículo contra múltiplas vagas.
- Adicionar retry com backoff na chamada da LLM.
- Adicionar streaming de resposta.
- Implementar OCR para PDFs escaneados.
- Criar testes automatizados mais amplos.
- Criar dashboard analítico com distribuição de scores.
- Normalizar skills em tabela relacional própria.

---

## Status de aderência ao desafio

O projeto atende ao núcleo solicitado:

- aplicação web fullstack;
- frontend em Next.js;
- backend em Python;
- integração com LLM;
- banco relacional;
- persistência;
- histórico;
- validação da resposta da IA;
- configuração por variáveis de ambiente;
- deploy público;
- upload de PDF como bônus.

