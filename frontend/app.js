const learnedKey = "learnedWords";

/* Storage */
function getLearnedWords() {
  return JSON.parse(localStorage.getItem(learnedKey)) || [];
}
function saveLearnedWord(word) {
  const learned = getLearnedWords();
  const norm = normalizeWord(word);
  if (!learned.map(normalizeWord).includes(norm)) {
    learned.push(word);
    localStorage.setItem(learnedKey, JSON.stringify(learned));
  }
}

/* Normalização */
function normalizeWord(word) {
  return word.toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:()"']/g, "");
}

/* Highlight */
function highlightLearnedWords(text) {
  const learned = getLearnedWords().map(normalizeWord);
  return text.replace(/(\p{L}+)/gu, (m) =>
    learned.includes(normalizeWord(m)) ? `<span class="learned-word">${m}</span>` : m
  );
}

/* Traduzir */
document.getElementById("translateBtn").addEventListener("click", async (e) => {
  e.preventDefault();

  const text = document.getElementById("inputText").value;
  const result = document.getElementById("result");
  const list = document.getElementById("frequencyList");

  result.textContent = "Traduzindo...";
  list.innerHTML = "";

  try {
    const learnedWords = getLearnedWords();

    const res = await fetch("http://127.0.0.1:5000/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, learnedWords })
    });

    const data = await res.json();

    result.innerHTML = highlightLearnedWords(data.translated || "");

    (data.frequencies || []).forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.word} → ${item.translation || "—"} (${item.count})`;

      if (learnedWords.map(normalizeWord).includes(normalizeWord(item.word))) {
        li.style.opacity = "0.6";
        li.textContent += " ✔ aprendida";
      } else {
        const btn = document.createElement("button");
        btn.textContent = "✔ Aprendi";
        btn.onclick = () => {
          saveLearnedWord(item.word);
          li.style.opacity = "0.6";
          btn.remove();
          li.textContent += " ✔ aprendida";
          result.innerHTML = highlightLearnedWords(result.innerText);
        };
        li.appendChild(btn);
      }
      list.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    result.textContent = "Erro ao conectar com o backend";
  }
});

/* OCR */
document.getElementById("ocrBtn").addEventListener("click", async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById("imageInput");
  if (!fileInput.files[0]) return alert("Selecione uma imagem.");

  const fd = new FormData();
  fd.append("image", fileInput.files[0]);

  try {
    const res = await fetch("http://127.0.0.1:5000/ocr", { method: "POST", body: fd });
    const data = await res.json();
    document.getElementById("inputText").value = data.text || "";
  } catch (e) {
    alert("Erro ao usar OCR");
    console.error(e);
  }
});
