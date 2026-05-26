# Patch: autenticação, banco por usuário e sessão expirada

Este patch mantém o frontend visual que já existe. As alterações são cirúrgicas para corrigir autenticação, Gemini e isolamento de dados.

## O que foi alterado

- `backend/app/db/user_database.py`: cria um SQLite separado para cada usuário em `backend/user_databases/user_<id>.db`.
- `backend/app/api/routes.py`: análises/listagem/exclusão usam o banco individual do usuário logado.
- `backend/app/core_config.py`: adiciona `USER_DATABASE_DIR`.
- `backend/app/services/auth_service.py`: troca o erro "Usuário não encontrado" por sessão expirada.
- `backend/app/services/llm_service.py`: usa `settings.gemini_api_key` e `settings.gemini_model`, evitando falha de `.env` no local/Render.
- `frontend/src/lib/api.ts`: adiciona `ApiError` com status HTTP.
- `frontend/src/app/page.tsx`: limpa token antigo quando o backend responder 401/403, evitando travar em "Usuário não encontrado".
- `.gitignore`: ignora bancos individuais dos usuários.

## Variável nova

No `.env` local e no Render, use:

```env
USER_DATABASE_DIR=./user_databases
```

## Como aplicar

Copie os arquivos deste patch por cima do seu projeto respeitando as mesmas pastas.

Depois rode:

```powershell
cd C:\PORTIFOLIO\triador-aiia-gemini-ux\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --port 8000
```

Em outro terminal:

```powershell
cd C:\PORTIFOLIO\triador-aiia-gemini-ux\frontend
npm run dev
```

Se aparecer sessão expirada, faça logout/login novamente ou limpe o storage do navegador. Isso acontece quando o token antigo aponta para um usuário que não existe mais no banco atual.
