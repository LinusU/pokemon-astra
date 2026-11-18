import type { WorldMap } from "../world";

// Small roadside silhouettes, drawn at object depth so a walker can pass in front.
const relief = {
  mill: [
    "    kk    k  ",
    "    khh  kh  ",
    "    khh kh   ",
    "       kk    ",
    "  khhhkook   ",
    "  kkkkoook   ",
    "     kkkkhhk ",
    "    kkkk khhk",
    "   khhkk  kk ",
    "   kh kkk    ",
    "   kbbbhk    ",
    "   kblbhk    ",
    "  kkbbbkkk   ",
  ],
  lamp: [
    "    kkllllk ",
    "    khkkk k ",
    "    khk  kkk",
    "    khk  kyk",
    "    khk  kyk",
    "    khk  kkk",
    "    khk     ",
    "    khk     ",
    "  kkbbkk    ",
    "  kbhbbk    ",
    " kkbbbbkk   ",
  ],
  kiln: [
    "       kkk ",
    "      kbhk ",
    "      kbbk ",
    "   kkbbbhk ",
    "  kbhhbhbbk",
    " khhhhbbbbk",
    " khbbbbbkbk",
    " kbbkkkbbbk",
    " kbbkykbbbk",
    "kkbbkykbbbkk",
  ],
  ice: [
    "    lk      ",
    "   lhl   lk ",
    "  lhhbk lhk ",
    " lhhhbk lhbk",
    "  lhhbk lhbk",
    "  lhbbklhbk ",
    "   lbbkhbk  ",
    " kkkbhbbkk  ",
    "khhhhbbbbbkk",
  ],
  cairn: [
    "      ll   ",
    "     khbk  ",
    "    kkbbkk ",
    "    khhhbk ",
    "     kbbk  ",
    "   khhhhbk ",
    "  khhbbbbbk",
    "   kkkbbkk ",
    " kkllhhbbkk",
    "khhhhbbbbbbk",
  ],
  blind: [
    "   k      k  ",
    "  klkkkkkkhk ",
    " kllhhhhhhhhk",
    "kllhhhhhhhhbb",
    "  h kkkkk h  ",
    "  h kbbbk h  ",
    "  h kkkkk h  ",
    " khhhhhhhbbk ",
    "  hk    kbh  ",
    "  hk    kbh  ",
  ],
  signal: [
    "    kk      ",
    "    khkklllk",
    "    khkyyhhk",
    "    khkkkkkk",
    "    khk     ",
    "    khk     ",
    "    khkkkk  ",
    "   kbbbhhk  ",
    "   kbklbbk  ",
    "   kbbbhbk  ",
    "  kkbbbhbkk ",
  ],
  chime: [
    "  kkkkkkkkk  ",
    " kllhhhhhbbk ",
    "  khk k khk  ",
    "  khkkykkhk  ",
    "  khkyyhkhk  ",
    "  khkyyhkhk  ",
    "  khkkkkkhk  ",
    "  khk y khk  ",
    "  khk   khk  ",
    " kbhk   kbhk ",
  ],
  scope: [
    "        kkk ",
    "       khlk ",
    "     kkhhbk ",
    "   kkhhbbk  ",
    "  kllbbkk   ",
    "  kllkkk    ",
    "   kkbhk    ",
    "    khhk    ",
    "   khkhbk   ",
    "  khk khbk  ",
    " khk   khbk ",
  ],
  oak: [
    "     kkkk    ",
    "  kkklhhbk   ",
    " klhhhlhhbkk ",
    "khlhlhbhhbbbk",
    "khhhlbhhbhhbk",
    " kbhhhbhhhbk ",
    "  kkbbbbbbk  ",
    "    kbhkbk   ",
    "   kbkhkbk   ",
    "   khk  kbk  ",
    " kkhbk  kbbkk",
  ],
  post: [
    "  kkk        ",
    "  klk     kk ",
    "  khk    klk ",
    "  kbkkkkkhhk ",
    "  khk   khbk ",
    "  khk   khhk ",
    "  khk    kbk ",
    " kkbbkkk khk ",
    " khhhhhhhhbbk",
    "  khbbbbbkk  ",
  ],
  fossil: [
    "     kkkkk   ",
    "   kkhhhhbkk ",
    "  khhllllhbbk",
    " khllbbblhbbk",
    " khlbhhlhlbbk",
    " khlbllbhlbbk",
    "  khlbblhhbk ",
    "  khhllhhbbk ",
    " kkbbbbbbbkk ",
  ],
};
const designs: (keyof typeof relief)[] = [
  "post",
  "mill",
  "lamp",
  "fossil",
  "signal",
  "mill",
  "signal",
  "cairn",
  "ice",
  "blind",
  "blind",
  "kiln",
  "kiln",
  "cairn",
  "ice",
  "chime",
  "chime",
  "post",
  "scope",
  "cairn",
  "oak",
  "post",
  "fossil",
  "ice",
  "scope",
];
const pigments: Record<string, [string, string, string]> = {
  snow: ["#6092a7", "#a2dbe0", "#ecf2dd"],
  night: ["#626a8e", "#adb0bb", "#ece0ae"],
  wetland: ["#647944", "#a5b867", "#e4d9a1"],
  volcanic: ["#935755", "#bd8061", "#e6aa76"],
  meadow: ["#51784d", "#86a966", "#cddc87"],
  mountain: ["#777774", "#acaaa0", "#e5d4ae"],
  desert: ["#ac795f", "#d2a479", "#f2d7a0"],
  violet: ["#85708c", "#c09aa5", "#edc5ae"],
};

export function trailLandmark(
  c: CanvasRenderingContext2D,
  map: WorldMap,
  x: number,
  y: number,
  time: number,
) {
  const design = designs[Number(map.id.slice(5)) - 1];
  paintRelief(c, design, map.palette, x, y, time);
}
export function paintRelief(c: CanvasRenderingContext2D, design: keyof typeof relief,
  palette: string, x: number, y: number, time: number) {
  const rows = relief[design];
  const [b, h, l] = pigments[palette] ?? ["#87634e", "#b99a6f", "#e8cd91"];
  const colors: Record<string, string> = {
    k: "#35424a",
    b,
    h,
    l,
    o: "#ab7950",
    y: Math.floor(time / 410) % 2 ? "#ffe6a0" : "#e9b664",
  };
  const left = x - Math.ceil(rows[0].length * 0.5) * 2;
  const top = y + 4 - rows.length * 2;
  c.fillStyle = "#34454147";
  c.fillRect(left + 2, y + 2, rows[0].length * 2 - 2, 4);
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === " ") continue;
      c.fillStyle = colors[row[i]];
      c.fillRect(left + i * 2, top + j * 2, 2, 2);
    }
  });
  if (design === "kiln") {
    const rise = Math.floor(time / 180) % 9;
    c.fillStyle = "#ead9bb99";
    c.fillRect(left + 14 + (rise >> 2), top - rise, 4, 2);
  }
}
