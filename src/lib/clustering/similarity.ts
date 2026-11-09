// Local text similarity: no AI call, no network, no cost.
// Method: tokenise -> drop stop-words and location words -> map known synonyms (English, Hindi, Hinglish)
// to a shared "concept" -> weighted Dice coefficient. Concept tokens weigh 3, ordinary words weigh 1.
// Safety rule: if both texts mention a recognised problem type and the types differ, similarity is 0.
// This is lexical + curated-synonym matching, NOT neural embeddings (see remaining issues).

const STOP = new Set(
  (
    "a an the and or but of to in on at for with by from as is are was were be been being it its this that these those there their they them we our us i my me you your he she his her " +
    "not no has have had having do does did done will would can could should may might also very too just so than then when while which who what where why how all any some many much more most " +
    "several few other such only own same up down out over under again into through during before after above below between both each about against since until per " +
    "day days week weeks month months hour hours year years today yesterday ago last past now still already please kindly sir madam " +
    "complaint complaints complain problem problems issue issues reported report reporting resident residents people citizen citizens " +
    "area areas locality colony sector street streets road roads lane lanes near nearby opposite beside side front behind main market block society neighbourhood neighborhood ward city town local place location " +
    "causing cause caused due get getting got gets " +
    "के है हैं में से को का की पर और नहीं भी ये वो यह वह रहा रही रहे हो कर लिए हम " +
    "hai hain mein se ko ka ki ke par aur nahi nahin bhi ye wo yeh hum humare hamare"
  ).split(/\s+/)
);

const CONCEPTS: Record<string, string[]> = {
  garbage: ["garbage", "trash", "waste", "rubbish", "litter", "dump", "dumping", "dumped", "dustbin", "dustbins", "bin", "bins", "kachra", "kuda", "kooda", "कचरा", "कचरे", "कूड़ा", "कूड़े", "गंदगी"],
  drain: ["drain", "drains", "drainage", "sewage", "sewer", "sewerage", "gutter", "nala", "nali", "naali", "नाली", "नाला", "सीवर"],
  water: ["water", "paani", "pani", "पानी", "tap", "taps", "pipeline", "borewell"],
  flood: ["flood", "flooding", "flooded", "waterlogging", "waterlogged"],
  pothole: ["pothole", "potholes", "gadda", "gaddha", "गड्ढा", "गड्ढे", "गड्डा", "crater", "craters"],
  streetlight: ["streetlight", "streetlights", "lamp", "lamps", "light", "lights", "bulb"],
  power: ["electricity", "power", "bijli", "बिजली", "outage", "blackout", "transformer", "voltage"],
  stray: ["stray", "dog", "dogs", "cattle", "cows", "कुत्ते", "आवारा"],
  traffic: ["traffic", "jam", "congestion", "signal"],
};

const CONCEPT_OF = new Map<string, string>();
for (const [concept, words] of Object.entries(CONCEPTS)) for (const w of words) CONCEPT_OF.set(w, concept);

function stem(w: string): string {
  if (!/^[a-z]+$/.test(w) || w.length <= 3) return w;
  let s = w;
  for (const suf of ["ing", "ed", "es", "s"]) {
    if (s.endsWith(suf) && s.length - suf.length >= 3) { s = s.slice(0, -suf.length); break; }
  }
  if (s.endsWith("e") && s.length >= 4) s = s.slice(0, -1);
  return s;
}

export function analyse(text: string) {
  const weights = new Map<string, number>();
  const concepts = new Set<string>();
  for (const raw of text.toLowerCase().normalize("NFC").split(/[^\p{L}\p{M}\p{N}]+/u)) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    const concept = CONCEPT_OF.get(raw) ?? CONCEPT_OF.get(stem(raw));
    if (concept) { concepts.add(concept); weights.set(`c:${concept}`, 3); continue; }
    const s = stem(raw);
    if (!STOP.has(s)) weights.set(s, 1);
  }
  return { weights, concepts };
}

/** 0-1 similarity of two complaint texts. */
export function textSimilarity(a: string, b: string): number {
  const A = analyse(a), B = analyse(b);
  if (!A.weights.size || !B.weights.size) return 0;
  if (A.concepts.size && B.concepts.size && ![...A.concepts].some((c) => B.concepts.has(c))) return 0;
  let inter = 0, sa = 0, sb = 0;
  for (const w of A.weights.values()) sa += w;
  for (const w of B.weights.values()) sb += w;
  for (const [k, w] of A.weights) { const wb = B.weights.get(k); if (wb) inter += Math.min(w, wb); }
  return Math.round(((2 * inter) / (sa + sb)) * 100) / 100;
}