import os
import re
import hashlib
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import pytesseract
from openai import OpenAI

app = Flask(__name__)
CORS(app)

# 👉 Ajuste se necessário (Windows)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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

def normalize_word(word: str) -> str:
    return word.strip().lower()

def text_cache_key(text: str, learned_words):
    base = text + "|" + ",".join(sorted(learned_words))
    return hashlib.sha256(base.encode("utf-8")).hexdigest()

# ---------------------------
# OpenAI helpers
# ---------------------------
def call_openai(prompt, max_tokens=1200, temperature=0.0):
    response = client.responses.create(
        model="gpt-4o-mini",
        input=prompt,
        max_output_tokens=max_tokens,
        temperature=temperature
    )

    out = ""
    for item in response.output:
        for c in item.content:
            if c.type == "output_text":
                out += c.text
    return out.strip()

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
        translated = text

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
        translated = ""

    WORD_CACHE[word] = translated
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
    text = data.get("text", "")
    learned_words = [normalize_word(w) for w in data.get("learnedWords", [])]

    translated_text = translate_text_cached(text, learned_words)
    frequencies = build_frequencies_with_translation(text)

    return jsonify({
        "translated": translated_text,
        "frequencies": frequencies
    })

@app.route("/ocr", methods=["POST"])
def ocr():
    if "image" not in request.files:
        return jsonify({"error": "Nenhuma imagem enviada"}), 400

    image = Image.open(request.files["image"])
    text = pytesseract.image_to_string(image, lang="ita+fra+eng+por")
    return jsonify({ "text": text })

if __name__ == "__main__":
    app.run(debug=True)
    