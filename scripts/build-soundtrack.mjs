/* Builds public/audio/ from the Incompetech soundtrack.
 *
 * The tracks are Kevin MacLeod's, under CC BY 4.0 — redistribution is exactly
 * what that licence grants, provided the attribution ships with them. The
 * credits panel in the app is that attribution, and it renders from the
 * manifest this script writes, so a track can never reach the player without
 * its credit line coming along.
 *
 * Three stages, each skippable and each idempotent:
 *
 *   fetch      source MP3s -> audio-src/   (gitignored; 187 MB of masters)
 *   encode     audio-src/  -> public/audio/*.m4a
 *   manifest   the catalogue -> src/data/soundtrack.json
 *
 *   node scripts/build-soundtrack.mjs [--fetch] [--encode] [--manifest]
 *
 * With no flags it runs all three. Encoding 27 tracks takes a few minutes.
 *
 * Titles are NOT typed by hand here. Incompetech publishes its own catalogue
 * as pieces.json, and that is what names each track, because the filenames
 * disagree with the titles often enough to matter: AcidJazz.mp3 is "Acid
 * Trumpet", NoGoodLayabout.mp3 is "No Good Layabout", and the ID3 tag on
 * Rollin at 5.mp3 still carries a working title. Resolving against the
 * catalogue makes the credits right by construction.
 */
import { spawn } from "node:child_process";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "audio-src");
const OUT_DIR = join(ROOT, "public", "audio");
const MANIFEST = join(ROOT, "src", "data", "soundtrack.json");

const BASE = "https://incompetech.com/music/royalty-free";
const CATALOGUE = `${BASE}/pieces.json`;
const MP3 = `${BASE}/mp3-royaltyfree`;

const LICENCE = {
  name: "Creative Commons: By Attribution 4.0",
  url: "https://creativecommons.org/licenses/by/4.0/",
};
const ARTIST = { name: "Kevin MacLeod", url: "https://incompetech.com" };

/* Loudness target. The point is that no track jumps 6 dB over the last one —
 * absolute level is the player's volume control, not this. -16 LUFS with 1.5 dB
 * of true-peak headroom is the usual web bed target. */
const LUFS = -16;
const TRUE_PEAK = -1.5;
const LOUDNESS_RANGE = 11;

/* 96 kbps AAC-LC is ample for music sitting under a UI. The exception is a
 * source that was already thin: two of these arrive at 160 kbps rather than
 * 256-320, and a lossy-to-lossy pass at 96 compounds what the first encoder
 * already threw away, so those get more headroom instead. */
const BITRATE = "96k";
const BITRATE_WEAK_SOURCE = "128k";
const WEAK_SOURCE_THRESHOLD = 176_000;

/* The soundtrack, by source filename. The catalogue supplies everything else. */
const TRACKS = [
  "AcidJazz.mp3",
  "Airport Lounge.mp3",
  "Apero Hour.mp3",
  "As I Figure.mp3",
  "Backbay Lounge.mp3",
  "Backed Vibes Clean.mp3",
  "Bass Walker.mp3",
  "Bossa Antigua.mp3",
  "Deadly Roulette.mp3",
  "Deuces.mp3",
  "Fast Talkin.mp3",
  "Faster Does It.mp3",
  "George Street Shuffle.mp3",
  "Hard Boiled.mp3",
  "Hep Cats.mp3",
  "Lobby Time.mp3",
  "Long Stroll.mp3",
  "Mining by Moonlight.mp3",
  "NoGoodLayabout.mp3",
  "On Hold for You.mp3",
  "Poppers and Prosecco.mp3",
  "Rollin at 5.mp3",
  "Samba Isobel.mp3",
  "Shades of Spring.mp3",
  "Sidewalk Shade.mp3",
  "Spy Glass.mp3",
  "Vibing Over Venus.mp3",
];

const sourceUrl = (filename) => `${MP3}/${encodeURIComponent(filename)}`;

function slug(title) {
  return title
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve({ out, err }) : reject(new Error(`${cmd} exited ${code}\n${err.slice(-2000)}`)),
    );
  });
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchCatalogue() {
  const res = await fetch(CATALOGUE);
  if (!res.ok) throw new Error(`catalogue fetch failed: ${res.status}`);
  const pieces = await res.json();
  const byFilename = new Map(pieces.map((p) => [p.filename, p]));
  const resolved = TRACKS.map((filename) => {
    const piece = byFilename.get(filename);
    if (!piece) throw new Error(`${filename} is not in the Incompetech catalogue`);
    /* Checked here rather than where they are used: both feed the manifest,
     * which is written after the encode, and discovering a missing title three
     * minutes into ffmpeg is a poor way to find out. */
    if (!piece.title) throw new Error(`${filename} has no title in the catalogue`);
    if (!piece.isrc) throw new Error(`${filename} has no ISRC in the catalogue`);
    return { filename, title: piece.title, isrc: piece.isrc };
  });
  return resolved;
}

async function fetchSources() {
  await mkdir(SRC_DIR, { recursive: true });
  for (const filename of TRACKS) {
    const dest = join(SRC_DIR, filename);
    if (await exists(dest)) {
      console.log(`  have  ${filename}`);
      continue;
    }
    const res = await fetch(sourceUrl(filename));
    if (!res.ok) throw new Error(`${filename}: ${res.status}`);
    /* Write beside the target and rename, so an interrupted run leaves no
     * half-file. The skip above trusts existence, and ffmpeg will happily
     * encode a truncated MP3 and exit 0 — a silent short track. */
    const partial = `${dest}.part`;
    await writeFile(partial, Buffer.from(await res.arrayBuffer()));
    await rename(partial, dest);
    console.log(`  got   ${filename}`);
  }
}

async function probe(path) {
  const { out } = await run("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    path,
  ]);
  const info = JSON.parse(out);
  const audio = info.streams.find((s) => s.codec_type === "audio");
  return {
    duration: Number(info.format.duration),
    bitRate: Number(info.format.bit_rate),
    sampleRate: Number(audio.sample_rate),
  };
}

/* Pass one measures; pass two applies what pass one measured. Single-pass
 * loudnorm only estimates as it goes, which leaves the first seconds of a
 * track at a different level from the rest of it. */
async function measure(path) {
  const { err } = await run("ffmpeg", [
    "-hide_banner", "-nostdin",
    "-i", path,
    "-af", `loudnorm=I=${LUFS}:TP=${TRUE_PEAK}:LRA=${LOUDNESS_RANGE}:print_format=json`,
    "-f", "null", "-",
  ]);
  const json = err.slice(err.lastIndexOf("{"), err.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

async function encodeOne(filename, title, outName) {
  const src = join(SRC_DIR, filename);
  const dest = join(OUT_DIR, outName);
  const { bitRate, sampleRate } = await probe(src);
  const m = await measure(src);
  const bitrate = bitRate <= WEAK_SOURCE_THRESHOLD ? BITRATE_WEAK_SOURCE : BITRATE;
  const filter = [
    `loudnorm=I=${LUFS}:TP=${TRUE_PEAK}:LRA=${LOUDNESS_RANGE}`,
    `measured_I=${m.input_i}`,
    `measured_TP=${m.input_tp}`,
    `measured_LRA=${m.input_lra}`,
    `measured_thresh=${m.input_thresh}`,
    `offset=${m.target_offset}`,
    "linear=true",
  ].join(":");
  await run("ffmpeg", [
    "-hide_banner", "-nostdin", "-y",
    "-i", src,
    /* The masters carry embedded cover art, which arrives as a video stream —
     * take the audio and nothing else, or ffmpeg tries to put H.264 in an m4a. */
    "-map", "0:a:0",
    "-vn",
    /* loudnorm resamples to 192 kHz internally, so land back on the source
     * rate explicitly rather than letting the encoder pick one. */
    "-af", `${filter},aresample=${sampleRate}`,
    /* Drop the masters' tags, then write the credit back in: a file saved out
     * of the browser cache should still say whose it is and under what terms. */
    "-map_metadata", "-1",
    "-metadata", `title=${title}`,
    "-metadata", `artist=${ARTIST.name}`,
    "-metadata", `copyright=${LICENCE.name} — ${LICENCE.url}`,
    "-c:a", "aac",
    "-b:a", bitrate,
    "-movflags", "+faststart",
    dest,
  ]);
  const { size } = await stat(dest);
  const out = await probe(dest);
  console.log(`  ${outName.padEnd(26)} ${bitrate.padStart(5)}  ${(size / 1024 / 1024).toFixed(1)} MB`);
  return { bytes: size, duration: out.duration, bitrate };
}

async function main() {
  const STAGES = ["fetch", "encode", "manifest"];
  const flags = process.argv.slice(2);
  /* Without this an unrecognised flag — `--help`, or `--manifests` for
   * `--manifest` — leaves every stage unselected and the script exits 0
   * having done nothing, looking exactly like a successful rebuild. */
  const unknown = flags.filter((f) => !STAGES.includes(f.replace(/^--/, "")));
  if (unknown.length) {
    console.error(`unknown flag${unknown.length > 1 ? "s" : ""}: ${unknown.join(" ")}`);
    console.error(`usage: node scripts/build-soundtrack.mjs [${STAGES.map((s) => `--${s}`).join("] [")}]`);
    process.exitCode = 2;
    return;
  }
  const all = flags.length === 0;
  const want = (name) => all || flags.includes(`--${name}`);

  console.log("resolving titles against the Incompetech catalogue…");
  const catalogue = await fetchCatalogue();

  if (want("fetch")) {
    console.log("fetching sources…");
    await fetchSources();
  }

  const built = new Map();
  if (want("encode")) {
    await mkdir(OUT_DIR, { recursive: true });
    console.log(`encoding at ${LUFS} LUFS / ${TRUE_PEAK} dBTP…`);
    for (const { filename, title } of catalogue) {
      built.set(filename, await encodeOne(filename, title, `${slug(title)}.m4a`));
    }
  }

  if (want("manifest")) {
    const tracks = [];
    for (const { filename, title, isrc } of catalogue) {
      const file = `${slug(title)}.m4a`;
      const path = join(OUT_DIR, file);
      if (!(await exists(path))) throw new Error(`${file} has not been encoded`);
      const info = built.get(filename) ?? (await probe(path));
      const bytes = built.get(filename)?.bytes ?? (await stat(path)).size;
      tracks.push({
        id: isrc.toLowerCase(),
        title,
        file,
        duration: Math.round(info.duration),
        bytes,
        isrc,
        source: sourceUrl(filename),
      });
    }
    const manifest = {
      /* Regenerate with: node scripts/build-soundtrack.mjs --manifest */
      artist: ARTIST,
      licence: LICENCE,
      loudness: { target: LUFS, truePeak: TRUE_PEAK, unit: "LUFS" },
      tracks,
    };
    await mkdir(dirname(MANIFEST), { recursive: true });
    await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    const total = tracks.reduce((n, t) => n + t.bytes, 0);
    const secs = tracks.reduce((n, t) => n + t.duration, 0);
    console.log(
      `manifest: ${tracks.length} tracks, ${(secs / 60).toFixed(1)} min, ${(total / 1024 / 1024).toFixed(1)} MB`,
    );
  }
}

await main();
