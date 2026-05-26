# Triador AIIA — Candidate Intelligence

Aplicação fullstack para **triagem inteligente de currículos com IA**, desenvolvida para o desafio técnico de Desenvolvedor(a) Fullstack Júnior da AIIA Labs.

O sistema permite que um usuário cadastre uma conta, faça login, envie um currículo em **PDF, DOCX ou TXT**, informe a descrição de uma vaga e receba uma análise estruturada de aderência feita por LLM, com histórico persistido e isolado por usuário.

---

## Links do projeto

### Aplicação em produção

**Frontend — Vercel**

https://triador-aiia-gemini-ux.vercel.app

### API em produção

**Backend — Render**

https://triador-aiia-gemini-ux.onrender.com

### Health check da API

https://triador-aiia-gemini-ux.onrender.com/api/health

### Documentação Swagger da API

https://triador-aiia-gemini-ux.onrender.com/docs

---

## Visão geral

O **Triador AIIA** foi construído para resolver um problema comum em processos seletivos: analisar rapidamente se um currículo possui aderência a uma vaga específica.

O fluxo principal é:

```txt
Usuário cria conta / faz login
        ↓
Envia currículo PDF, DOCX ou TXT
        ↓
Backend extrai o texto do documento
        ↓
Usuário informa a descrição da vaga
        ↓
Backend chama o Gemini
        ↓
Resposta da IA é validada com Pydantic
        ↓
Análise é persistida no banco do usuário
        ↓
Frontend exibe score, skills, experiência, resumo e histórico
```

---

## Funcionalidades implementadas

### Autenticação

- Cadastro de novos usuários.
- Login com token.
- Sessão persistida no navegador.
- Logout.
- Proteção das rotas de análise, histórico, upload e exclusão.
- Tratamento de sessão inválida ou usuário não encontrado.

### Isolamento de dados por usuário

Cada usuário possui dados isolados. As análises de um usuário não aparecem para outro.

A implementação usa:

- banco principal para usuários/autenticação;
- banco SQLite separado para as análises de cada usuário.

Exemplo:

```txt
backend/user_databases/user_1.db
backend/user_databases/user_2.db
backend/user_databases/user_3.db
```

Essa abordagem garante que currículos e análises fiquem separados por usuário.

### Upload e extração de documentos

O sistema aceita:

```txt
PDF
DOCX
TXT
```

O backend extrai o texto do arquivo no servidor e envia esse conteúdo para a análise.

Observação: PDFs escaneados como imagem podem não extrair texto corretamente, pois OCR não foi implementado.

### Análise com IA

A análise usa **Google Gemini** via API.

O backend solicita uma resposta estruturada contendo:

- nome do candidato;
- habilidades técnicas;
- anos aproximados de experiência;
- nota de aderência de 0 a 100;
- resumo justificando a decisão.

A saída do modelo não é salva diretamente. Antes de persistir, ela passa por validação com Pydantic.

### Validação da resposta da LLM

O projeto valida a saída da IA para evitar persistência de dados inválidos.

São tratados casos como:

- JSON inválido;
- campos ausentes;
- tipos incorretos;
- score fora de 0 a 100;
- lista de skills grande demais;
- falha de provedor;
- chave inválida;
- cota/limite excedido;
- modelo indisponível.

### Histórico

Cada usuário pode consultar o próprio histórico de análises.

O histórico exibe:

- candidato;
- score;
- data;
- resumo;
- skills;
- experiência estimada.

### Exclusão de análise

O usuário pode excluir análises cadastradas no histórico.

A exclusão respeita o isolamento por usuário. Um usuário não consegue excluir análise pertencente a outro usuário.

### Modo claro e modo escuro

O frontend possui alternância entre:

```txt
Modo claro
Modo escuro
```

A preferência visual é armazenada localmente no navegador.

### Interface responsiva

A interface foi ajustada para diferentes tamanhos de tela:

- desktop;
- notebook;
- tablet;
- mobile;
- telas próximas de 425px.

Foram feitos ajustes específicos na animação de fumaça/partículas para evitar overflow e permitir rolagem correta no celular.

### Animação visual

O frontend possui uma animação com partículas/fumaça no hero da aplicação.

Foram implementados:

- canvas responsivo;
- presets por tamanho de dispositivo;
- interação com mouse;
- interação com toque no mobile;
- ajuste de escala da palavra animada;
- correção de overflow horizontal;
- rolagem mobile com `pan-y`.

---

## Stack utilizada

### Frontend

- Next.js
- TypeScript
- CSS customizado
- Canvas API
- LocalStorage para sessão e tema
- Deploy na Vercel

### Backend

- Python
- FastAPI
- Pydantic
- Pydantic Settings
- SQLAlchemy
- SQLite
- Google GenAI SDK
- Deploy no Render

### IA

- Google Gemini API
- Modelo utilizado:

```txt
gemini-2.5-flash
```

### Banco de dados

- SQLite para persistência local e em produção.
- Banco principal para usuários.
- Bancos separados por usuário para análises.

---

## Arquitetura

```txt
frontend/
  src/
    app/
      page.tsx
      globals.css
      layout.tsx
    lib/
      api.ts

backend/
  app/
    api/
      routes.py
    db/
      user_database.py
    models/
      analysis.py
      user.py
    repositories/
      analysis_repository.py
      user_repository.py
    schemas/
      analysis.py
      auth.py
    services/
      analysis_service.py
      auth_service.py
      document_service.py
      llm_service.py
    core_config.py
    main.py
  requirements.txt
  .env.example
```

---

## Separação de responsabilidades

O backend foi organizado em camadas:

```txt
API routes
  ↓
Services
  ↓
Repositories
  ↓
Models / Database
```

### API routes

Responsáveis por receber requisições HTTP e retornar respostas.

### Services

Responsáveis pela regra de negócio:

- autenticação;
- análise;
- integração com LLM;
- extração de documentos.

### Repositories

Responsáveis por comunicação com o banco de dados.

### Schemas

Responsáveis por validação de entrada e saída com Pydantic.

---

## Principais endpoints

### Health check

```http
GET /api/health
```

Retorna o status da API, ambiente, provedor de LLM e banco.

### Cadastro

```http
POST /api/auth/register
```

Cria uma nova conta de usuário.

### Login

```http
POST /api/auth/login
```

Autentica o usuário e retorna token.

### Usuário logado

```http
GET /api/auth/me
```

Retorna dados do usuário autenticado.

### Extração de documento

```http
POST /api/documents/extract
```

Recebe PDF, DOCX ou TXT e retorna o texto extraído.

### Criar análise

```http
POST /api/analyses
```

Cria uma análise de aderência entre currículo e vaga.

### Listar histórico

```http
GET /api/analyses
```

Lista as análises do usuário autenticado.

### Excluir análise

```http
DELETE /api/analyses/{analysis_id}
```

Remove uma análise do histórico do usuário autenticado.

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
APP_NAME="Triador aiia"
ENVIRONMENT=local
DATABASE_URL=sqlite:///./triador.db
USER_DATABASE_DIR=./user_databases

CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

LLM_PROVIDER=gemini
GEMINI_API_KEY=sua_chave_gemini_aqui
GEMINI_MODEL=gemini-2.5-flash

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

SECRET_KEY=troque-por-uma-chave-longa-e-segura
```

### Frontend

Crie o arquivo:

```txt
frontend/.env.local
```

Exemplo local:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Exemplo produção:

```env
NEXT_PUBLIC_API_URL=https://triador-aiia-gemini-ux.onrender.com
```

Importante: não colocar `/api` no final da variável.

Certo:

```env
NEXT_PUBLIC_API_URL=https://triador-aiia-gemini-ux.onrender.com
```

Errado:

```env
NEXT_PUBLIC_API_URL=https://triador-aiia-gemini-ux.onrender.com/api
```

---

## Como rodar localmente

### Pré-requisitos

- Node.js
- npm
- Python 3.12
- Git
- Chave da Gemini API

---

## Rodando o backend

Entre na pasta do backend:

```powershell
cd C:\PORTIFOLIO\triador-aiia-gemini-ux\backend
```

Crie o ambiente virtual:

```powershell
py -3.12 -m venv .venv
```

Ative o ambiente:

```powershell
.\.venv\Scripts\Activate.ps1
```

Instale as dependências:

```powershell
python -m pip install -r requirements.txt
```

Crie o `.env`:

```powershell
copy .env.example .env
```

Configure sua chave Gemini no `.env`:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=sua_chave_gemini_aqui
GEMINI_MODEL=gemini-2.5-flash
```

Rode o backend:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Teste:

```txt
http://localhost:8000/api/health
```

---

## Rodando o frontend

Em outro terminal:

```powershell
cd C:\PORTIFOLIO\triador-aiia-gemini-ux\frontend
```

Instale as dependências:

```powershell
npm install
```

Crie o `.env.local`:

```powershell
copy .env.example .env.local
```

Garanta que esteja assim:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Rode:

```powershell
npm run dev
```

Abra:

```txt
http://localhost:3000
```

---

## Deploy

### Backend no Render

Configurações usadas:

```txt
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Variáveis no Render:

```env
APP_NAME=Triador aiia
ENVIRONMENT=production
DATABASE_URL=sqlite:///./triador.db
USER_DATABASE_DIR=./user_databases
LLM_PROVIDER=gemini
GEMINI_API_KEY=sua_chave_nova_do_gemini
GEMINI_MODEL=gemini-2.5-flash
SECRET_KEY=sua_chave_longa
PYTHON_VERSION=3.12.8
```

URL:

```txt
https://triador-aiia-gemini-ux.onrender.com
```

Health check:

```txt
https://triador-aiia-gemini-ux.onrender.com/api/health
```

---

### Frontend na Vercel

Configurações usadas:

```txt
Framework Preset: Next.js
Root Directory: frontend
Build Command: automático
Output Directory: automático
Install Command: automático
```

Variável na Vercel:

```env
NEXT_PUBLIC_API_URL=https://triador-aiia-gemini-ux.onrender.com
```

URL:

```txt
https://triador-aiia-gemini-ux.vercel.app
```

---

## Segurança

O projeto foi configurado para que chaves sensíveis não fiquem no código.

Nunca subir para o GitHub:

```txt
backend/.env
frontend/.env.local
backend/.venv
frontend/node_modules
frontend/.next
backend/*.db
backend/user_databases
```

O `.env.example` deve conter apenas valores fictícios.

Exemplo correto:

```env
GEMINI_API_KEY=sua_chave_gemini_aqui
```

Exemplo incorreto:

```env
GEMINI_API_KEY=AIza...
```

Caso uma chave seja exposta em print, chat ou GitHub, ela deve ser revogada no Google AI Studio e substituída por uma nova.

---

## Limite da Gemini API

Durante os testes, foi identificado que o Gemini pode retornar erro quando o limite diário gratuito é excedido.

Exemplo:

```txt
RPD: 24 / 20
```

Isso significa que o limite de requisições por dia foi ultrapassado.

Nessa situação, a aplicação está funcionando, mas o provedor bloqueia temporariamente novas análises.

Soluções possíveis:

- aguardar reset da cota;
- usar outra chave válida;
- ativar billing/aumentar limite;
- trocar temporariamente `LLM_PROVIDER=mock`.

---

## Modo mock

O projeto suporta modo mock para testes sem consumir Gemini.

No backend `.env`:

```env
LLM_PROVIDER=mock
```

Esse modo permite testar:

- login;
- upload;
- extração de documento;
- criação de análise simulada;
- histórico;
- exclusão.

---

## Decisões técnicas

### Por que Python/FastAPI?

Python foi escolhido pela produtividade com FastAPI, Pydantic, SQLAlchemy e SDKs de LLM. Isso permite entregar rapidamente um backend robusto, validado e bem separado em camadas.

### Por que SQLite?

SQLite foi escolhido por simplicidade, baixo atrito de setup e aderência ao escopo do desafio. Para produção real em escala, o próximo passo natural seria PostgreSQL.

### Por que Gemini?

Gemini foi escolhido por ser acessível via API, ter bom desempenho em tarefas de análise textual e permitir resposta em JSON estruturado.

### Por que validar a resposta da LLM?

O backend não deve confiar cegamente na resposta do modelo. A validação com Pydantic garante que apenas dados dentro do contrato sejam persistidos.

### Por que banco separado por usuário?

Para atender ao requisito de isolamento entre usuários, cada conta possui histórico separado. Isso impede que currículos/análises de uma pessoa apareçam para outra.

---

## Limitações conhecidas

- PDF escaneado como imagem pode não extrair texto sem OCR.
- SQLite no Render pode não ser ideal para produção de longo prazo.
- Render gratuito pode hibernar e demorar alguns segundos na primeira chamada.
- Gemini gratuito possui limite diário de requisições.
- Não há recuperação de senha.
- Não há painel administrativo.
- Não há envio de e-mail de confirmação.

---

## Próximos passos possíveis

- Migrar SQLite para PostgreSQL.
- Adicionar recuperação de senha.
- Adicionar painel administrativo.
- Implementar OCR para PDF escaneado.
- Implementar comparação de um currículo contra múltiplas vagas.
- Adicionar testes end-to-end.
- Adicionar logs estruturados.
- Adicionar observabilidade.
- Melhorar tratamento de rate limit com retry/backoff.
- Adicionar streaming de resposta da LLM.
- Criar dashboard com métricas agregadas.

---

## Como testar em produção

1. Acesse:

```txt
https://triador-aiia-gemini-ux.vercel.app
```

2. Crie uma conta.
3. Faça login.
4. Envie um currículo PDF, DOCX ou TXT.
5. Cole a descrição da vaga.
6. Clique em analisar.
7. Confira o resultado executivo.
8. Veja o histórico.
9. Teste a exclusão de uma análise.
10. Teste no celular.
11. Teste modo claro/escuro.

---

## Status atual

```txt
Frontend: online na Vercel
Backend: online no Render
Autenticação: implementada
Upload: implementado
Extração de texto: implementada
Gemini: configurado
Histórico por usuário: implementado
Exclusão: implementada
Modo claro/escuro: implementado
Responsividade mobile: ajustada
```

---

## Autor

Desenvolvido por **Diogo Reis**.

GitHub:

```txt
https://github.com/DioohReis
```

Projeto:

```txt
https://github.com/DioohReis/triador-aiia-gemini-ux
```
