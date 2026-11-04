const root = document.documentElement;
const assetBase = root.dataset.base || "";
const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const themeToggle = document.querySelector("[data-theme-toggle]");

const closeMenu = () => {
  if (!menuToggle || !mobileNav) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  mobileNav.classList.remove("is-open");
};

menuToggle?.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  mobileNav?.classList.toggle("is-open", open);
});

mobileNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

window.addEventListener("resize", () => {
  if (window.innerWidth > 860) closeMenu();
});

const updateHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 8);
};

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

themeToggle?.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = nextTheme;
  localStorage.setItem("dachshund-theme", nextTheme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    nextTheme === "dark" ? "#11110f" : "#f7f3ec",
  );
});

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const englishExamples = {
  decision: {
    agents: ["codex-color.svg", "claudecode-color.svg"],
    kind: "Decision",
    title: "Ship the reader before the editor.",
    text:
      "The reader has to feel complete on its own before authoring, collaboration, or publishing enters the first release.",
    tags: ["product", "roadmap", "scope"],
  },
  preference: {
    agents: ["claudecode-color.svg", "cursor.svg", "codex-color.svg"],
    kind: "Preference",
    title: "Paper before pixels.",
    text:
      "Prefer a field-journal feel: warm paper, ink, hairline rules and one quiet accent. Remove a visual element when it starts to feel like software.",
    tags: ["design", "typography"],
  },
  insight: {
    agents: ["codex-color.svg", "geminicli-color.svg"],
    kind: "Insight",
    title: "Test the packaged app, not only the dev build.",
    text:
      "The integration worked in Electron preview but failed after packaging because the MCP entry used a source path. Verify the shipped resource path.",
    tags: ["packaging", "mcp", "testing"],
  },
};

const chineseExamples = {
  decision: {
    agents: ["codex-color.svg", "claudecode-color.svg"],
    kind: "决定",
    title: "先交付阅读器，再做编辑器",
    text: "阅读器必须先能独立成立，编辑、协作和发布才进入第一个版本。功能完整不等于体验完成。",
    tags: ["产品", "路线图", "范围"],
  },
  preference: {
    agents: ["claudecode-color.svg", "cursor.svg", "codex-color.svg"],
    kind: "偏好",
    title: "先做内容，再做界面",
    text: "界面要像纸质田野笔记：暖纸色、墨色、细分隔线和唯一重点色。元素开始像软件界面时，就把它删掉。",
    tags: ["设计", "排版"],
  },
  insight: {
    agents: ["codex-color.svg", "geminicli-color.svg"],
    kind: "洞察",
    title: "打包前通过，不代表打包后也能用",
    text: "集成在 Electron 预览里正常，打包后却因为 MCP 使用了源码路径而失败。验证必须针对真正发布的资源路径。",
    tags: ["打包", "mcp", "测试"],
  },
};

const memoryExamples = root.lang.startsWith("zh") ? chineseExamples : englishExamples;

const demoAgents = document.querySelector("[data-demo-agents]");
const demoKind = document.querySelector("[data-demo-kind]");
const demoTitle = document.querySelector("[data-demo-title]");
const demoText = document.querySelector("[data-demo-text]");
const demoTags = document.querySelector("[data-demo-tags]");

document.querySelectorAll("[data-memory-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const key = tab.dataset.memoryTab;
    const example = memoryExamples[key];
    if (!example) return;

    document.querySelectorAll("[data-memory-tab]").forEach((button) => {
      button.setAttribute("aria-selected", String(button === tab));
    });

    if (demoAgents) {
      demoAgents.innerHTML = example.agents
        .map((agent) => `<span><img src="${assetBase}assets/agents/${agent}" alt=""></span>`)
        .join("");
    }
    if (demoKind) demoKind.textContent = example.kind;
    if (demoTitle) demoTitle.textContent = example.title;
    if (demoText) demoText.textContent = example.text;
    if (demoTags) {
      demoTags.innerHTML = example.tags.map((tag) => `<span>${tag}</span>`).join("");
    }
  });
});

const stage = document.querySelector("[data-hero-stage]");
const shouldReduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

stage?.addEventListener("pointermove", (event) => {
  if (shouldReduceMotion.matches || window.innerWidth < 861) return;
  const bounds = stage.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;

  stage.querySelectorAll("[data-parallax]").forEach((layer) => {
    const amount = Number(layer.dataset.parallax || 0);
    const baseRotation = layer.classList.contains("hero-memory-card") ? -2 : 0;
    layer.style.transform = `translate3d(${x * amount * 18}px, ${y * amount * 12}px, 0) rotate(${baseRotation + x * amount * 2}deg)`;
  });
});

stage?.addEventListener("pointerleave", () => {
  stage.querySelectorAll("[data-parallax]").forEach((layer) => {
    const baseRotation = layer.classList.contains("hero-memory-card") ? -2 : 0;
    layer.style.transform = layer.classList.contains("window-frame")
      ? ""
      : `rotate(${baseRotation}deg)`;
  });
});

document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});
