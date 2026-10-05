"use strict";

const POSITION_LABEL = {
  favorable: "Soutient",
  critique: "Critique",
  neutre: "Nuance",
  officiel: "Position officielle",
};
const KIND_LABEL = { institution: "Source officielle", media: "Média", parti: "Parti" };
const EMPTY = {
  institutions: {
    title: "Rien à afficher pour l'instant",
    text: "Aucun sujet n'a encore été relu et approuvé.",
  },
  presidentielle: {
    title: "La section présidentielle arrive",
    text: "Elle réunira l'actualité des médias et les communiqués des partis eux-mêmes. Tant que nous n'avons pas de sources vérifiées, nous n'affichons rien.",
  },
};

const feed = document.getElementById("feed");
const meta = document.getElementById("meta");
let posts = [];
let current = "institutions";

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "#";
  } catch { return "#"; }
}

function sourceChip(id, byId) {
  const s = byId[id];
  if (!s) return null;
  return el("a", { class: "chip", href: safeUrl(s.url), target: "_blank", rel: "noopener noreferrer", title: s.title, text: s.name });
}

const SECTION_LABEL = { institutions: "Institutions", presidentielle: "Présidentielle" };
const TINTS = 6;

// Image de l'article source (fournie par le média), cadrée sur le point choisi à la relecture.
function imageFigure(image) {
  const img = el("img", { src: image.url, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
  img.style.objectPosition = `${(image.focus_x ?? 0.5) * 100}% ${(image.focus_y ?? 0.3) * 100}%`;
  return el("figure", { class: "card-photo" },
    img,
    el("figcaption", {},
      "Image : ",
      el("a", { href: safeUrl(image.article_url), target: "_blank", rel: "noopener noreferrer", text: image.source + ", voir l'article" }),
    ),
  );
}

const EXPIRE_MS = 48 * 3600 * 1000;   // un sujet disparaît 48 h après sa publication
const isFresh = (p) => !p.reviewed_at || Date.now() - new Date(p.reviewed_at).getTime() < EXPIRE_MS;

function renderPost(post, index) {
  const byId = Object.fromEntries((post.sources || []).map((s) => [s.id, s]));
  const card = el("article", { class: "card tint-" + (index % TINTS) + (post.image ? " has-photo" : "") });

  if (post.image) card.append(imageFigure(post.image));
  const topic = el("span", { class: "topic", text: SECTION_LABEL[post.section] || "Actualité" });
  card.append(topic);
  if (index === 0) card.append(el("span", { class: "topic une", text: "À la une" }));
  card.append(el("h2", { text: post.headline }));
  card.append(el("p", { class: "chapo", text: post.chapo }));

  const more = el("div", { class: "more", id: "more-" + post.id, hidden: "" });
  if (post.points?.length) {
    more.append(el("h3", { text: "L'essentiel" }));
    const ul = el("ul", { class: "points" });
    for (const p of post.points) {
      const li = el("li", { text: p.text });
      for (const id of p.sources || []) li.append(sourceChip(id, byId));
      ul.append(li);
    }
    more.append(ul);
  }

  if (post.perspectives?.length) {
    more.append(el("h3", { text: "Les points de vue" }));
    const wrap = el("div", { class: "persp" });
    for (const p of post.perspectives) {
      const item = el("div", { class: "persp-item" },
        el("span", { class: "who", text: POSITION_LABEL[p.position] || "Point de vue" }),
        el("span", { text: p.text }),
      );
      item.append(sourceChip(p.source, byId));
      wrap.append(item);
    }
    more.append(wrap);
  }

  if (post.sources?.length) {
    const details = el("details", { class: "srcs" }, el("summary", { text: `Lire les ${post.sources.length} sources` }));
    const ul = el("ul");
    for (const s of post.sources) {
      const li = el("li");
      li.append(
        el("a", { href: safeUrl(s.url), target: "_blank", rel: "noopener noreferrer", text: s.title }),
        el("div", { class: "src-kind", text: `${s.name} · ${KIND_LABEL[s.kind] || ""}` }),
        s.snippet ? el("blockquote", { class: "src-snip", text: s.snippet }) : null,
      );
      ul.append(li);
    }
    details.append(ul);
    more.append(details);
  }
  more.append(el("p", { class: "disclosure", text: `Rédigé avec l'aide de l'IA, relu par un humain le ${formatDate(post.reviewed_at)}.` }));
  card.append(el("p", { class: "meta-line", text: `${(post.sources || []).length} sources · ${post.coverage?.outlets || new Set((post.sources || []).map((s) => s.name)).size} médias` }));
  const toggle = el("button", { class: "more-btn", type: "button", "aria-expanded": "false", "aria-controls": "more-" + post.id, text: "Voir plus" });
  toggle.addEventListener("click", () => {
    const open = more.hidden;
    more.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Voir moins" : "Voir plus";
  });
  card.append(toggle, more);
  return card;
}

let programmes = null;

function compareCard() {
  const ready = programmes && programmes.ready;
  const text = ready
    ? "Compare les propositions des candidats, thème par thème, à partir de leurs documents officiels."
    : "En préparation : il ouvrira quand les programmes officiels d'au moins " +
      `${programmes ? programmes.min_candidates : 4} candidats seront publiés et relus.`;
  return el("a", { class: "compare-card", href: "comparateur.html" },
    el("div", {}, el("strong", { text: "Comparateur de programmes" }), el("span", { text })),
    el("span", { class: "arrow", "aria-hidden": "true", text: "→" }),
  );
}

function render() {
  const list = posts.filter((p) => p.section === current);
  feed.replaceChildren();
  if (current === "presidentielle" && window.FEATURES?.comparateur) feed.append(compareCard());
  if (!list.length) {
    const e = EMPTY[current];
    feed.append(el("div", { class: "empty" }, el("strong", { text: e.title }), el("span", { text: e.text })));
    meta.textContent = "";
    return;
  }
  meta.textContent = `${list.length} sujet${list.length > 1 ? "s" : ""} relu${list.length > 1 ? "s" : ""}`;
  list.forEach((p, i) => feed.append(renderPost(p, i)));
}

// En-tête propre à chaque onglet. Dates du scrutin : 18 avril et 2 mai 2027 (source : France 24).
const ELECTION_START = new Date("2027-04-17T22:00:00Z"); // 18 avril 2027, 00h00 à Paris (UTC+2)
let countdownTimer = null;

function tickCountdown() {
  const ms = ELECTION_START - Date.now();
  const box = document.getElementById("countdown");
  if (ms <= 0) { setCountdown(false); return; }
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  document.getElementById("cd-d").textContent = String(days);
  document.getElementById("cd-h").textContent = pad(hours);
  document.getElementById("cd-m").textContent = pad(minutes);
  document.getElementById("cd-s").textContent = pad(seconds);
  // Lecteurs d'écran : une phrase mise à jour à la minute, sans les secondes qui défilent.
  box.setAttribute("aria-label", `Plus que ${days} jours, ${hours} heures et ${minutes} minutes avant le 18 avril 2027`);
}

function setCountdown(on) {
  clearInterval(countdownTimer);
  document.getElementById("countdown").hidden = !on;
  document.getElementById("countdown-cap").hidden = !on;
  if (on) {
    tickCountdown();
    countdownTimer = setInterval(tickCountdown, 1000);
  }
}

const HERO = {
  institutions: () => ({
    lead: "La politique, sans ",
    mark: "pression.",
    text: "Chaque jour, quelques sujets d'actualité expliqués simplement, avec les sources à un clic pour te faire ta propre idée.",
    pills: ["Sources cliquables", "Relu avant publication", "Sans prise de parti"],
  }),
  presidentielle: () => ({
    lead: "La présidentielle, sans ",
    mark: "pression.",
    text: "La campagne vue par plusieurs médias, avec les sources à un clic. Le scrutin aura lieu les 18 avril et 2 mai 2027.",
    pills: ["Sans consigne de vote", "Sources cliquables", "Relu avant publication"],
  }),
};

function renderHero() {
  const hero = HERO[current]();
  const title = document.getElementById("hero-title");
  title.replaceChildren(hero.lead, el("span", { class: "mark", text: hero.mark }));
  document.getElementById("hero-text").textContent = hero.text;
  document.getElementById("hero-pills").replaceChildren(...hero.pills.map((t) => el("li", { text: t })));
  setCountdown(current === "presidentielle");
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    current = btn.dataset.section;
    document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    renderHero();
    render();
  });
});

fetch("data/posts.json", { cache: "no-store" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => { posts = (data.posts || []).filter(isFresh); render(); })
  .catch(() => {
    feed.replaceChildren(el("div", { class: "empty" },
      el("strong", { text: "Impossible de charger l'actualité" }),
      el("span", { text: "Réessaie dans un instant." })));
  });

if (window.FEATURES?.comparateur) {
  fetch("data/programmes.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { programmes = data; render(); })
    .catch(() => {});
}
