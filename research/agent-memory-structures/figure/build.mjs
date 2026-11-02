import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./vendor/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 760;
const HEIGHT = 590;
const BASE = { x: -160, y: -78, w: 320, d: 156, r: 9 };
const CAB = { x: -142, y: -48, w: 284, d: 96, r: 6 };
const FRONT = CAB.y + CAB.d;
const SHELF_Z = [12, 68, 124, 180];
const DRAWER_H = 34;
const CAB_TOP = 222;
const AJAR = 8;
const OPEN = 34;

const DRAWERS = [
  {
    name: "Codex",
    short: "extract → consolidate",
    readout: "1 · Codex · summaries + evidence",
    detail: "two-stage extraction and merge",
    face: "01 · CODEX"
  },
  {
    name: "WorkBuddy",
    short: "nightly summary",
    readout: "2 · WorkBuddy · nightly summary + recall",
    detail: "desktop memory differs from the CLI",
    face: "02 · WORKBUDDY"
  },
  {
    name: "Claude Code",
    short: "index + topics",
    readout: "3 · Claude Code · index + topic files",
    detail: "first 200 lines / 25 KB auto-load",
    face: "03 · CLAUDE CODE"
  },
  {
    name: "Claude Desktop",
    short: "project + account",
    readout: "4 · Claude Desktop · local project + account",
    detail: "project and account memory are separate",
    face: "04 · CLAUDE DESKTOP"
  },
  {
    name: "OpenCode",
    short: "instructions first",
    readout: "5 · OpenCode · instructions + sessions",
    detail: "no documented typed auto memory",
    face: "05 · OPENCODE"
  },
  {
    name: "Trae",
    short: "profile + project",
    readout: "6 · Trae · user profile + project memory",
    detail: "rules and memory stay separate",
    face: "06 · TRAE"
  },
  {
    name: "Pi",
    short: "session tree",
    readout: "7 · Pi · session tree + compaction",
    detail: "episode evidence is not a person profile",
    face: "07 · PI"
  },
  {
    name: "Hermes",
    short: "bounded snapshot",
    readout: "8 · Hermes · two files + frozen snapshot",
    detail: "2,200 / 1,375 character budgets",
    face: "08 · HERMES"
  }
];

const MEMORY_KEY = [
  ["01", "Codex", "Two-stage rollout summaries with evidence"],
  ["02", "WorkBuddy", "Nightly desktop summary + session recall"],
  ["03", "Claude Code", "Small index + on-demand topic files"],
  ["04", "Claude Desktop", "Local project memory ≠ account memory"],
  ["05", "OpenCode", "Instructions first; sessions stay episodes"],
  ["06", "Trae", "Global user profile + project memory"],
  ["07", "Pi", "Branching session tree + compaction"],
  ["08", "Hermes", "Two bounded files, frozen at session start"]
];

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -20, 0),
    [-150, -55, CAB_TOP + 42],
    [150, 55, CAB_TOP + 42]
  ],
  WIDTH,
  HEIGHT,
  { pad: 28, azimuth: 44, elevation: 32 }
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const arrowOnTop = (x1, x2, y, z, tone = "mid") => {
  const head = at([x2, y, z]);
  const left = at([x2 - 5, y - 2.4, z]);
  const right = at([x2 - 5, y + 2.4, z]);
  return (
    L(k.lineOnTop([x1, y], [x2 - 1.2, y], z, P), { tone, className: "memory-flow" }) +
    D([at([x1, y, z])], { size: 0.58, tone }) +
    `<path class="memory-arrowhead" data-tone="${tone}" d="${k.pathOf([head, left, right], true)}"/>`
  );
};
const byDepth = (points) =>
  [...points].sort(
    (a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P)
  );

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -20, 12, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 24))) {
    out.push(S(k.cylinder(x, y, 7.5, -20, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.8, -18.2, 6.2, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, -12, 12, P, 9, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P, 9), { tone: "lo" }));
  const screws = k.corners(BASE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.48 }));

  const label = { x: -108, y: 54, w: 62, d: 11, r: 1.6 };
  out.push(S(k.slabOf(label, 0, 1, P, 3), { tone: "lo", crease: "none" }));
  out.push(
    L(
      [42, 33, 48]
        .map((width, index) =>
          k.lineOnTop(
            [label.x + 5, label.y + 3 + index * 2.8],
            [label.x + 5 + width, label.y + 3 + index * 2.8],
            1,
            P
          )
        )
        .join(""),
      { tone: "lo", free: true }
    )
  );
  out.push(D([at([label.x + label.w - 3, label.y + 5.5, 1])], { size: 0.42 }));

  const strip = { x: 44, y: 57, w: 100, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function indexDrum() {
  const out = [];
  const cx = 0;
  const cy = -10;
  const z = CAB_TOP + 18;
  out.push(S(k.cylinder(cx, cy, 31, z, 3.5, P, 72, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, 27, z + 3.5, 2.2, P, 72, 0.7), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, 31, z, z + 3.5, 84, P, 0.18), { tone: "lo" }));
  out.push(L(k.sideArc(cx, cy, 31, z + 3.5, P, 42), { tone: "faint" }));
  out.push(L(k.ring(cx, cy, 23.5, z + 5.7, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(cx, cy, 27, 32, 4, z + 5.7, [1.1, 2.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const detents = Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2;
    return at([cx + Math.sin(angle) * 20, cy - Math.cos(angle) * 20, z + 8.8]);
  });
  out.push(D(detents, { size: 0.55, tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, 5.2, z + 5.7, 2.8, P, 28), { tone: "hi" }));
  out.push(L(k.ring(cx, cy, 3.1, z + 8.5, P, 28), { tone: "mid" }));

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const needle = k.lineOnTop(
      [cx - Math.sin(angle) * 3.8, cy + Math.cos(angle) * 3.8],
      [cx + Math.sin(angle) * 20, cy - Math.cos(angle) * 20],
      z + 8.8,
      P
    );
    out.push(
      `<g class="dial-needle" data-needle="${index}"${index === 0 ? "" : ' style="display:none"'}>${L(
        needle,
        { tone: "hi" }
      )}</g>`
    );
  }
  out.push(
    `<g class="dial-tip" data-tip="0">${D([detents[0]], { size: 0.8, tone: "hi" })}</g>`
  );
  for (let index = 1; index < 8; index += 1) {
    out.push(
      `<g class="dial-tip" data-tip="${index}" style="display:none">${D([detents[index]], {
        size: 0.8,
        tone: "hi"
      })}</g>`
    );
  }

  const mount = { x: -25, y: -20, w: 50, d: 16, r: 4 };
  out.push(S(k.slabOf(mount, CAB_TOP + 8, 10, P, 5, 0.7), { tone: "mid" }));
  out.push(D([at([-19, -13, CAB_TOP + 18]), at([19, -13, CAB_TOP + 18])], { size: 0.42 }));
  return out.join("");
}

function cabinet() {
  const out = [];
  out.push(S(k.slabOf({ x: CAB.x, y: CAB.y, w: CAB.w, d: 7, r: 5 }, 10, CAB_TOP - 18, P, 7, 1.1), { tone: "mid" }));
  out.push(L(k.sideSeam({ x: CAB.x, y: CAB.y, w: CAB.w, d: 7, r: 5 }, 84, P, 7), { tone: "faint" }));
  out.push(L(k.sideSeam({ x: CAB.x, y: CAB.y, w: CAB.w, d: 7, r: 5 }, 158, P, 7), { tone: "faint" }));
  out.push(D([-126, -74, -22, 30, 82, 126].flatMap((x) => [at([x, CAB.y + 7, 38]), at([x, CAB.y + 7, 188])]), { size: 0.38 }));

  for (const z of SHELF_Z) {
    out.push(S(k.slabOf(CAB, z, 4, P, 8, 1), { tone: "mid" }));
    const edge = { x: CAB.x, y: FRONT - 4, w: CAB.w, d: 4, r: 1.2 };
    out.push(S(k.slabOf(edge, z + 4, 2.4, P, 3, 0.5), { tone: "lo" }));
    out.push(D([-125, -100, -75, -50, -25, 0, 25, 50, 75, 100, 125].map((x) => at([x, FRONT, z + 6.4])), { size: 0.32 }));
  }

  for (const [x, y] of byDepth([
    [CAB.x + 4, CAB.y + 4],
    [CAB.x + CAB.w - 4, CAB.y + 4],
    [CAB.x + 4, FRONT - 4],
    [CAB.x + CAB.w - 4, FRONT - 4]
  ])) {
    out.push(S(k.cylinder(x, y, 5.4, 6, 3.5, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 3.8, 9.5, CAB_TOP - 18, P, 24), { tone: "mid", crease: "none" }));
    for (const z of [78, 134, 190]) out.push(L(k.sideArc(x, y, 3.8, z, P, 16), { tone: "faint" }));
    out.push(S(k.cylinder(x, y, 4.5, CAB_TOP - 8.5, 2.2, P, 24), { tone: "mid" }));
  }

  out.push(S(k.slabOf({ x: -3, y: CAB.y + 6, w: 6, d: CAB.d - 10, r: 2 }, 16, CAB_TOP - 30, P, 4, 0.6), { tone: "mid" }));
  const top = { x: -150, y: -56, w: 300, d: 112, r: 8 };
  out.push(S(k.slabOf(top, CAB_TOP, 8, P, 9, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(top, 5), CAB_TOP + 8, P, 9), { tone: "lo" }));
  out.push(L(k.sideSeam(top, CAB_TOP + 3.2, P, 9), { tone: "faint" }));
  const screws = k.corners(top, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.1, CAB_TOP + 8, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, CAB_TOP + 8])), { size: 0.44 }));
  out.push(
    k.faceTextSvg(
      k.topMatrix([0, 37], CAB_TOP + 8, P, "x"),
      "MEMORY ARCHIVE · 8",
      { size: 3, tone: "mid", anchor: "middle" }
    )
  );
  const plate = { x: -138, y: 26, w: 276, d: 10, r: 1.5 };
  out.push(S(k.slabOf(plate, CAB_TOP + 8, 0.7, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(plate, CAB_TOP + 8.7, P, 4), { tone: "faint" }));
  out.push(D([at([-132, 31, CAB_TOP + 8.7]), at([132, 31, CAB_TOP + 8.7])], { size: 0.4 }));
  const rail = [
    ["CAPTURE", -116],
    ["EXTRACT", -60],
    ["PERSIST", 3],
    ["INJECT", 78]
  ];
  rail.forEach(([label, x]) => {
    out.push(
      k.faceTextSvg(k.topMatrix([x, 31], CAB_TOP + 8.7, P, "x"), label, {
        size: 3.9,
        tone: "lit",
        anchor: "middle"
      })
    );
  });
  out.push(arrowOnTop(-101, -78, 31, CAB_TOP + 8.8, "lit"));
  out.push(arrowOnTop(-44, -16, 31, CAB_TOP + 8.8, "lit"));
  out.push(arrowOnTop(18, 61, 31, CAB_TOP + 8.8, "lit"));
  out.push(indexDrum());
  return out.join("");
}

function tray(x, z) {
  const out = [];
  const plan = { x: x + 4, y: -25, w: 112, d: FRONT - 4 + 25, r: 2 };
  out.push(S(k.slabOf(plan, z, 2, P, 4, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 4), z + 2, P, 4), { tone: "faint" }));
  out.push(S(k.slabOf({ x: x + 4, y: -28, w: 112, d: 3, r: 1 }, z, 12, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x + 4, y: -25, w: 3, d: FRONT + 21, r: 1 }, z, 7, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x + 113, y: -25, w: 3, d: FRONT + 21, r: 1 }, z, 7, P, 3, 0.4), { tone: "mid" }));
  return out.join("");
}

function cards(x, y, z, widths, heights = 2) {
  const out = [];
  widths.forEach((width, index) => {
    const yy = y + index * 2.2;
    out.push(
      S(k.slabOf({ x, y: yy, w: width, d: 17, r: 1.2 }, z + index * (heights + 0.2), heights, P, 3, 0.3), {
        tone: index === 0 ? "hi" : "mid",
        crease: "faint"
      })
    );
    out.push(D([at([x + 3, yy + 3, z + index * (heights + 0.2) + heights])], { size: 0.34, tone: "mid" }));
  });
  return out.join("");
}

function interior(index, x, z) {
  const out = [];
  if (index === 0) {
    out.push(cards(x + 10, 8, z, [16, 13, 10]));
    out.push(S(k.slabOf({ x: x + 38, y: 9, w: 26, d: 23, r: 2 }, z, 2, P, 3, 0.4), { tone: "hi" }));
    out.push(L(k.planOutline({ x: x + 42, y: 13, w: 18, d: 15, r: 2 }, z + 2, P, 3), { tone: "faint" }));
    out.push(D([at([x + 45, 17, z + 2]), at([x + 45, 23, z + 2]), at([x + 45, 29, z + 2])], { size: 0.35 }));
    out.push(S(k.slabOf({ x: x + 70, y: 10, w: 27, d: 24, r: 2 }, z, 4, P, 3, 0.5), { tone: "mid" }));
    out.push(S(k.cylinder(x + 96, 12, 7, z, 7, P, 36), { tone: "hi" }));
    out.push(L(k.knurl(x + 96, 12, 7, z, z + 7, 24, P, 0.2), { tone: "lo" }));
    out.push(L(k.sideArc(x + 96, 12, 7, z + 7, P, 20), { tone: "faint" }));
    out.push(D([at([x + 76, 16, z + 4]), at([x + 76, 22, z + 4]), at([x + 76, 28, z + 4])], { size: 0.3 }));
  } else if (index === 1) {
    out.push(S(k.slabOf({ x: x + 8, y: 7, w: 29, d: 24, r: 2 }, z, 2, P, 3, 0.4), { tone: "hi" }));
    out.push(S(k.slabOf({ x: x + 40, y: 4, w: 3, d: 33, r: 1 }, z, 11, P, 3, 0.4), { tone: "mid" }));
    out.push(cards(x + 46, 8, z, [18, 15]));
    out.push(S(k.slabOf({ x: x + 72, y: 20, w: 29, d: 16, r: 2 }, z, 2, P, 3, 0.4), { tone: "hi" }));
    out.push(S(k.cylinder(x + 91, 8, 9, z, 4, P, 40), { tone: "mid" }));
    out.push(L(k.radialTicks(x + 91, 8, 7, 12, 3, z + 4, [0.8, 1.8], P).minor, { tone: "lo" }));
    out.push(L(k.radialTicks(x + 91, 8, 7, 12, 3, z + 4, [0.8, 1.8], P).major, { tone: "mid" }));
    out.push(L(k.lineOnTop([x + 91, 8], [x + 91, 13], z + 4.2, P), { tone: "hi" }));
    out.push(D([at([x + 76, 33, z + 2]), at([x + 82, 33, z + 2]), at([x + 88, 33, z + 2])], { size: 0.35 }));
  } else if (index === 2) {
    out.push(S(k.slabOf({ x: x + 8, y: 9, w: 28, d: 27, r: 2 }, z, 2, P, 3, 0.4), { tone: "hi" }));
    out.push(L(k.planOutline({ x: x + 12, y: 13, w: 20, d: 19, r: 2 }, z + 2, P, 3), { tone: "faint" }));
    out.push(D([at([x + 16, 18, z + 2]), at([x + 16, 23, z + 2]), at([x + 16, 28, z + 2])], { size: 0.31 }));
    out.push(S(k.slabOf({ x: x + 42, y: 4, w: 50, d: 2, r: 1 }, z, 4, P, 3), { tone: "mid" }));
    for (let slot = 0; slot < 4; slot += 1) {
      const y = 8 + slot * 8;
      out.push(S(k.slabOf({ x: x + 48, y, w: 38, d: 5, r: 1.2 }, z, 3, P, 3, 0.3), { tone: slot === 0 ? "hi" : "mid" }));
      out.push(D([at([x + 84, y + 2.5, z + 3])], { size: 0.34 }));
    }
    out.push(S(k.slabOf({ x: x + 91, y: 3, w: 2, d: 39, r: 1 }, z, 6, P, 3), { tone: "mid" }));
  } else if (index === 3) {
    out.push(S(k.slabOf({ x: x + 46, y: 2, w: 3, d: 39, r: 1 }, z, 13, P, 3, 0.4), { tone: "mid" }));
    out.push(cards(x + 8, 8, z, [23, 19]));
    out.push(S(k.slabOf({ x: x + 58, y: 5, w: 2, d: 34, r: 1 }, z + 2, 8, P, 3), { tone: "lo" }));
    out.push(cards(x + 66, 8, z, [22, 18, 14]));
    out.push(S(k.slabOf({ x: x + 92, y: 30, w: 16, d: 8, r: 2 }, z, 2, P, 3, 0.3), { tone: "hi" }));
  } else if (index === 4) {
    out.push(S(k.slabOf({ x: x + 8, y: 8, w: 41, d: 24, r: 2 }, z, 2, P, 4, 0.4), { tone: "hi" }));
    out.push(L(k.planOutline({ x: x + 12, y: 12, w: 33, d: 16, r: 2 }, z + 2, P, 4), { tone: "faint" }));
    out.push(S(k.slabOf({ x: x + 56, y: 4, w: 45, d: 32, r: 2 }, z, 3, P, 4, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf({ x: x + 63, y: 8, w: 31, d: 16, r: 2 }, z + 3, 2, P, 3, 0.3), { tone: "hi" }));
    out.push(S(k.cylinder(x + 91, 28, 8, z, 7, P, 40), { tone: "hi" }));
    out.push(L(k.sideArc(x + 91, 28, 8, z + 7, P, 24), { tone: "faint" }));
    out.push(L(k.lineOnTop([x + 84, 28], [x + 98, 28], z + 7, P), { tone: "mid" }));
  } else if (index === 5) {
    out.push(S(k.slabOf({ x: x + 8, y: 8, w: 30, d: 21, r: 2 }, z, 2, P, 3, 0.4), { tone: "hi" }));
    out.push(S(k.slabOf({ x: x + 43, y: 8, w: 29, d: 21, r: 2 }, z, 2, P, 3, 0.4), { tone: "hi" }));
    out.push(S(k.slabOf({ x: x + 38, y: 4, w: 3, d: 30, r: 1 }, z, 11, P, 3), { tone: "mid" }));
    out.push(cards(x + 78, 10, z, [19, 15, 11]));
    out.push(D([at([x + 13, 13, z + 2]), at([x + 48, 13, z + 2])], { size: 0.36 }));
  } else if (index === 6) {
    out.push(S(k.cylinder(x + 52, 24, 4.5, z, 6, P, 28), { tone: "hi" }));
    const hub = at([x + 52, 24, z + 6.4]);
    const leaves = [
      [x + 18, 9],
      [x + 48, 36],
      [x + 82, 12]
    ];
    leaves.forEach(([lx, ly], leaf) => {
      out.push(k.wireSvg(hub, at([lx, ly, z + 4]), { via: [at([(x + 52 + lx) / 2, (24 + ly) / 2, z + 7])], tone: "mid", size: 0.65 }));
      out.push(S(k.slabOf({ x: lx - 9, y: ly - 7, w: 18, d: 14, r: 2 }, z, 3, P, 3, 0.3), {
        tone: leaf === 0 ? "hi" : "mid"
      }));
      out.push(D([at([lx, ly, z + 3])], { size: 0.35 }));
    });
    out.push(S(k.cylinder(x + 92, 30, 8, z, 7, P, 40), { tone: "hi" }));
    out.push(L(k.knurl(x + 92, 30, 8, z, z + 7, 28, P, 0.2), { tone: "lo" }));
    out.push(L(k.sideArc(x + 92, 30, 8, z + 7, P, 24), { tone: "faint" }));
  } else {
    out.push(S(k.cylinder(x + 29, 20, 10, z, 4, P, 48), { tone: "mid" }));
    out.push(S(k.cylinder(x + 70, 20, 10, z, 4, P, 48), { tone: "mid" }));
    for (const cx of [x + 29, x + 70]) {
      out.push(L(k.ring(cx, 20, 7.5, z + 4, P, 40), { tone: "lo" }));
      const ticks = k.radialTicks(cx, 20, 9, 20, 5, z + 4, [0.9, 2], P);
      out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
      out.push(L(k.lineOnTop([cx, 20], [cx, 12.5], z + 4.2, P), { tone: "hi" }));
      out.push(D([at([cx, 20, z + 4])], { size: 0.55, tone: "hi" }));
    }
    out.push(S(k.slabOf({ x: x + 8, y: 4, w: 95, d: 3, r: 1 }, z + 8, 3, P, 3), { tone: "hi" }));
    out.push(S(k.slabOf({ x: x + 8, y: 4, w: 4, d: 8, r: 1 }, z + 4, 4, P, 2), { tone: "mid" }));
    out.push(S(k.slabOf({ x: x + 99, y: 4, w: 4, d: 8, r: 1 }, z + 4, 4, P, 2), { tone: "mid" }));
  }
  return out.join("");
}

function drawer(index) {
  const col = index % 2;
  const row = Math.floor(index / 2);
  const x = col === 0 ? -128 : 8;
  const z = SHELF_Z[3 - row] + 4;
  const shift = index === 0 ? OPEN : AJAR;
  const out = [tray(x, z), interior(index, x, z)];
  const faceY = FRONT;
  const face = { x: x + 2, y: faceY - 4, w: 116, d: 4, r: 2.5 };
  out.push(`<g class="drawer-front">`);
  out.push(S(k.slabOf(face, z + 1, DRAWER_H - 2, P, 5, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(face, 3), z + DRAWER_H - 1, P, 5), { tone: "faint" }));
  out.push(L(k.sideSeam(face, z + 4, P, 5), { tone: "faint" }));
  const holder = { x: x + 38, y: faceY, w: 44, d: 2.2, r: 1.5 };
  out.push(S(k.slabOf(holder, z + 20, 9, P, 3, 0.35), { tone: "mid" }));
  const dotY = faceY + 1;
  const dots = Array.from({ length: index + 1 }, (_, pin) =>
    at([x + 64 - (index * 1.55) / 2 + pin * 1.55, dotY, z + 24.5])
  );
  out.push(D(dots, { size: 0.4, tone: "mid" }));
  const pull = { x: x + 43, y: faceY, w: 34, d: 6, r: 2.2 };
  out.push(S(k.slabOf({ x: x + 47, y: faceY, w: 3, d: 2.8, r: 1 }, z + 14, 4, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x + 70, y: faceY, w: 3, d: 2.8, r: 1 }, z + 14, 4, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf(pull, z + 17, 3.5, P, 4, 0.4), { tone: "mid" }));
  out.push(D([at([x + 47, faceY + 3, z + 20.5]), at([x + 73, faceY + 3, z + 20.5])], { size: 0.32 }));
  out.push(
    k.faceTextSvg(k.sideMatrix([x + 58, faceY + 0.2], z + 6.2, P, "right"), DRAWERS[index].face, {
      size: 4.2,
      tone: "hi",
      anchor: "middle"
    })
  );
  out.push(`</g>`);
  out.push(
    `<path class="drawer-hit" data-hit="${index}" fill="transparent" d="${k.pathOf(
      [
        at([face.x, face.y, z]),
        at([face.x + face.w, face.y, z]),
        at([face.x + face.w, face.y, z + DRAWER_H]),
        at([face.x, face.y, z + DRAWER_H])
      ],
      true
    )}"/>`
  );
  return `<g class="drawer" id="drawer-${index + 1}" data-drawer="${index + 1}" data-on="${
    index === 0 ? "true" : "false"
  }" role="option" aria-selected="${index === 0 ? "true" : "false"}" tabindex="-1" transform="${k.translateAlong(
    P,
    [0, shift, 0]
  )}">${out.join("")}</g>`;
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A static eight-drawer memory archive cabinet. Each labeled drawer contains a different physical model of persistent agent memory: staged summaries, a nightly clock, an index with topic cards, project compartments, instruction plates, profile and project pockets, a branching session rack, and two bounded gauges. A top rail uses static arrows to show capture, extraction, persistence, and injection.",
  body: [base(), cabinet(), ...DRAWERS.map((_, index) => drawer(index))]
});

const keys = [
  { mark: "lit", label: "Open drawer: the native memory unit" },
  { mark: "raised", label: "Face label: how that product collects, writes, or recalls" },
  { mark: "dotted", label: "Top rail: common lifecycle, not a shared schema" }
];

const caption =
  "1 Codex consolidates in two stages. 2 WorkBuddy writes a nightly desktop summary and recalls it with session search. " +
  "3 Claude Code keeps an index plus on-demand topic files. 4 Claude Desktop separates local project memory from account memory. " +
  "5 OpenCode remains instruction-first. 6 Trae keeps a user profile beside project memory. " +
  "7 Pi persists a branching session tree and compaction records. 8 Hermes freezes two bounded files at session start. " +
  "The top arrows describe a common lifecycle; they do not erase the different native units, writers, scopes, and injection rules.";

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Agent memory · eight mechanisms",
  hint: "Static · process ≠ shared schema",
  readout: "CAPTURE → EXTRACT → PERSIST → INJECT",
  keys,
  caption,
  body: `<div class="iso-stage" role="img" aria-label="Static eight-drawer memory archive with static process arrows and a numbered English key to eight product memory mechanisms">${svg}</div>
    <div class="memory-key" aria-label="Memory mechanism key">
      ${MEMORY_KEY.map(
        ([index, name, note]) =>
          `<div class="memory-key-item"><span class="memory-key-index">${index}</span><span><strong>${name}</strong><small>${note}</small></span></div>`
      ).join("")}
    </div>`
});

const page = k
  .pageHtml({
    title: "Agent memory archive — static",
    theme,
    body,
    script: "",
    width: 980
  })
  .replace(
    "</style></head>",
    `.iso-stage{pointer-events:none}
     .memory-flow{stroke-width:1.15}
     .memory-arrowhead{stroke:none;fill:var(--anatomy-hi)}
     .memory-arrowhead[data-tone="lit"]{fill:var(--anatomy-lit)}
     .memory-arrowhead[data-tone="hi"]{fill:var(--anatomy-hi)}
     .memory-key{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 18px;margin:22px 2px 0;padding:16px 2px 0;border-top:1px solid var(--anatomy-mid)}
     .memory-key-item{display:grid;grid-template-columns:24px 1fr;gap:7px;align-items:start;min-width:0}
     .memory-key-index{font-family:var(--anatomy-mono);font-size:11px;line-height:1.35;color:var(--anatomy-hi);letter-spacing:.08em}
     .memory-key strong{display:block;color:var(--anatomy-strong);font-family:var(--anatomy-mono);font-size:11.5px;line-height:1.35;letter-spacing:.04em;text-transform:uppercase}
     .memory-key small{display:block;margin-top:2px;color:var(--anatomy-muted);font-size:11px;line-height:1.4}
     .drawer[data-on="true"] .drawer-front .iso-fill{fill:var(--anatomy-face)}
     .drawer[data-on="true"] .drawer-front .iso-top{fill:var(--anatomy-lit-top)}
     .drawer[data-on="true"] .drawer-front .iso-shade{fill:var(--anatomy-lit-shade)}
     .drawer[data-on="true"] .drawer-front .iso-edge{stroke:var(--anatomy-lit)}
     @media(max-width:760px){.memory-key{grid-template-columns:repeat(2,minmax(0,1fr))}}
     @media(max-width:560px){.iso-page{width:100% - 12px;margin:20px auto 48px}.iso-plate{padding:48px 4px 72px}.iso-svg{width:108%;margin-left:-4%}.iso-legend{font-size:12px;padding:0 10px}.memory-key{grid-template-columns:1fr;margin:18px 10px 0}.memory-key small{font-size:11.5px}}
    </style></head>`
  );

writeFileSync(
  join(HERE, theme === "light" ? "memory-archive-light.html" : "memory-archive.html"),
  page
);
console.log(`wrote memory-archive${theme === "light" ? "-light" : ""}.html`);
