# Como colocar o Tradutor Educacional na web (grátis)

O projeto já está preparado para um único deploy: o Flask serve o frontend e a API. Basta escolher um serviço gratuito e configurar.

---

## 1. Render.com (recomendado)

1. **Conta**: crie em [render.com](https://render.com) (grátis).

2. **Repositório**: suba o projeto no GitHub (se ainda não estiver).

3. **New → Web Service**: conecte o repositório.

4. **Configuração**:
   - **Build Command**: `pip install -r requirements.txt`  
     (ou, se tiver na raiz: `pip install -r backend/requirements.txt` — ajuste o caminho se a estrutura for outra)
   - **Start Command**:  
     `cd backend && python app.py`  
     Ou, se o Render usar a raiz como working dir:  
     `gunicorn backend.app:app` (veja passo 5)
   - **Root Directory**: deixe em branco ou aponte para a pasta do projeto se necessário.

5. **Servir com Gunicorn** (produção):  
   Adicione ao `requirements.txt` (na pasta onde está o `app.py`):  
   `gunicorn`  
   Start Command: `gunicorn backend.app:app` (ou `gunicorn app:app` se estiver dentro de `backend/`).

6. **Variáveis de ambiente** (Settings → Environment):
   - `OPENAI_API_KEY` = sua chave da OpenAI (obrigatório).

7. **OCR (Tesseract)**: o plano grátis do Render não instala Tesseract por padrão. Opções:
   - Deixar o OCR desativado na hospedagem (tradução e resto funcionam).
   - Ou usar um Dockerfile que instale o Tesseract (exige conta e config no Render).

Depois do deploy, o link será algo como: `https://teu-servico.onrender.com`.

---

## 2. Railway.app

1. Conta em [railway.app](https://railway.app).
2. **New Project → Deploy from GitHub** e escolha o repositório.
3. **Variables**: adicione `OPENAI_API_KEY`.
4. Railway detecta Python; se não definir comando, use **Start Command**: `cd backend && gunicorn app:app` (e ponha `gunicorn` no `requirements.txt` do backend).
5. O frontend é servido pelo Flask na rota `/` (já configurado no `app.py`).

---

## 3. PythonAnywhere

1. Conta grátis em [pythonanywhere.com](https://www.pythonanywhere.com).
2. **Web** → **Add a new web app** → Flask.
3. Suba o código (por Git ou upload).
4. Aponte o **WSGI** para o teu `app` (ex.: `project/backend/app:app`).
5. Em **Web → Code** defina o **working directory** para a pasta do projeto (ou da app).
6. **Web → Static files**: opcional; o Flask já serve o frontend pelas rotas `/` e `/<path:path>`.
7. **Consola** → crie um ficheiro `.env` na pasta certa com `OPENAI_API_KEY=...` (ou use **Environment variables** na aba Web, se disponível).
8. **OCR**: no plano grátis o Tesseract pode não estar disponível; a tradução por texto continua a funcionar.

---

## 4. Importante antes de publicar

- **OPENAI_API_KEY**: nunca a coloques no código; usa sempre variáveis de ambiente no painel do serviço.
- **Custo da API**: a OpenAI cobra por uso; com uso moderado, o custo costuma ser baixo, mas acompanha no dashboard da OpenAI.
- **Frontend**: o `app.js` usa `API_BASE = ""` quando não está em `localhost:5000`, por isso em qualquer um destes hosts (mesma origem) as chamadas à API funcionam sem alterações.

---

## 5. Testar em local como em produção

Na pasta do projeto (raiz):

```bash
cd backend
pip install -r requirements.txt
pip install gunicorn
gunicorn app:app
```

Abre no browser `http://127.0.0.1:8000`. O frontend e a API devem responder como na web.

---

## Resumo

| Serviço          | Grátis | Fácil | OCR (Tesseract)   |
|------------------|--------|--------|-------------------|
| Render           | Sim*   | Sim    | Só com Docker     |
| Railway          | Créditos | Sim  | Possível com Docker |
| PythonAnywhere   | Sim    | Sim    | Pode não haver    |

\* Render “adormece” o app após inatividade; o primeiro acesso pode demorar alguns segundos.

Para “qualquer pessoa aceder de forma gratuita”, o mais direto é: **subir o repositório no GitHub** e fazer deploy no **Render** ou **Railway** com `OPENAI_API_KEY` nas variáveis de ambiente. O site ficará com um URL público (ex.: `https://teu-app.onrender.com`).
