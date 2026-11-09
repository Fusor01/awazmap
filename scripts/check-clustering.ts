// Offline sanity checks for the clustering rules (no database needed): npm run check:clustering
import { textSimilarity } from "../src/lib/clustering/similarity";
import { distanceMeters, offsetPoint } from "../src/lib/clustering/geo";
import { rollupSeverity, withinThresholds } from "../src/lib/clustering/engine";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

const sim = (a: string, b: string, want: "match" | "nomatch") => {
  const s = textSimilarity(a, b);
  check(`similarity ${want}: "${a}" ~ "${b}"`, (s >= 0.3) === (want === "match"), `(${s})`);
};

sim("Garbage piled up and not collected for several days", "Waste dumped openly, attracting stray dogs", "match");
sim("Overflowing dustbin with scattered rubbish", "Large pile of trash near the bin", "match");
sim("कचरा कई दिनों से नहीं उठा", "Garbage not collected this week", "match");
sim("Garbage piled up near the lane", "Sewage drain overflowing onto the lane", "nomatch");
sim("No water supply for three days", "Garbage piled up", "nomatch");
sim("Street light not working", "No electricity in our houses since morning", "nomatch");
sim("Deep potholes damaging vehicles", "Dangerous pothole, two-wheelers slipping", "match");

const o = { lat: 28.6139, lng: 77.209 };
const near = offsetPoint(o, 200, 0), far = offsetPoint(o, 400, 0);
check("200 m is within radius", withinThresholds({ distanceM: distanceMeters(o, near), daysApart: 1, textScore: 0.5 }));
check("400 m is outside radius", !withinThresholds({ distanceM: distanceMeters(o, far), daysApart: 1, textScore: 0.5 }));
check("20 days apart is outside window", !withinThresholds({ distanceM: 50, daysApart: 20, textScore: 0.5 }));
check("low text similarity rejected", !withinThresholds({ distanceM: 50, daysApart: 1, textScore: 0.1 }));
check("severity: highest wins", rollupSeverity(["LOW", "HIGH"], 2).severity === "HIGH");
check("severity: 10 reports raise LOW to HIGH", rollupSeverity(["LOW"], 10).severity === "HIGH");
check("severity: 25 reports raise to CRITICAL", rollupSeverity(["MEDIUM"], 25).severity === "CRITICAL");

// ---- Day 4 scenarios ----
// Duplicate complaints: same problem, ~20 m apart, same day -> related
check("duplicate complaints are related", withinThresholds({ distanceM: distanceMeters(o, offsetPoint(o, 15, 12)), daysApart: 0.1, textScore: textSimilarity("No water supply for three days", "Water supply stopped since 3 days") }));
// Different issues in the same locality -> never related, even at 0 m
check("different issue, same spot: garbage vs water", textSimilarity("Garbage piled up and not collected", "No water supply for two days") === 0);
check("different issue, same spot: garbage vs sewage", textSimilarity("Garbage piled up and not collected", "Sewage drain overflowing") === 0);
check("different issue, same spot: pothole vs garbage", textSimilarity("Large pothole on the road", "Garbage dumped on the road") === 0);
// Same issue in different localities -> not merged (distance rule), even with identical text
const sameText = textSimilarity("Garbage piled up and not collected for days", "Garbage piled up and not collected for days");
check("same issue, 2.5 km apart is NOT merged", sameText === 1 && !withinThresholds({ distanceM: distanceMeters(o, offsetPoint(o, 2500, 0)), daysApart: 0, textScore: sameText }));
check("same issue, 299 m apart is related", withinThresholds({ distanceM: distanceMeters(o, offsetPoint(o, 299, 0)), daysApart: 0, textScore: sameText }));
// Hindi / Hinglish wording of the same problem
check("Hinglish garbage ~ English garbage", textSimilarity("kachra kai din se nahi utha", "Garbage not collected for several days") >= 0.3);
check("Hindi water ~ English water", textSimilarity("तीन दिन से पानी नहीं आ रहा", "No water supply for three days") >= 0.3);
check("empty text never matches", textSimilarity("", "Garbage piled up") === 0);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);