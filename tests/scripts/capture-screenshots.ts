import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 4180;
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/screenshots');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const USER_DATA_DIR = '/tmp/chrome-headless-screenshots';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

interface ScreenshotTarget {
  readonly filename: string;
  readonly query: string;
  readonly title: string;
}

const TARGETS: readonly ScreenshotTarget[] = [
  {
    filename: '01_main_street_hud.png',
    query: '?seed=31415',
    title: 'Victorian Steampunk Main HUD & Street Overworld',
  },
  {
    filename: '02_artificer_workstation.png',
    query: '?seed=31415&modal=workbench',
    title: 'CDDA-Style Artificer Workstation & Schematic Dossier',
  },
  {
    filename: '03_metropolitan_atlas.png',
    query: '?seed=31415&modal=atlas',
    title: 'Metropolitan Stratum Atlas & District Dossier',
  },
  {
    filename: '04_market_exchange_turf.png',
    query: '?seed=31415&modal=exchange',
    title: 'Borough Turf Sectors & Commodity Exchange',
  },
  {
    filename: '05_naturalist_codex.png',
    query: '?seed=31415&modal=codex',
    title: 'Naturalist Philosophy Codex & Specimen Anatomy Ledger',
  },
  {
    filename: '06_vitruvian_paperdoll.png',
    query: '?seed=31415&modal=anatomy',
    title: 'Vitruvian Anatomy & Mechanical Graft Bay',
  },
  {
    filename: '07_satchel_inventory.png',
    query: '?seed=31415&modal=inventory',
    title: 'Satchel Inventory & Dial Gauges',
  },
  {
    filename: '08_tactical_look_mode.png',
    query: '?seed=31415&look=true',
    title: 'Look Mode Coordinate Targeting & Tactical Inspector',
  },
  {
    filename: '09_character_embarkation.png',
    query: '?seed=31415&creator=true',
    title: 'Character Creation & Victorian Vocation Embarkation',
  },
];

function createStaticServer(): http.Server {
  return http.createServer((req, res) => {
    const rawUrl = req.url ?? '/';
    const cleanPath = rawUrl.split('?')[0] ?? '/';
    const relPath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\//, '');
    const filePath = path.join(DIST_DIR, relPath);

    if (!fs.existsSync(filePath)) {
      const indexPath = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

function captureTarget(target: ScreenshotTarget): Promise<void> {
  const outPath = path.join(OUTPUT_DIR, target.filename);
  const url = `http://127.0.0.1:${PORT}/${target.query}`;
  console.log(`[ScreenCapture] Capturing: ${target.title} -> ${target.filename}`);

  return new Promise<void>((resolve, reject) => {
    const child = spawn(CHROME_PATH, [
      '--headless=new',
      `--user-data-dir=${USER_DATA_DIR}`,
      '--disable-gpu',
      '--window-size=1560,980',
      `--screenshot=${outPath}`,
      url,
    ], { stdio: 'ignore' });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        const stats = fs.statSync(outPath);
        console.log(`  ✓ Written ${target.filename} (${(stats.size / 1024).toFixed(1)} KB)`);
        resolve();
      } else {
        reject(new Error(`Chrome failed with code ${code} for ${target.filename}`));
      }
    });

    child.on('error', (err) => reject(err));
  });
}

async function captureAll(): Promise<void> {
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome not found at ${CHROME_PATH}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const server = createStaticServer();
  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', () => resolve()));
  console.log(`[ScreenCapture] Static server active at http://127.0.0.1:${PORT}`);

  try {
    for (const target of TARGETS) {
      await captureTarget(target);
    }
    console.log('[ScreenCapture] All screenshots captured successfully.');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    console.log('[ScreenCapture] Static server shut down.');
  }
}

void captureAll().catch((err: unknown) => {
  console.error('[ScreenCapture] Fatal error:', err);
  process.exit(1);
});
