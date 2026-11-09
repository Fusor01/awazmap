// Failure-path checks for AI extraction using a mocked fetch (no network, no API cost): npm run check:extraction
import { extractComplaint } from "../src/lib/extract";

let failed = 0;
const check = (name: string, ok: boolean) => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };
const realFetch = globalThis.fetch;
const mock = (status: number, body: unknown) => {
  globalThis.fetch = (async () =>
    ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body })) as unknown as typeof fetch;
};
const reply = (content: string) => ({ choices: [{ message: { content } }] });
const good = {
  category: "WATER", description: "No water supply for three days", location_text: null,
  duration: { value: 3, unit: "days" }, language: "Hindi", previous_complaint: null, danger_to_life: false, affects_many: true,
};
const quiet = console.error; console.error = () => {}; // expected failures log noise

async function main() {
  process.env.GROQ_API_KEY = "test-key";
  mock(500, { error: "boom" });
  check("HTTP 500 -> graceful failure", !(await extractComplaint("पानी नहीं आ रहा")).ok);
  mock(200, reply("this is not json"));
  check("non-JSON model output -> graceful failure", !(await extractComplaint("पानी नहीं आ रहा")).ok);
  mock(200, reply(JSON.stringify({ ...good, category: "SPACESHIP" })));
  check("invalid category rejected by validation", !(await extractComplaint("water problem")).ok);
  mock(200, reply(JSON.stringify({ category: "WATER" })));
  check("missing fields rejected by validation", !(await extractComplaint("water problem")).ok);
  mock(200, reply(JSON.stringify(good)));
  const r = await extractComplaint("तीन दिन से पानी नहीं आ रहा");
  check("valid output accepted", r.ok);
  if (r.ok) {
    check("location stays empty when none was spoken", r.extraction.locationText === "" && r.structured.location_text === null);
    check("duration normalised to text", r.structured.duration === "3 days");
    check("severity follows the fixed rules (water + 3 days + many = High)", r.structured.severity === "High");
  }
  delete process.env.GROQ_API_KEY;
  check("missing API key -> graceful failure", !(await extractComplaint("water problem")).ok);
  globalThis.fetch = realFetch; console.error = quiet;
  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
}
main();