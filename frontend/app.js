const learnedKey = "learnedWords";
const historyKey = "translationHistory";
const rankingKey = "wordRanking";
const rankingExcludedKey = "wordRankingExcluded";
function getApiBase() {
  if (typeof window === "undefined") return "";
  const p = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  if (p === "file:") return "http://127.0.0.1:5000";
  if (host === "localhost" || host === "127.0.0.1") {
    if (port === "5000") return "";
    return "http://127.0.0.1:5000";
  }
  return "";
}
const API_BASE = getApiBase();

/* Storage: lista de { word, lang } com compatibilidade para antigo formato (só string) */
function getLearnedEntries() {
  const raw = JSON.parse(localStorage.getItem(learnedKey)) || [];
  return raw.map((item) => {
    if (typeof item === "string") {
      return { word: item, lang: guessLanguage(item) };
    }
    return { word: item.word || "", lang: item.lang || "en" };
  });
}

function getLearnedWords() {
  return getLearnedEntries().map((e) => e.word);
}

function saveLearnedWord(word, lang) {
  const entries = getLearnedEntries();
  const norm = normalizeWord(word);
  if (entries.some((e) => normalizeWord(e.word) === norm)) return;
  entries.push({ word, lang: lang || "en" });
  localStorage.setItem(learnedKey, JSON.stringify(entries));
}

function getHistory() {
  return JSON.parse(localStorage.getItem(historyKey)) || [];
}
function addHistoryEntry(source, translated) {
  const now = new Date();
  const entry = {
    id: Date.now(),
    source,
    translated,
    createdAt: now.toISOString(),
  };
  const history = getHistory();
  history.push(entry);
  const limited = history.slice(-20);
  localStorage.setItem(historyKey, JSON.stringify(limited));
}

/* Ranking global: frequência acumulada por idioma */
function getRanking() {
  const raw = JSON.parse(localStorage.getItem(rankingKey)) || {};
  return {
    en: raw.en || {},
    fr: raw.fr || {},
    it: raw.it || {},
  };
}

function getExcludedRankingWords() {
  const raw = JSON.parse(localStorage.getItem(rankingExcludedKey)) || {};
  return {
    en: Array.isArray(raw.en) ? raw.en : [],
    fr: Array.isArray(raw.fr) ? raw.fr : [],
    it: Array.isArray(raw.it) ? raw.it : [],
  };
}

function addExcludedRankingWord(lang, word) {
  const w = (word || "").trim();
  if (!lang || !w) return;
  const excluded = getExcludedRankingWords();
  if (!excluded[lang]) excluded[lang] = [];
  if (!excluded[lang].includes(w)) excluded[lang].push(w);
  localStorage.setItem(rankingExcludedKey, JSON.stringify(excluded));
  const ranking = getRanking();
  if (ranking[lang] && ranking[lang][w] !== undefined) {
    delete ranking[lang][w];
    localStorage.setItem(rankingKey, JSON.stringify(ranking));
  }
}

function addToRanking(lang, frequencies) {
  if (!lang || !frequencies || !frequencies.length) return;
  const excluded = getExcludedRankingWords();
  const excludedSet = new Set((excluded[lang] || []).map((w) => w.toLowerCase()));
  const ranking = getRanking();
  const byLang = ranking[lang];
  if (!byLang) ranking[lang] = {};
  frequencies.forEach((item) => {
    const w = (item.word || "").trim();
    if (!w || excludedSet.has(w.toLowerCase())) return;
    ranking[lang][w] = (ranking[lang][w] || 0) + (item.count || 1);
  });
  localStorage.setItem(rankingKey, JSON.stringify(ranking));
}

/* Normalização */
function normalizeWord(word) {
  return word
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:()"']/g, "");
}

/* Detecta idioma do texto pelas palavras mais comuns (para definir idioma ao traduzir) */
function detectSourceLanguage(text) {
  if (!text || typeof text !== "string") return "en";
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const words = lower.match(/\b[\wàâäéèêëîïôùûüÿçœæìòàùèéóíú']+\b/g) || [];

  const fr = ["le", "la", "les", "est", "sont", "des", "une", "dans", "pour", "avec", "que", "qui", "pas", "sur", "mais", "nous", "vous", "aux", "cette", "son", "sans", "été", "fait", "noël", "célébration", "famille", "tous", "jour", "maison", "après", "avant", "sous", "très", "plus", "bien", "comme", "tout", "leurs", "autres", "même", "être", "avoir", "fait", "peut", "donc", "alors"];
  const it = ["il", "ella", "sono", "dei", "delle", "una", "che", "con", "per", "non", "sul", "ma", "noi", "voi", "questa", "questo", "anche", "sempre", "molto", "più", "come", "dopo", "prima", "bene", "qui", "così", "tutti", "giorno", "casa", "anni", "padre", "madre", "fratello", "sorella", "amici", "molto", "sempre", "solo", "solo", "ancora", "oggi", "domani", "ieri", "niente", "qualcosa", "tutto", "stato", "essere", "avere", "fare", "andare", "venire", "dire", "sapere", "volere", "dovere", "potere"];
  const en = ["the", "is", "are", "and", "to", "of", "in", "for", "on", "with", "that", "this", "not", "you", "we", "they", "have", "has", "was", "were", "been", "will", "would", "could", "about", "from", "into", "out", "all", "each", "every", "when", "where", "what", "which", "who", "how", "some", "many", "other", "only", "own", "same", "than", "them", "then", "there", "these", "those", "through", "until", "very", "just", "also", "back", "after", "before", "being", "because", "between", "both", "during", "over", "again", "once", "here", "right", "should", "people", "world", "place", "year", "day", "time", "way", "life", "work", "part", "number", "house", "family", "friend", "school", "city", "park", "office", "restaurant"];

  const norm = (w) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const count = (list) => {
    const set = new Set(list.map(norm));
    return words.filter((w) => set.has(norm(w))).length;
  };

  const scoreFr = count(fr);
  const scoreIt = count(it);
  const scoreEn = count(en);

  if (scoreFr >= scoreIt && scoreFr >= scoreEn && scoreFr > 0) return "fr";
  if (scoreIt >= scoreEn && scoreIt > 0) return "it";
  return "en";
}

function setSourceLangUI(lang) {
  currentSourceLang = lang || "en";
}

/* Highlight */
function buildHighlightSet() {
  // Apenas as palavras aprendidas no idioma original,
  // para que o destaque sirva como reforço de vocabulário.
  const baseLearned = getLearnedWords().map(normalizeWord);
  return new Set(baseLearned);
}

function highlightLearnedWords(text) {
  const highlightSet = buildHighlightSet();
  return text.replace(/(\p{L}+)/gu, (m) =>
    highlightSet.has(normalizeWord(m))
      ? `<span class="learned-word" data-word="${m}">${m}</span>`
      : m
  );
}

/* UI helpers */
const inputText = document.getElementById("inputText");
const translatedResult = document.getElementById("translatedResult");
const originalResult = document.getElementById("originalResult");
const translatedLearnedResult = document.getElementById(
  "translatedLearnedResult"
);
const list = document.getElementById("frequencyList");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const errorBox = document.getElementById("errorBox");
const charCount = document.getElementById("charCount");
const translateBtn = document.getElementById("translateBtn");
const ocrBtn = document.getElementById("ocrBtn");
const clearBtn = document.getElementById("clearBtn");
const hideLearnedToggle = document.getElementById("hideLearnedToggle");
const historyList = document.getElementById("historyList");
const learnedList = document.getElementById("learnedList");
const exportLearnedBtn = document.getElementById("exportLearnedBtn");
const clearLearnedBtn = document.getElementById("clearLearnedBtn");
const learnedPanel = document.getElementById("learnedPanel");
const learnedHeader = document.getElementById("learnedHeader");
const learnedChevron = document.getElementById("learnedChevron");
const historyHeader = document.getElementById("historyHeader");
const historyPanel = document.getElementById("historyPanel");
const historyChevron = document.getElementById("historyChevron");
const tabTranslated = document.getElementById("tabTranslated");
const tabOriginal = document.getElementById("tabOriginal");
const tabTranslatedLearned = document.getElementById("tabTranslatedLearned");
const rankingHeader = document.getElementById("rankingHeader");
const rankingPanel = document.getElementById("rankingPanel");
const rankingChevron = document.getElementById("rankingChevron");
const rankingList = document.getElementById("rankingList");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const copyResultBtn = document.getElementById("copyResultBtn");
const downloadResultBtn = document.getElementById("downloadResultBtn");
const summaryBtn = document.getElementById("summaryBtn");
const summaryContent = document.getElementById("summaryContent");

let lastFrequencies = [];
let currentRankingLang = "all";
let lastSourceText = "";
let lastTranslatedText = "";
let lastTranslatedWithLearned = "";
let currentSourceLang = "en";

function setLoading(isLoading, context = "Pronto") {
  if (isLoading) {
    statusBadge.classList.remove("error");
    statusText.textContent = "Processando…";
    if (translateBtn) {
      translateBtn.textContent = "Traduzindo…";
      translateBtn.classList.add("loading");
    }
  } else {
    statusBadge.classList.remove("error");
    statusText.textContent = context;
    if (translateBtn) {
      translateBtn.textContent = "Traduzir";
      translateBtn.classList.remove("loading");
    }
  }
  translateBtn.disabled = isLoading;
  ocrBtn.disabled = isLoading;
}

function showError(message, options = {}) {
  statusBadge.classList.add("error");
  statusText.textContent = "Erro";
  errorBox.style.display = "block";
  const msg = message || "Ocorreu um erro. Tente novamente.";
  if (options.retry && translateBtn) {
    errorBox.innerHTML = "";
    errorBox.appendChild(document.createTextNode(msg));
    const span = document.createElement("span");
    span.className = "error-box-actions";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary small btn-retry";
    btn.textContent = "Tentar de novo";
    btn.onclick = () => {
      clearError();
      translateBtn.click();
    };
    span.appendChild(btn);
    errorBox.appendChild(span);
  } else {
    errorBox.textContent = msg;
  }
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
  errorBox.innerHTML = "";
  statusBadge.classList.remove("error");
}

function updateCharCount() {
  const len = inputText.value.length;
  charCount.textContent = `${len} caracteres`;
}

function setResultTab(which) {
  if (
    !translatedResult ||
    !originalResult ||
    !translatedLearnedResult ||
    !tabTranslated ||
    !tabOriginal ||
    !tabTranslatedLearned
  ) {
    return;
  }

  const isTranslated = which === "translated";
  const isOriginal = which === "original";
  const isTranslatedLearned = which === "translatedLearned";

  translatedResult.classList.toggle("hidden", !isTranslated);
  originalResult.classList.toggle("hidden", !isOriginal);
  translatedLearnedResult.classList.toggle("hidden", !isTranslatedLearned);

  tabTranslated.classList.toggle("active", isTranslated);
  tabOriginal.classList.toggle("active", isOriginal);
  tabTranslatedLearned.classList.toggle("active", isTranslatedLearned);

  if (tabTranslated) tabTranslated.setAttribute("aria-selected", isTranslated);
  if (tabOriginal) tabOriginal.setAttribute("aria-selected", isOriginal);
  if (tabTranslatedLearned) tabTranslatedLearned.setAttribute("aria-selected", isTranslatedLearned);

  const visiblePanel = isTranslated
    ? translatedResult
    : isOriginal
      ? originalResult
      : translatedLearnedResult;
  if (visiblePanel) visiblePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/** Atualiza a aba "Tradução com aprendidas" com a lista atual de palavras aprendidas (sem nova tradução). */
async function refreshTranslatedWithLearned() {
  if (!lastSourceText || !translatedLearnedResult) return;
  try {
    const res = await fetch(`${API_BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: lastSourceText,
        learnedWords: getLearnedWords(),
        withLearnedVersion: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) return;
    const mixed =
      data.translatedWithLearned != null
        ? data.translatedWithLearned
        : data.translated || lastTranslatedText;
    lastTranslatedWithLearned = mixed;
    translatedLearnedResult.innerHTML = highlightLearnedWords(mixed);
    attachLearnedWordHandlers();
  } catch (e) {
    console.error("Erro ao atualizar tradução com aprendidas:", e);
  }
}

function findWordTranslationInFrequencies(word) {
  const norm = normalizeWord(word);
  const item = (lastFrequencies || []).find(
    (f) => normalizeWord(f.word) === norm
  );
  return item ? item.translation : "";
}

async function fetchWordTranslation(word) {
  try {
    const res = await fetch(`${API_BASE}/word`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });
    const data = await res.json();
    if (!res.ok) return "";
    return data.translation || "";
  } catch (e) {
    console.error("Erro ao traduzir palavra:", e);
    return "";
  }
}

async function ensureSpanTranslation(span, fromClick = false) {
  const word = (span.dataset.word || span.textContent || "").trim();
  if (!word) return;

  if (!span.dataset.translation) {
    let translation = findWordTranslationInFrequencies(word);
    if (!translation) {
      translation = await fetchWordTranslation(word);
    }
    if (!translation) return;
    span.dataset.translation = translation;
    span.title = `${word} → ${translation}`;
  }

  if (fromClick && span.dataset.translation) {
    const translation = span.dataset.translation;
    showError(`${word} → ${translation}`);
  }
}

function attachLearnedWordHandlers() {
  const spans = document.querySelectorAll(".learned-word");
  spans.forEach((span) => {
    if (span._handlersAttached) return;
    span._handlersAttached = true;

    span.addEventListener("mouseenter", () => {
      ensureSpanTranslation(span, false);
    });

    span.addEventListener("click", (e) => {
      e.stopPropagation();
      ensureSpanTranslation(span, true);
    });
  });
}

/* Fallback só para entradas antigas sem .lang */
function guessLanguage(word) {
  if (!word || typeof word !== "string") return "en";
  const w = word.trim();
  if (/ç|ë|û|ÿ|ï|ü|œ|æ/.test(w)) return "fr";
  if (/ì|ò|è|à|ù|é|ó|í|ú/.test(w)) return "it";
  if (/zione|mente|ità|tà$|chi$|ghi$|ccio|ggio|issimo|issima/.test(w.toLowerCase())) return "it";
  if (/[àâäéèêëîïôùûüÿ]/.test(w)) return "fr";
  return "en";
}

let currentLearnedLang = "all";

function renderLearnedWordsPanel() {
  if (!learnedList) return;
  learnedList.innerHTML = "";
  let entries = getLearnedEntries().slice();
  if (currentLearnedLang !== "all") {
    entries = entries.filter((e) => {
      const lang = e.lang || guessLanguage(e.word);
      return lang === currentLearnedLang;
    });
  }
  entries.sort((a, b) => a.word.localeCompare(b.word, "pt-BR"));
  if (!entries.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.innerHTML = currentLearnedLang === "all"
      ? "<strong>Nenhuma palavra aprendida ainda.</strong><br>Traduza um texto e clique em <em>✔ Aprendi</em> nas palavras que já conhece."
      : "Nenhuma palavra neste idioma no seu vocabulário.";
    learnedList.appendChild(li);
    return;
  }
  entries.forEach((e) => {
    const li = document.createElement("li");
    li.textContent = e.word;
    learnedList.appendChild(li);
  });
}

function renderRankingPanel() {
  if (!rankingList) return;
  rankingList.innerHTML = "";
  const ranking = getRanking();
  const excluded = getExcludedRankingWords();
  const excludedSet = (lang) => new Set((excluded[lang] || []).map((w) => w.toLowerCase()));
  let items = [];
  const langs = currentRankingLang === "all" ? ["en", "fr", "it"] : [currentRankingLang];
  langs.forEach((lang) => {
    const set = excludedSet(lang);
    const byLang = ranking[lang] || {};
    Object.entries(byLang).forEach(([word, count]) => {
      if (set.has(word.toLowerCase())) return;
      items.push({ word, count, lang });
    });
  });
  items.sort((a, b) => b.count - a.count);
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.innerHTML = currentRankingLang === "all"
      ? "<strong>Ranking vazio.</strong><br>Traduza textos para ver aqui as palavras mais frequentes de todas as suas traduções."
      : "Nenhuma palavra neste idioma no ranking ainda.";
    rankingList.appendChild(li);
    return;
  }
  const langLabel = { en: "🇬🇧", fr: "🇫🇷", it: "🇮🇹" };
  items.forEach(({ word, count, lang }) => {
    const li = document.createElement("li");
    li.className = "ranking-item";
    const text = document.createElement("span");
    text.textContent = `${word} — ${count}`;
    li.appendChild(text);
    const badge = document.createElement("small");
    badge.textContent = langLabel[lang] || lang;
    badge.style.marginLeft = "8px";
    badge.style.color = "var(--muted)";
    li.appendChild(badge);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "ranking-remove-btn";
    removeBtn.title = "Remover palavra do ranking (nomes próprios, palavras comuns, etc.)";
    removeBtn.setAttribute("aria-label", `Remover "${word}" do ranking`);
    removeBtn.textContent = "✕";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      addExcludedRankingWord(lang, word);
      renderRankingPanel();
    };
    li.appendChild(removeBtn);
    rankingList.appendChild(li);
  });
}

function formatDateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function renderHistory() {
  if (!historyList) return;
  historyList.innerHTML = "";
  const history = getHistory().slice().reverse();
  if (!history.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.innerHTML = "<strong>Nenhuma tradução no histórico.</strong><br>As últimas 20 traduções aparecem aqui após você clicar em <em>Traduzir</em>.";
    historyList.appendChild(li);
    return;
  }
  history.forEach((entry) => {
    const li = document.createElement("li");
    const main = document.createElement("div");
    const meta = document.createElement("small");

    const snippet =
      entry.source.length > 80
        ? entry.source.slice(0, 77) + "..."
        : entry.source;

    main.textContent = snippet || "(texto vazio)";
    meta.textContent = formatDateLabel(entry.createdAt);

    li.style.cursor = "pointer";
    li.appendChild(main);
    li.appendChild(meta);

    li.onclick = () => {
      inputText.value = entry.source;
      updateCharCount();
      lastSourceText = entry.source || "";
      lastTranslatedText = entry.translated || "";
      lastTranslatedWithLearned = "";
      setSourceLangUI(detectSourceLanguage(entry.source));
      translatedResult.textContent = lastTranslatedText;
      originalResult.innerHTML = highlightLearnedWords(lastSourceText);
      translatedLearnedResult.innerHTML =
        highlightLearnedWords(lastTranslatedText);
      attachLearnedWordHandlers();
      setResultTab("translated");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    historyList.appendChild(li);
  });
}

function renderFrequencies(freqs, learnedWords) {
  list.innerHTML = "";
  const hideLearned = hideLearnedToggle && hideLearnedToggle.checked;
  const learnedNorm = learnedWords.map(normalizeWord);

  (freqs || []).forEach((item) => {
    const isLearned = learnedNorm.includes(normalizeWord(item.word));
    if (hideLearned && isLearned) return;

    const li = document.createElement("li");
    li.textContent = `${item.word} → ${item.translation || "—"} (${item.count})`;

    if (isLearned) {
      li.style.opacity = "0.6";
      li.textContent += " ✔ aprendida";
    } else {
      const btn = document.createElement("button");
      btn.textContent = "✔ Aprendi";
      btn.onclick = async () => {
        saveLearnedWord(item.word, currentSourceLang);
        li.style.opacity = "0.6";
        btn.remove();
        li.textContent += " ✔ aprendida";
        originalResult.innerHTML = highlightLearnedWords(lastSourceText);
        renderLearnedWordsPanel();
        renderFrequencies(lastFrequencies, getLearnedWords());
        await refreshTranslatedWithLearned();
      };
      li.appendChild(btn);
    }
    list.appendChild(li);
  });
}

inputText.addEventListener("input", updateCharCount);
updateCharCount();
renderLearnedWordsPanel();
renderHistory();
renderRankingPanel();
attachLearnedWordHandlers();

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    inputText.value = "";
    lastSourceText = "";
    lastTranslatedText = "";
    lastTranslatedWithLearned = "";
    lastFrequencies = [];
    translatedResult.innerHTML = "";
    originalResult.innerHTML = "";
    translatedLearnedResult.innerHTML = "";
    list.innerHTML = "";
    const summaryContentEl = document.getElementById("summaryContent");
    if (summaryContentEl) {
      summaryContentEl.innerHTML = "<p class=\"summary-placeholder\">Traduza um texto e clique em <em>Fazer resumo</em> para gerar um resumo.</p>";
    }
    clearError();
    updateCharCount();
    setLoading(false, "Pronto");
    attachLearnedWordHandlers();
  });
}

if (hideLearnedToggle) {
  hideLearnedToggle.addEventListener("change", () => {
    renderFrequencies(lastFrequencies, getLearnedWords());
  });
}

function clearAllLearnedWords() {
  localStorage.removeItem(learnedKey);
  renderLearnedWordsPanel();
  if (lastSourceText) {
    originalResult.innerHTML = highlightLearnedWords(lastSourceText);
    attachLearnedWordHandlers();
  }
  if (lastTranslatedWithLearned || lastTranslatedText) {
    const mixed = lastTranslatedWithLearned || lastTranslatedText;
    translatedLearnedResult.innerHTML = highlightLearnedWords(mixed);
    attachLearnedWordHandlers();
  }
  renderFrequencies(lastFrequencies, getLearnedWords());
}

if (clearLearnedBtn) {
  clearLearnedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!confirm("Apagar todas as palavras aprendidas? Não há como desfazer.")) return;
    clearAllLearnedWords();
    clearError();
    statusBadge.classList.remove("error");
    statusText.textContent = "Palavras zeradas.";
  });
}

if (exportLearnedBtn) {
  exportLearnedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const words = getLearnedWords();
    if (!words.length) {
      showError("Nenhuma palavra aprendida para exportar.");
      return;
    }
    const header = "palavra\n";
    const body = words.join("\n");
    const csv = header + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "palavras_aprendidas.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function setupCollapsible(header, panel, chevron) {
  if (!header || !panel || !chevron) return;
  header.setAttribute("aria-expanded", "false");
  const toggle = () => {
    const collapsed = panel.classList.toggle("collapsed");
    chevron.textContent = collapsed ? "▼" : "▲";
    header.setAttribute("aria-expanded", !collapsed);
  };
  header.addEventListener("click", toggle);
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
}

setupCollapsible(historyHeader, historyPanel, historyChevron);
setupCollapsible(learnedHeader, learnedPanel, learnedChevron);
setupCollapsible(rankingHeader, rankingPanel, rankingChevron);

document.querySelectorAll(".filter-lang").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-lang").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLearnedLang = btn.getAttribute("data-lang") || "all";
    renderLearnedWordsPanel();
  });
});

document.querySelectorAll(".ranking-filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ranking-filter").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentRankingLang = btn.getAttribute("data-lang") || "all";
    renderRankingPanel();
  });
});

const resultTablist = document.querySelector(
  '.result-tabs[role="tablist"]'
);
if (resultTablist) {
  resultTablist.addEventListener("click", (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab) return;
    e.preventDefault();
    if (tab.id === "tabTranslated") setResultTab("translated");
    else if (tab.id === "tabOriginal") setResultTab("original");
    else if (tab.id === "tabTranslatedLearned") setResultTab("translatedLearned");
  });
}

/* Tema claro/escuro */
function getPreferredTheme() {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  if (typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if (themeIcon) themeIcon.textContent = theme === "light" ? "🌙" : "☀️";
  if (themeToggle) themeToggle.setAttribute("aria-label", theme === "light" ? "Usar tema escuro" : "Usar tema claro");
}

if (themeToggle) {
  applyTheme(getPreferredTheme());
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

/* Copiar resultado */
if (copyResultBtn) {
  copyResultBtn.addEventListener("click", () => {
    let text = "";
    if (!translatedResult.classList.contains("hidden")) text = translatedResult.innerText || "";
    else if (!originalResult.classList.contains("hidden")) text = originalResult.innerText || "";
    else if (!translatedLearnedResult.classList.contains("hidden")) text = translatedLearnedResult.innerText || "";
    if (!text.trim()) {
      showError("Nada para copiar. Traduza um texto primeiro.");
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      const prev = copyResultBtn.textContent;
      copyResultBtn.textContent = "Copiado!";
      statusText.textContent = "Copiado para a área de transferência.";
      setTimeout(() => {
        copyResultBtn.textContent = prev;
        statusText.textContent = "Pronto";
      }, 2000);
    }).catch(() => showError("Não foi possível copiar."));
  });
}

/* Descarregar resultado como .txt */
function getVisibleResultText() {
  if (!translatedResult.classList.contains("hidden")) return translatedResult.innerText || "";
  if (!originalResult.classList.contains("hidden")) return originalResult.innerText || "";
  if (!translatedLearnedResult.classList.contains("hidden")) return translatedLearnedResult.innerText || "";
  return "";
}
if (downloadResultBtn) {
  downloadResultBtn.addEventListener("click", () => {
    const text = getVisibleResultText().trim();
    if (!text) {
      showError("Nada para descarregar. Traduza um texto primeiro.");
      return;
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "traducao.txt";
    a.click();
    URL.revokeObjectURL(url);
    statusText.textContent = "Ficheiro descarregado.";
    setTimeout(() => { if (statusText) statusText.textContent = "Pronto"; }, 2000);
  });
}

/* Resumo do texto traduzido (apenas ao clicar) – delegação para garantir que o clique seja sempre tratado */
document.addEventListener("click", async (e) => {
  const btn = e.target && e.target.id === "summaryBtn" ? e.target : (e.target && e.target.closest && e.target.closest("#summaryBtn"));
  if (!btn) return;
  e.preventDefault();
  const contentEl = document.getElementById("summaryContent");
  if (!contentEl) return;

  const text = (lastTranslatedText || "").trim();
  if (!text) {
    showError("Traduza um texto primeiro para poder gerar o resumo.");
    return;
  }

  contentEl.innerHTML = "<p class=\"summary-placeholder\">A gerar resumo…</p>";
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || "Erro ao gerar resumo.");
      contentEl.innerHTML = "<p class=\"summary-placeholder\">Traduza um texto e clique em <em>Fazer resumo</em> para gerar um resumo.</p>";
      return;
    }
    const summary = (data.summary || "").trim();
    contentEl.innerHTML = summary ? `<p>${summary.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` : "<p class=\"summary-placeholder\">Nenhum resumo devolvido.</p>";
  } catch (err) {
    console.error("Resumo:", err);
    showError("Erro ao conectar com o servidor para gerar resumo.");
    contentEl.innerHTML = "<p class=\"summary-placeholder\">Traduza um texto e clique em <em>Fazer resumo</em> para gerar um resumo.</p>";
  } finally {
    btn.disabled = false;
  }
});

/* Traduzir */
translateBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  clearError();

  const text = inputText.value;
  list.innerHTML = "";

  if (!text.trim()) {
    showError("Digite ou cole um texto antes de traduzir.");
    return;
  }

  translatedResult.textContent = "Traduzindo…";
  originalResult.textContent = "";
  translatedLearnedResult.textContent = "";
  setLoading(true);

  try {
    const learnedWords = getLearnedWords();

    const res = await fetch(`${API_BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        learnedWords,
        withLearnedVersion: true,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Erro ao traduzir o texto.", { retry: true });
      translatedResult.textContent = "";
      setLoading(false, "Pronto");
      return;
    }

    const translated = data.translated || "";
    lastSourceText = text;
    lastTranslatedText = translated;

    // Detecta idioma do texto e atualiza o seletor (para "✔ Aprendi" salvar no idioma certo)
    setSourceLangUI(detectSourceLanguage(text));

    // Aba "Tradução": texto traduzido puro
    translatedResult.textContent = lastTranslatedText;

    // Aba "Original com aprendidas": texto ORIGINAL com palavras aprendidas em destaque
    lastFrequencies = data.frequencies || [];
    originalResult.innerHTML = highlightLearnedWords(lastSourceText);

    // Aba "Tradução com aprendidas": backend traduz só o que NÃO é aprendido; aprendidas ficam no original
    lastTranslatedWithLearned =
      data.translatedWithLearned != null
        ? data.translatedWithLearned
        : lastTranslatedText;
    translatedLearnedResult.innerHTML = highlightLearnedWords(
      lastTranslatedWithLearned
    );
    attachLearnedWordHandlers();

    renderFrequencies(lastFrequencies, learnedWords);

    addToRanking(currentSourceLang, lastFrequencies);
    renderRankingPanel();

    addHistoryEntry(text, translated);
    renderHistory();

    setResultTab("translated");
    setLoading(false, "Tradução pronta");
  } catch (e) {
    console.error(e);
    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.protocol === "file:");
    showError(
      isLocal
        ? "Erro ao conectar com o backend. Inicie o servidor (na pasta backend: python app.py)."
        : "Erro ao conectar com o backend.",
      { retry: true }
    );
    translatedResult.textContent = "";
    setLoading(false, "Pronto");
  }
});

/* OCR */
ocrBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  clearError();

  const fileInput = document.getElementById("imageInput");
  if (!fileInput.files[0]) {
    showError("Selecione um arquivo de imagem.");
    return;
  }

  const fd = new FormData();
  fd.append("image", fileInput.files[0]);

  setLoading(true, "Processando arquivo de imagem…");

  try {
    const res = await fetch(`${API_BASE}/ocr`, { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Erro ao processar arquivo de imagem.");
      setLoading(false, "Pronto");
      return;
    }

    inputText.value = data.text || "";
    updateCharCount();
    setLoading(false, "Texto extraído");
  } catch (e) {
    console.error(e);
    showError("Erro ao processar arquivo de imagem.");
    setLoading(false, "Pronto");
  }
});

const imageInputStatus = document.getElementById("imageInputStatus");
document.getElementById("imageInput").addEventListener("change", function () {
  if (imageInputStatus) imageInputStatus.textContent = this.files[0] ? this.files[0].name : "Nenhum arquivo selecionado";
});

