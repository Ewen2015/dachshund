import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../vendor/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 760;
const HEIGHT = 300;
const BASE = { x: -188, y: -62, w: 376, d: 124, r: 10 };
const LABEL_BOOST = 2.15;

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -20, 0),
    [-170, -54, 58],
    [170, 54, 58]
  ],
  WIDTH,
  HEIGHT,
  { pad: 8, azimuth: 90, elevation: 64 }
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

function feet(plan, z = -20, h = 9) {
  return k
    .corners(plan, 22)
    .map(
      ([x, y]) =>
        S(k.cylinder(x, y, 6.8, z, 2.2, P, 28), { tone: "lo" }) +
        S(k.cylinder(x, y, 5.1, z + 2.2, h - 2.2, P, 28), { tone: "mid" })
    )
    .join("");
}

function base(plan = BASE, label = "OFFICIAL MECHANISM") {
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, -20, 13, P)}"/>`];
  out.push(feet(plan));
  out.push(S(k.slabOf(plan, -10, 19, P, 10, 1.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 5), 9, P, 10), { tone: "lo" }));
  const screws = k.corners(plan, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 9, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 9])), { size: 0.46 }));

  const plate = { x: plan.x + 18, y: plan.y + plan.d - 19, w: 92, d: 8, r: 1.4 };
  out.push(S(k.slabOf(plate, 9, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(
    k.faceTextSvg(k.topMatrix([plate.x + plate.w / 2, plate.y + plate.d / 2], 9.8, P, "x"), label, {
      size: 3.1,
      tone: "mid",
      anchor: "middle"
    })
  );
  return out.join("");
}

function plinth(x, y, w, d, z = 9, h = 5, tone = "mid") {
  const plan = { x, y, w, d, r: 3 };
  return (
    S(k.slabOf(plan, z, h, P, 5, 0.65), { tone }) +
    L(k.planOutline(k.insetPlan(plan, 3.2), z + h, P, 5), { tone: "faint" })
  );
}

function topLabel(x, y, text, z, { size = 3, tone = "hi", anchor = "middle" } = {}) {
  return k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), text, { size: size * LABEL_BOOST, tone, anchor });
}

function sideLabel(x, y, z, text, { size = 3, tone = "hi", anchor = "middle", face = "right" } = {}) {
  return k.faceTextSvg(k.sideMatrix([x, y], z, P, face), text, { size: size * LABEL_BOOST, tone, anchor });
}

function card(x, y, z, w = 34, d = 26, h = 2.4, tone = "hi") {
  const plan = { x, y, w, d, r: 1.6 };
  return (
    S(k.slabOf(plan, z, h, P, 4, 0.3), { tone, crease: "faint" }) +
    L(k.planOutline(k.insetPlan(plan, 3), z + h, P, 4), { tone: "faint" }) +
    D([at([x + 5, y + 5, z + h]), at([x + 10, y + 5, z + h])], { size: 0.3 })
  );
}

function cardStack(x, y, z, count = 3, label = "", { labelSize = 2.8 } = {}) {
  const out = [];
  for (let index = 0; index < count; index += 1) {
    out.push(card(x + index * 1.2, y + index * 1.6, z + index * 4.2, 38, 28, 2.2, index === count - 1 ? "hi" : "mid"));
  }
  if (label) out.push(topLabel(x + 19, y + 14, label, z + count * 4.2 + 2.2, { size: labelSize }));
  return out.join("");
}

function book(x, y, z, label, { tone = "hi", w = 45, d = 30, h = 7, labelSize = 2.8 } = {}) {
  const plan = { x, y, w, d, r: 2 };
  return (
    S(k.slabOf(plan, z, h, P, 5, 0.7), { tone, crease: "mid" }) +
    L(k.planOutline(k.insetPlan(plan, 3), z + h, P, 5), { tone: "lo" }) +
    topLabel(x + w / 2, y + d / 2, label, z + h + 0.2, { size: labelSize, tone: "hi" })
  );
}

function tray(x, y, z, label, { w = 54, d = 36, tone = "mid", labelSize = 2.8 } = {}) {
  const plan = { x, y, w, d, r: 2.5 };
  return (
    plinth(x, y, w, d, z, 4, tone) +
    S(k.slabOf({ x: x + 5, y: y + 5, w: w - 10, d: d - 10, r: 1.5 }, z + 4, 1.3, P, 4), {
      tone: "hi",
      crease: "faint"
    }) +
    topLabel(x + w / 2, y + d / 2, label, z + 5.3, { size: labelSize })
  );
}

function dial(x, y, z, label, { r = 20 } = {}) {
  const out = [];
  out.push(S(k.cylinder(x, y, r, z, 4, P, 52, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, r - 3, z + 4, 1.8, P, 52, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, r - 6, z + 5.8, P, 44), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, r - 8, r - 4, 4, z + 5.8, [0.8, 1.8], P);
  out.push(L(ticks.minor, { tone: "lo", free: true }), L(ticks.major, { tone: "mid", free: true }));
  out.push(L(k.lineOnTop([x, y], [x, y - r + 7], z + 6, P), { tone: "hi", free: true }));
  out.push(L(k.lineOnTop([x, y], [x + r - 9, y + 4], z + 6, P), { tone: "hi", free: true }));
  out.push(D([at([x, y, z + 6])], { size: 0.55, tone: "hi" }));
  out.push(topLabel(x, y + r + 7, label, z + 5.9, { size: 2.8 }));
  return out.join("");
}

function rollerPair(x, y, z, label) {
  const out = [];
  for (const dx of [0, 30]) {
    out.push(S(k.cylinder(x + dx, y, 10.5, z, 28, P, 40), { tone: "mid" }));
    out.push(L(k.knurl(x + dx, y, 10.5, z, z + 28, 36, P, 0.24), { tone: "lo" }));
    out.push(L(k.sideArc(x + dx, y, 10.5, z + 28, P, 30), { tone: "faint" }));
    out.push(S(k.cylinder(x + dx, y, 7.4, z + 28, 2, P, 32), { tone: "hi" }));
  }
  out.push(topLabel(x + 15, y + 18, label, z + 5, { size: 2.8 }));
  return out.join("");
}

function fileDrawers(x, y, z, label = "TOPIC FILES") {
  const out = [];
  const w = 52;
  const d = 45;
  out.push(S(k.slabOf({ x, y, w, d, r: 2.5 }, z, 32, P, 5, 0.8), { tone: "mid" }));
  [0, 1, 2].forEach((index) => {
    const yy = y + 4 + index * 12;
    out.push(S(k.slabOf({ x: x + 4, y: yy, w: w - 8, d: 9, r: 1.2 }, z + 3 + index * 3, 3, P, 4, 0.3), {
      tone: index === 0 ? "hi" : "lo"
    }));
    out.push(D([at([x + w - 10, yy + 4.5, z + 6 + index * 3])], { size: 0.42, tone: "mid" }));
  });
  out.push(topLabel(x + w / 2, y + d / 2, label, z + 32.2, { size: 2.75 }));
  return out.join("");
}

function gaugeBin(x, y, z, label, value, { w = 48, d = 38, h = 28, fill = 0.6 } = {}) {
  const out = [];
  out.push(S(k.slabOf({ x, y, w, d, r: 3 }, z, h, P, 5, 0.8), { tone: "mid" }));
  const inner = { x: x + 6, y: y + 5, w: w - 12, d: d - 10, r: 1.5 };
  out.push(L(k.planOutline(inner, z + h, P, 5), { tone: "lo" }));
  const fillH = Math.max(2, (h - 7) * fill);
  out.push(S(k.slabOf(inner, z + 3, fillH, P, 5, 0.3), { tone: "hi", crease: "faint" }));
  out.push(topLabel(x + w / 2, y + d / 2, label, z + h + 0.2, { size: 2.8 }));
  out.push(topLabel(x + w / 2, y + d / 2 + 5.5, value, z + h + 0.2, { size: 2.35, tone: "mid" }));
  return out.join("");
}

const arrowhead = (head, left, right, tone = "lit") =>
  `<path class="flow-head" data-tone="${tone}" d="${k.pathOf([head, left, right], true)}"/>`;

function arrow(x1, x2, y, z, tone = "lit") {
  const head = at([x2, y, z]);
  const left = at([x2 - 6.2, y - 2.6, z]);
  const right = at([x2 - 6.2, y + 2.6, z]);
  return (
    L(k.lineOnTop([x1, y], [x2 - 1.6, y], z, P), { tone, className: "flow-line", free: "end" }) +
    D([at([x1, y, z])], { size: 0.52, tone }) +
    arrowhead(head, left, right, tone)
  );
}

function routeArrow(points, z, tone = "lit") {
  const head = at(points.at(-1).concat(z));
  const last = points.at(-1);
  const prev = points.at(-2);
  const dx = last[0] - prev[0];
  const dy = last[1] - prev[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 2.6;
  const ny = (dx / len) * 2.6;
  const back = 6.2;
  const bx = last[0] - (dx / len) * back;
  const by = last[1] - (dy / len) * back;
  const left = at([bx + nx, by + ny, z]);
  const right = at([bx - nx, by - ny, z]);
  const path = k.onTop(points, z, P);
  return (
    L(path, { tone, className: "flow-line", free: "end" }) +
    D([at(points[0].concat(z))], { size: 0.5, tone }) +
    arrowhead(head, left, right, tone)
  );
}

function ruleSign(x, y, z, text = "AGENTS.md", { w = 54, d = 16, subtitle = "" } = {}) {
  const plan = { x, y, w, d, r: 1.5 };
  return (
    S(k.slabOf(plan, z, 4, P, 4, 0.5), { tone: "lo" }) +
    L(k.planOutline(plan, z + 4, P, 4), { tone: "faint" }) +
    topLabel(x + plan.w / 2, y + plan.d / 2 + (subtitle ? -3.8 : 0), text, z + 4.1, {
      size: subtitle ? 2.55 : 2.7
    }) +
    (subtitle
      ? topLabel(x + plan.w / 2, y + plan.d / 2 + 4.4, subtitle, z + 4.1, {
          size: 1.95,
          tone: "mid"
        })
      : "")
  );
}

function splitIsland(plan, label) {
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, -20, 12, P)}"/>`];
  out.push(feet(plan, -20, 8));
  out.push(S(k.slabOf(plan, -10, 18, P, 9, 1.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 5), 8, P, 9), { tone: "lo" }));
  out.push(
    topLabel(plan.x + plan.w / 2, plan.y + 13, label, 8.2, {
      size: 2.8,
      tone: "hi",
      anchor: "middle"
    })
  );
  return out.join("");
}

function codexScene() {
  const out = [base(BASE, "GENERATED STATE")];
  out.push(cardStack(-148, -8, 9, 3, "CHATS"));
  out.push(plinth(-80, -17, 61, 53, 9, 3));
  out.push(rollerPair(-72, 4, 12, "EXTRACT"));
  out.push(book(27, -4, 9, "MEMORY", { tone: "hi", w: 47, d: 31 }));
  out.push(tray(126, -13, 9, "NEXT CHAT", { w: 55, d: 48 }));
  out.push(ruleSign(112, -54, 9, "AGENTS.md"));
  out.push(arrow(-104, -83, 43, 10));
  out.push(arrow(-11, 21, 43, 10));
  out.push(arrow(88, 123, 43, 10));
  return out.join("");
}

function workbuddyScene() {
  const out = [base(BASE, "DESKTOP MEMORY")];
  out.push(cardStack(-153, -5, 9, 4, "CHATS"));
  out.push(plinth(-84, -24, 67, 56, 9, 4));
  out.push(dial(-50, 2, 13, "NIGHTLY", { r: 22 }));
  out.push(book(12, -9, 9, "SUMMARY", { w: 52, d: 33 }));
  out.push(fileDrawers(77, -17, 9, "HISTORY"));
  out.push(tray(142, -17, 9, "NEXT CHAT", { w: 43, d: 46, labelSize: 2.35 }));
  out.push(arrow(-103, -88, 42, 10));
  out.push(arrow(-8, 14, 42, 10));
  out.push(routeArrow([[64, 8], [73, -46], [132, -46], [140, -24]], 12));
  out.push(routeArrow([[122, 28], [132, 34], [136, 18], [140, 10]], 12));
  return out.join("");
}

function claudeCodeScene() {
  const out = [base(BASE, "REPO-SCOPED")];
  out.push(ruleSign(-160, -46, 9, "CLAUDE.md", { subtitle: "EVERY SESSION", d: 23 }));
  out.push(book(-147, 8, 9, "MEMORY.md", { w: 58, d: 30, h: 5 }));
  out.push(fileDrawers(-35, -12, 9, "TOPICS"));
  out.push(tray(112, -18, 9, "SESSION", { w: 68, d: 50 }));
  out.push(routeArrow([[-102, -38], [-20, -50], [87, -50], [108, -28]], 12));
  out.push(routeArrow([[-88, 23], [-60, 23], [-35, 12]], 11));
  out.push(routeArrow([[19, -2], [55, -2], [85, -4], [108, -2]], 11));
  out.push(topLabel(-9, 44, "ON DEMAND", 9.2, { size: 2.55 }));
  return out.join("");
}

function claudeDesktopScene() {
  const local = { x: -178, y: -61, w: 148, d: 112, r: 9 };
  const cloud = { x: 30, y: -61, w: 148, d: 112, r: 9 };
  const out = [];
  out.push(splitIsland(local, "LOCAL · ON DEVICE"));
  out.push(splitIsland(cloud, "ACCOUNT · CLOUD"));
  out.push(book(-151, -26, 9, "PROJECT", { w: 56, d: 31 }));
  out.push(tray(-154, 17, 9, "LOCAL MEMORY", { w: 62, d: 30 }));
  out.push(fileDrawers(54, -31, 9, "TOPICS"));
  out.push(tray(61, 22, 9, "CLOUD CHAT", { w: 61, d: 26 }));
  out.push(routeArrow([[-123, 5], [-123, 16]], 11));
  out.push(routeArrow([[92, 14], [92, 21]], 11));
  out.push(topLabel(-5, 47, "NO SYNC", 9.2, { size: 3.6, tone: "hi" }));
  out.push(L(k.lineOnTop([0, -35], [0, 35], 9.3, P), { tone: "faint", dashed: true, free: true }));
  return out.join("");
}

function openCodeScene() {
  const out = [base(BASE, "INSTRUCTIONS FIRST")];
  out.push(ruleSign(-159, -28, 9, "PROJECT RULES"));
  out.push(ruleSign(-159, -2, 9, "GLOBAL RULES"));
  out.push(plinth(-79, -22, 68, 55, 9, 4));
  out.push(S(k.cylinder(-45, 3, 15, 13, 8, P, 42), { tone: "mid" }));
  out.push(S(k.cylinder(-45, 3, 10, 21, 2, P, 42), { tone: "hi" }));
  out.push(topLabel(-45, 24, "COMBINE", 23.1, { size: 2.7 }));
  out.push(tray(38, -17, 9, "SESSION CONTEXT", { w: 81, d: 51 }));
  out.push(tray(122, -17, 9, "NO AUTO MEMORY", { w: 58, d: 51, tone: "lo", labelSize: 2.3 }));
  out.push(arrow(-158, -108, 43, 10));
  out.push(routeArrow([[-148, -42], [-120, -42], [-110, -26]], 11));
  out.push(routeArrow([[-148, -16], [-120, -16], [-110, -6]], 11));
  out.push(arrow(-9, 32, 43, 10));
  out.push(topLabel(152, 43, "NO TYPED STORE", 9.2, { size: 2.5 }));
  return out.join("");
}

function traeScene() {
  const out = [base(BASE, "LOCAL ONLY")];
  out.push(book(-153, -36, 9, "USER PROFILE", { w: 57, d: 33 }));
  out.push(book(-153, 7, 9, "PROJECT MEMORY", { w: 57, d: 33, labelSize: 2.3 }));
  out.push(plinth(-65, -20, 72, 57, 9, 5));
  out.push(S(k.cylinder(-29, 8, 16, 14, 4, P, 42), { tone: "mid" }));
  out.push(S(k.cylinder(-29, 8, 11, 18, 2, P, 42), { tone: "hi" }));
  out.push(topLabel(-29, 28, "SELECT", 20.1, { size: 2.7 }));
  out.push(tray(37, -13, 9, "CURRENT TASK", { w: 72, d: 52 }));
  out.push(ruleSign(124, -38, 9, "RULES", { w: 62, d: 24, subtitle: "NOT MEMORY" }));
  out.push(routeArrow([[-94, -20], [-55, -20], [-40, -7]], 12));
  out.push(routeArrow([[-94, 25], [-55, 25], [-40, 17]], 12));
  out.push(arrow(-10, 35, 42, 10));
  return out.join("");
}

function piScene() {
  const out = [base(BASE, "CONTEXT RECOVERY")];
  out.push(cardStack(-161, -28, 9, 3, "SESSION TREE", { labelSize: 2.0 }));
  out.push(card(-91, -28, 9, 48, 34, 3, "hi"));
  out.push(topLabel(-67, -11, "ACTIVE BRANCH", 12.2, { size: 2.25 }));
  out.push(card(-151, 17, 9, 42, 27, 3, "mid"));
  out.push(topLabel(-130, 30, "OLD ENTRIES", 12.2, { size: 2.15 }));
  out.push(card(-91, 17, 9, 48, 27, 3, "hi"));
  out.push(topLabel(-67, 27, "SUMMARY", 12.2, { size: 2.5 }));
  out.push(topLabel(-67, 35, "COMPACTION", 12.2, { size: 1.9, tone: "mid" }));
  out.push(tray(76, -18, 9, "MODEL CONTEXT", { w: 82, d: 50 }));
  out.push(ruleSign(81, 40, 9, "RAW ENTRIES KEPT", { w: 78, d: 14 }));
  out.push(arrow(-121, -95, -10, 11));
  out.push(routeArrow([[-43, -11], [5, -11], [30, -5], [72, 0]], 12));
  out.push(arrow(-107, -95, 30, 11));
  out.push(routeArrow([[-43, 30], [-10, 30], [22, 22], [72, 18]], 10));
  return out.join("");
}

function hermesScene() {
  const out = [base(BASE, "FROZEN SNAPSHOT")];
  out.push(gaugeBin(-157, -36, 9, "MEMORY", "2,200", { fill: 0.67, w: 54, d: 38, h: 34 }));
  out.push(gaugeBin(-157, 8, 9, "USER", "1,375", { fill: 0.72, w: 54, d: 38, h: 29 }));
  out.push(plinth(46, -22, 93, 59, 9, 5));
  out.push(S(k.slabOf({ x: 56, y: -12, w: 73, d: 39, r: 4 }, 14, 25, P, 6, 0.9), { tone: "mid" }));
  out.push(L(k.planOutline({ x: 62, y: -6, w: 61, d: 27, r: 3 }, 39, P, 6), { tone: "lo" }));
  out.push(topLabel(92, 5, "SNAPSHOT", 39.2, { size: 2.9 }));
  out.push(topLabel(92, 18, "FROZEN PROMPT", 39.2, { size: 2, tone: "mid" }));
  out.push(tray(141, -17, 9, "SESSION", { w: 38, d: 50, labelSize: 2.55 }));
  out.push(routeArrow([[-99, -26], [-33, -26], [0, -11], [54, -11]], 42));
  out.push(routeArrow([[-99, 17], [-33, 17], [0, 4], [54, 4]], 34));
  out.push(arrow(137, 157, 42, 10));
  out.push(ruleSign(8, 36, 9, "LIVE WRITE → DISK", { w: 82, d: 14 }));
  return out.join("");
}

const AGENTS = [
  {
    slug: "codex",
    fig: "Fig 2",
    title: "Codex · generated local memory",
    hint: "Official · generated soft recall",
    readout: "CHATS → EXTRACT → MEMORY → NEXT CHAT",
    scene: codexScene,
    flow: [["CHATS", "EXTRACT", "LOCAL MEMORY", "NEXT CHAT"]],
    note: "Codex updates local memory in the background from eligible chats. Treat it as recall, not as mandatory rules; always-on guidance belongs in AGENTS.md."
  },
  {
    slug: "workbuddy",
    fig: "Fig 3",
    title: "WorkBuddy · nightly memory",
    hint: "Official · desktop mechanism",
    readout: "CONVERSATIONS → NIGHTLY → SUMMARY + SEARCH",
    scene: workbuddyScene,
    flow: [
      ["CONVERSATIONS", "NIGHTLY SUMMARY", "NEXT CHAT"],
      ["PAST SESSIONS", "SEARCH", "RECALL"]
    ],
    note: "WorkBuddy refreshes a private memory summary every night, injects relevant memory as background context, and also supports past-session retrieval."
  },
  {
    slug: "claude-code",
    fig: "Fig 4",
    title: "Claude Code · index + topics",
    hint: "Official · repo scoped",
    readout: "CLAUDE.md → SESSION · MEMORY.md → TOPICS",
    scene: claudeCodeScene,
    flow: [
      ["CLAUDE.md", "EVERY SESSION"],
      ["MEMORY.md (≤ 200 LINES)", "TOPIC FILES · ON DEMAND"]
    ],
    note: "CLAUDE.md carries instructions. Auto memory uses a small MEMORY.md index plus topic files; only the first 200 lines or 25 KB of the index load at session start."
  },
  {
    slug: "claude-desktop",
    fig: "Fig 5",
    title: "Claude Desktop · separate scopes",
    hint: "Official · local ≠ account",
    readout: "LOCAL PROJECT MEMORY ≠ ACCOUNT MEMORY",
    scene: claudeDesktopScene,
    flow: [
      ["LOCAL PROJECT", "LOCAL MEMORY"],
      ["ACCOUNT TOPICS", "CHAT + CLOUD COWORK"],
      ["NO SYNC"]
    ],
    note: "Local Cowork memory stays on the device. Account-side Chat and cloud-Cowork memory are a separate topic system. The two sides do not sync."
  },
  {
    slug: "opencode",
    fig: "Fig 6",
    title: "OpenCode · instructions first",
    hint: "Official · no typed auto memory",
    readout: "AGENTS.md + CONFIG → SESSION CONTEXT",
    scene: openCodeScene,
    flow: [
      ["PROJECT / GLOBAL RULES + CONFIG", "SESSION CONTEXT"],
      ["NO TYPED AUTO MEMORY"]
    ],
    note: "OpenCode's durable context is instruction-first: project and global AGENTS.md files, plus configured instruction sources. Persistent sessions are not a typed user-memory store."
  },
  {
    slug: "trae",
    fig: "Fig 7",
    title: "Trae · profile + project",
    hint: "Official · two memory scopes",
    readout: "USER PROFILE + PROJECT MEMORY → TASK",
    scene: traeScene,
    flow: [
      ["USER PROFILE + PROJECT MEMORY", "CURRENT TASK"],
      ["RULES", "SEPARATE INSTRUCTIONS"]
    ],
    note: "Trae keeps user_profile.md and project_memory.md as separate local memory scopes. Rules live elsewhere and remain instructions, not memories."
  },
  {
    slug: "pi",
    fig: "Fig 8",
    title: "Pi · session tree + compaction",
    hint: "Official · context recovery",
    readout: "ENTRIES → ACTIVE BRANCH → MODEL CONTEXT",
    scene: piScene,
    flow: [
      ["SESSION ENTRIES", "ACTIVE BRANCH", "MODEL CONTEXT"],
      ["OLD ENTRIES", "COMPACTION SUMMARY", "MODEL CONTEXT"]
    ],
    note: "Pi persists a branching session tree. Compaction adds a summary and keeps recent messages, but the original session entries remain stored."
  },
  {
    slug: "hermes",
    fig: "Fig 9",
    title: "Hermes · two bounded files",
    hint: "Official · frozen at session start",
    readout: "MEMORY + USER → FROZEN SNAPSHOT → SESSION",
    scene: hermesScene,
    flow: [
      ["MEMORY.md + USER.md", "FROZEN SNAPSHOT", "SESSION"],
      ["LIVE WRITES", "DISK", "NEXT SESSION"]
    ],
    note: "Hermes injects MEMORY.md and USER.md as a frozen snapshot at session start. Writes persist immediately to disk but become visible to the prompt only in a later session."
  }
];

const flowHtml = (flow) =>
  `<div class="agent-flow">${flow
    .map(
      (route) =>
        `<div class="agent-route">${route
          .map((item, index) =>
            item === "NO SYNC"
              ? `<span class="agent-barrier">NO SYNC</span>`
              : `${index ? '<span class="agent-arrow">→</span>' : ""}<span class="agent-step">${item}</span>`
          )
          .join("")}</div>`
    )
    .join("")}</div>`;

const pages = AGENTS.map((agent) => {
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: `${agent.title} memory mechanism diagram. ${agent.note}`,
    body: agent.scene()
  });
  const body = `<div class="agent-section" id="${agent.slug}">
    ${k.plateHtml({
      fig: agent.fig,
      title: agent.title,
      hint: agent.hint,
      readout: agent.readout,
      keys: [],
      caption: "",
      body: `<div class="agent-stage">${svg}</div>${flowHtml(agent.flow)}<p class="agent-note">${agent.note}</p>`
    })}
  </div>`;
  return body;
}).join("");

const page = k
  .pageHtml({
    title: "Agent memory mechanisms — individual diagrams",
    theme: "light",
    body: `<header class="atlas-head"><p>OFFICIAL CONTRACT ATLAS · 2026-11-02</p><h1>Eight memory mechanisms</h1><p>Simple, product-specific views. WorkBuddy means the desktop app only.</p></header>${pages}`,
    script: "",
    width: 980
  })
  .replace(
    "</style></head>",
    `.atlas-head{max-width:760px;margin:0 0 28px}.atlas-head p{margin:0 0 8px;color:var(--anatomy-muted);font:11px/1.5 var(--anatomy-mono);letter-spacing:.09em;text-transform:uppercase}.atlas-head h1{margin:0 0 8px;color:var(--anatomy-strong);font:500 34px/1.05 var(--anatomy-mono);letter-spacing:-.04em}
     .agent-section{margin:34px 0 52px}
     .agent-section .iso-plate-corner{font-size:13.5px}
     .agent-stage{pointer-events:none}
     .flow-line{stroke-width:1.5}
     .flow-head{fill:var(--anatomy-lit);stroke:none}
     .flow-head[data-tone="hi"]{fill:var(--anatomy-hi)}
     .agent-flow{display:grid;justify-items:center;gap:8px;margin:8px 14px 0;padding-top:14px;border-top:1px solid var(--anatomy-mid);font-family:var(--anatomy-mono);font-size:15px;line-height:1.35;letter-spacing:.045em;color:var(--anatomy-strong);text-transform:uppercase}
     .agent-route{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:7px 9px}
     .agent-step{padding:6px 10px;border:1px solid var(--anatomy-mid);background:var(--anatomy-paper)}
     .agent-arrow{color:var(--anatomy-hi);font-size:16px}
     .agent-barrier{padding:5px 10px;border:1px dashed var(--anatomy-hi);color:var(--anatomy-hi)}
     .agent-note{max-width:840px;margin:12px auto 0;color:var(--anatomy-text);font-size:15.5px;line-height:1.55;text-align:center}
     @media(max-width:640px){.atlas-head h1{font-size:26px}.agent-section .iso-plate-corner[data-corner="title"]{font-size:12px}.agent-section .iso-plate-corner[data-corner="readout"]{display:none}.agent-flow{font-size:14.5px;gap:10px}.agent-route{flex-direction:column;width:100%;gap:4px}.agent-step{width:min(100%,360px);padding:6px 8px;text-align:center}.agent-arrow{transform:rotate(90deg);line-height:1}.agent-barrier{text-align:center}.agent-note{font-size:15px;padding:0 10px}}
    </style></head>`
  );

writeFileSync(join(HERE, "index.html"), page);
const svgDir = join(HERE, "../../assets/agents/svg");
mkdirSync(svgDir, { recursive: true });
for (const agent of AGENTS) {
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: `${agent.title} memory mechanism diagram. ${agent.note}`,
    body: agent.scene(),
    standalone: "light"
  });
  writeFileSync(join(svgDir, `${agent.slug}.svg`), svg);
}
console.log(`wrote index.html with ${AGENTS.length} agent diagrams`);
