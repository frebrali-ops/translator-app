import os
import re
import time
import hashlib
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image
import pytesseract
from dotenv import load_dotenv
from openai import OpenAI

# ---------------------------
# Configuração básica
# ---------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
FRONTEND_DIR = os.path.join(PROJECT_DIR, "frontend")
ENV_PATH = os.path.join(PROJECT_DIR, ".env")

if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)

app = Flask(__name__)
CORS(app)

# Caminho do Tesseract via .env (com fallback)
tesseract_path = os.getenv("TESSERACT_PATH")
if tesseract_path and os.path.exists(tesseract_path):
    pytesseract.pytesseract.tesseract_cmd = tesseract_path

openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise RuntimeError("OPENAI_API_KEY não definido no .env ou ambiente")

client = OpenAI(api_key=openai_api_key)

# ---------------------------
# Stopwords (EN / FR / IT)
# ---------------------------
STOPWORDS = set("""
a an the and or but if then else
i you he she it we they me my mine your yours his her hers our ours their theirs
of to in on at by for with about as into like through after over between out against during without before under around among

le la les un une des du de et ou mais si donc alors
je tu il elle nous vous ils elles me te se mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs
à en par pour sur avec sans sous entre chez dans

il lo la i gli le un una di e o ma se quindi allora
mi ti si mio mia miei mie tuo tua tuoi tue suo sua suoi sue nostro nostra nostri nostre vostro vostra vostri vostre
che è una uno un una di del della dei delle nel nella nei nelle al allo alla agli alle
""".split())

# ---------------------------
# Cache
# ---------------------------
TEXT_CACHE = {}
WORD_CACHE = {}
SUMMARY_CACHE = {}
# Cache para tradução com aprendidas preservadas (texto com placeholders)
TRANSLATE_WITH_LEARNED_CACHE = {}

def normalize_word(word: str) -> str:
    return word.strip().lower()

def text_cache_key(text: str, learned_words):
    base = text + "|" + ",".join(sorted(learned_words))
    return hashlib.sha256(base.encode("utf-8")).hexdigest()

# ---------------------------
# OpenAI helpers (com retry em erros de ligação)
# ---------------------------
def call_openai(prompt, max_tokens=1200, temperature=0.0):
    last_error = None
    for attempt in range(3):
        try:
            response = client.responses.create(
                model="gpt-4o-mini",
                input=prompt,
                max_output_tokens=max_tokens,
                temperature=temperature,
                timeout=60.0,
            )
            out = ""
            for item in response.output:
                for c in item.content:
                    if c.type == "output_text":
                        out += c.text
            return out.strip()
        except Exception as e:
            last_error = e
            is_connection_error = "connection" in str(e).lower() or "timeout" in str(e).lower()
            if is_connection_error and attempt < 2:
                time.sleep(1 + attempt)
                continue
            raise last_error

def translate_text_cached(text: str, learned_words):
    key = text_cache_key(text, learned_words)
    if key in TEXT_CACHE:
        return TEXT_CACHE[key]

    learned_list = ", ".join(learned_words) if learned_words else "nenhuma"
    prompt = f"""
Traduza TODO o texto abaixo para português do Brasil.
Regras:
- Não traduza as palavras aprendidas: {learned_list}
- Retorne apenas o texto traduzido.

Texto:
{text}
"""
    try:
        translated = call_openai(prompt, max_tokens=2000, temperature=0.0)
    except Exception as e:
        print("🔥 ERRO OPENAI (texto):", e)
        raise

    TEXT_CACHE[key] = translated
    return translated

def translate_word_cached(word: str):
    if word in WORD_CACHE:
        return WORD_CACHE[word]

    prompt = f"Traduza a palavra '{word}' para português do Brasil. Responda apenas com a tradução."
    try:
        translated = call_openai(prompt, max_tokens=32, temperature=0.0)
    except Exception as e:
        print("🔥 ERRO OPENAI (palavra):", e)
        raise

    WORD_CACHE[word] = translated
    return translated


def translate_keeping_learned(text: str, learned_words: list):
    """Traduz o texto para PT-BR mantendo palavras aprendidas no idioma original.
    Substitui cada palavra aprendida por um placeholder, traduz, depois recoloca as palavras.
    """
    key = text_cache_key(text, learned_words)
    if key in TRANSLATE_WITH_LEARNED_CACHE:
        return TRANSLATE_WITH_LEARNED_CACHE[key]

    learned_set = set(learned_words)
    if not learned_set:
        try:
            out = translate_text_cached(text, [])
        except Exception as e:
            print("🔥 ERRO translate_keeping_learned:", e)
            out = text
        TRANSLATE_WITH_LEARNED_CACHE[key] = out
        return out

    # Palavras são sequências de letras (incl. acentos) e apóstrofo
    pattern = re.compile(r"\b([\wÀ-ÿ']+)\b")
    learned_order = []

    def replace_with_placeholder(m):
        w = m.group(1)
        if normalize_word(w) in learned_set:
            idx = len(learned_order)
            learned_order.append(w)
            return f"__K{idx}__"
        return w

    text_with_placeholders = pattern.sub(replace_with_placeholder, text)
    placeholders_str = ", ".join(f"__K{i}__" for i in range(len(learned_order)))

    prompt = f"""Traduza o texto abaixo para português do Brasil.
Regras:
- Mantenha os tokens {placeholders_str} exatamente como estão; NÃO os traduza nem altere.
- Retorne apenas o texto traduzido.

Texto:
{text_with_placeholders}
"""
    try:
        translated = call_openai(prompt, max_tokens=2000, temperature=0.0)
    except Exception as e:
        print("🔥 ERRO OPENAI (tradução com aprendidas):", e)
        translated = text_with_placeholders

    for i, orig in enumerate(learned_order):
        translated = translated.replace(f"__K{i}__", orig)

    TRANSLATE_WITH_LEARNED_CACHE[key] = translated
    return translated


# ---------------------------
# Frequências
# ---------------------------
def build_frequencies_with_translation(text: str):
    words = re.findall(r"\b[\wÀ-ÿ']+\b", text.lower())

    freq = {}
    for w in words:
        if w in STOPWORDS:
            continue
        freq[w] = freq.get(w, 0) + 1

    # remove palavras com 1 ocorrência e ordena desc
    filtered = [(w, c) for w, c in freq.items() if c > 1]
    filtered.sort(key=lambda x: x[1], reverse=True)

    return [
        {"word": w, "translation": translate_word_cached(w), "count": c}
        for w, c in filtered
    ]

# ---------------------------
# Rotas
# ---------------------------
@app.route("/translate", methods=["POST"])
def translate():
    data = request.json or {}
    text = data.get("text", "") or ""
    learned_words = [normalize_word(w) for w in data.get("learnedWords", [])]
    with_learned_version = data.get("withLearnedVersion", False)

    # Limite simples de tamanho para evitar custos/exceções absurdos
    if len(text) > 20_000:
        return jsonify({"error": "Texto muito longo. Limite de ~20.000 caracteres."}), 400

    try:
        translated_text = translate_text_cached(text, learned_words)
        frequencies = build_frequencies_with_translation(text)
    except Exception as e:
        print("🔥 ERRO /translate:", e)
        return jsonify({"error": "Erro ao traduzir o texto."}), 500

    payload = {
        "translated": translated_text,
        "frequencies": frequencies,
    }

    if with_learned_version:
        try:
            translated_with_learned = translate_keeping_learned(text, learned_words)
            payload["translatedWithLearned"] = translated_with_learned
        except Exception as e:
            print("🔥 ERRO /translate (withLearnedVersion):", e)
            payload["translatedWithLearned"] = translated_text

    return jsonify(payload)


def summarize_text_cached(text: str) -> str:
    """Gera um resumo conciso do texto em português."""
    if len(text.strip()) < 50:
        return text.strip()
    key = hashlib.sha256(("summary:" + text).encode("utf-8")).hexdigest()
    if key in SUMMARY_CACHE:
        return SUMMARY_CACHE[key]
    prompt = f"""Resuma o texto abaixo em português do Brasil de forma clara e concisa (alguns parágrafos curtos).
Não invente informações; mantenha apenas o que está no texto.

Texto:
{text}
"""
    try:
        summary = call_openai(prompt, max_tokens=800, temperature=0.2)
    except Exception as e:
        print("🔥 ERRO OPENAI (resumo):", e)
        raise
    SUMMARY_CACHE[key] = summary
    return summary


@app.route("/summary", methods=["POST"])
def summary():
    data = request.json or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Nenhum texto enviado."}), 400
    if len(text) > 20_000:
        return jsonify({"error": "Texto muito longo para resumir."}), 400
    try:
        summary_text = summarize_text_cached(text)
    except Exception as e:
        print("🔥 ERRO /summary:", e)
        return jsonify({"error": "Erro ao gerar resumo."}), 500
    return jsonify({"summary": summary_text})


@app.route("/word", methods=["POST"])
def translate_word():
    data = request.json or {}
    word = (data.get("word") or "").strip()
    if not word:
        return jsonify({"error": "Nenhuma palavra enviada."}), 400

    try:
        translated = translate_word_cached(word)
    except Exception as e:
        print("🔥 ERRO /word:", e)
        return jsonify({"error": "Erro ao traduzir a palavra."}), 500

    return jsonify({"translation": translated})

@app.route("/ocr", methods=["POST"])
def ocr():
    if "image" not in request.files:
        return jsonify({"error": "Nenhuma imagem enviada"}), 400

    try:
        image = Image.open(request.files["image"])
        text = pytesseract.image_to_string(image, lang="ita+fra+eng+por")
    except Exception as e:
        print("🔥 ERRO /ocr:", e)
        return jsonify({"error": "Erro ao processar imagem com OCR."}), 500

    return jsonify({"text": text})


@app.route("/")
def index():
    """Serve o frontend em produção."""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>", methods=["GET", "HEAD"])
def frontend_static(path):
    """Serve app.js, style.css, etc. Apenas GET/HEAD para não capturar POST da API."""
    if os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug)
