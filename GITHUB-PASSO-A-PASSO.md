# Como subir o projeto no GitHub – passo a passo

## 1. Conta e repositório no GitHub

1. Se ainda não tiver, crie uma conta em **https://github.com**.
2. Entra no GitHub e clica em **“+”** (canto superior direito) → **“New repository”**.
3. Preenche:
   - **Repository name:** por exemplo `translator-app` (ou outro nome).
   - **Description:** opcional (ex.: “Tradutor educacional com OpenAI”).
   - Deixa **Public**.
   - **Não** marques “Add a README”, “Add .gitignore” nem “Choose a license” (o projeto já tem ficheiros).
4. Clica em **“Create repository”**.

---

## 2. Abrir o terminal na pasta do projeto

- No Windows: abre **PowerShell** ou **Prompt de Comando**.
- Vai à pasta do projeto, por exemplo:
  ```bash
  cd C:\FRED\API\translator-app
  ```

---

## 3. Inicializar o Git (se ainda não estiver)

Se o projeto **ainda não** for um repositório Git:

```bash
git init
```

Se já tiver sido inicializado antes, este passo pode dar aviso ou não fazer nada; pode ignorar.

---

## 4. Verificar o .gitignore

O ficheiro **`.gitignore`** na raiz do projeto deve incluir pelo menos:

- `.env` (para **nunca** subir a chave da API)
- `venv/` ou `.venv/`
- `__pycache__/`

Assim o `.env` e pastas desnecessárias não vão para o GitHub. **Nunca subas o ficheiro `.env`.**

---

## 5. Adicionar os ficheiros e fazer o primeiro commit

```bash
git add .
git status
```

Em `git status` confirma que **não** aparece `.env` na lista. Se aparecer, não faças `git add .env` e confirma o `.gitignore`.

Depois:

```bash
git commit -m "Primeiro commit: Tradutor Educacional"
```

---

## 6. Ligar ao repositório do GitHub

No GitHub, na página do repositório que criaste, vê o URL (por exemplo `https://github.com/TEU_USER/translator-app.git`).

No terminal:

```bash
git remote add origin https://github.com/TEU_USER/translator-app.git
```

Substitui **TEU_USER** pelo teu nome de utilizador no GitHub e **translator-app** pelo nome do repositório, se for diferente.

---

## 7. Enviar o código para o GitHub

Se o teu branch principal se chama `main`:

```bash
git branch -M main
git push -u origin main
```

Se o Git pedir utilizador e palavra-passe:
- **Utilizador:** o teu username do GitHub.
- **Palavra-passe:** já **não** podes usar a password da conta; tens de usar um **Personal Access Token (PAT)**.

### Como criar um Personal Access Token (PAT)

1. No GitHub: **Settings** (do teu perfil) → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
2. **“Generate new token (classic)”**.
3. Dá um nome (ex.: “translator-app”) e marca pelo menos **repo**.
4. Gera e **copia o token** (só aparece uma vez).
5. Quando o Git pedir password, cola esse token em vez da password.

---

## 8. Confirmar no GitHub

Atualiza a página do repositório no browser. Deves ver todos os ficheiros do projeto (backend, frontend, etc.) **sem** o ficheiro `.env`.

---

## Resumo dos comandos (se começares do zero na pasta do projeto)

```bash
cd C:\FRED\API\translator-app
git init
git add .
git commit -m "Primeiro commit: Tradutor Educacional"
git remote add origin https://github.com/TEU_USER/translator-app.git
git branch -M main
git push -u origin main
```

(Substitui `TEU_USER` e `translator-app` pelo teu user e nome do repo.)

---

## Depois de subir

- Para **atualizar** o GitHub no futuro:
  ```bash
  git add .
  git commit -m "Descrição do que mudaste"
  git push
  ```
- Quem clonar o projeto terá de criar um `.env` local com `OPENAI_API_KEY` (e opcionalmente `TESSERACT_PATH`), como no teu ambiente.

Se quiseres, no próximo passo podemos ver como fazer deploy deste repositório (por exemplo no Render) usando o ficheiro **HOSPEDAGEM.md**.
