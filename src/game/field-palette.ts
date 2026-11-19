export type Palette = {
  grass: string;
  shade: string;
  path: string;
  ink: string;
  roof: string;
  wall: string;
  water: string;
};
export const PALETTES: Record<string, Palette> = {
  meadow: {
    grass: "#a9cf86",
    shade: "#6e9b60",
    path: "#e2d6a9",
    ink: "#315d4c",
    roof: "#568daa",
    wall: "#f0d9ae",
    water: "#578fb9",
  },
  orchard: {
    grass: "#aec981",
    shade: "#779457",
    path: "#e2cd98",
    ink: "#426a48",
    roof: "#c97c63",
    wall: "#f0d9ae",
    water: "#548db0",
  },
  autumn: {
    grass: "#c5bf78",
    shade: "#ad814f",
    path: "#e6cb95",
    ink: "#6d6044",
    roof: "#976b64",
    wall: "#ead1a2",
    water: "#648ba7",
  },
  coast: {
    grass: "#a2c69b",
    shade: "#6a9c81",
    path: "#e7d7a6",
    ink: "#3e746e",
    roof: "#648eaf",
    wall: "#f1dfb4",
    water: "#568eb7",
  },
  industrial: {
    grass: "#aabf8e",
    shade: "#798c6d",
    path: "#d5cfac",
    ink: "#4e6b64",
    roof: "#879cad",
    wall: "#d2d4bc",
    water: "#6b9da8",
  },
  desert: {
    grass: "#dec083",
    shade: "#b59e64",
    path: "#ead89e",
    ink: "#877750",
    roof: "#ca8c68",
    wall: "#f1dda9",
    water: "#58a69b",
  },
  wetland: {
    grass: "#98b97d",
    shade: "#638564",
    path: "#c8bc8b",
    ink: "#396a56",
    roof: "#779d7a",
    wall: "#e4d1a4",
    water: "#568e92",
  },
  volcanic: {
    grass: "#a58b79",
    shade: "#8b786a",
    path: "#c5b18b",
    ink: "#62575d",
    roof: "#a75e58",
    wall: "#d7b79a",
    water: "#bc6c4c",
  },
  snow: {
    grass: "#dce7e5",
    shade: "#a5bbc5",
    path: "#c8d5d3",
    ink: "#57788c",
    roof: "#7195ae",
    wall: "#eee6d3",
    water: "#81b5cf",
  },
  mountain: {
    grass: "#b3bba2",
    shade: "#87937c",
    path: "#d0c5a5",
    ink: "#64726a",
    roof: "#819c91",
    wall: "#dfd3b6",
    water: "#749da5",
  },
  violet: {
    grass: "#b2c69a",
    shade: "#81946f",
    path: "#e0cead",
    ink: "#605a78",
    roof: "#9780ab",
    wall: "#e8d3b7",
    water: "#818caf",
  },
  night: {
    grass: "#8cb6a1",
    shade: "#628d82",
    path: "#c4c8a9",
    ink: "#3f6170",
    roof: "#718aab",
    wall: "#d7d3b5",
    water: "#4d779a",
  },
};
