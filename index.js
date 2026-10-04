import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 10000;

process.on('uncaughtException', err => {
  console.error('Server Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Server Unhandled Rejection at:', promise, 'reason:', reason);
});

// Ensure build exists
if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.log('dist/index.html not found, running npm run build...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
    console.log('Build completed successfully.');
  } catch (err) {
    console.error('Failed to run build:', err);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

import { initDatabase } from './server/db.js';
import { handleApiRoute } from './server/api.js';

// Boot database & seed defaults
initDatabase().catch(err => console.error('Database initialization error:', err));

const server = http.createServer(async (req, res) => {
  // Normalize URL and remove query strings
  let reqPath = decodeURI(req.url.split('?')[0]);

  // Handle REST API Routes (/api/auth, /api/subscription, /api/admin)
  if (reqPath.startsWith('/api/')) {
    try {
      await handleApiRoute(req, res, reqPath);
    } catch (apiErr) {
      console.error('API execution error:', apiErr);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    }
    return;
  }

  if (res.headersSent) return;

  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, reqPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    if (!res.headersSent) {
      res.writeHead(403);
      res.end('Forbidden');
    }
    return;
  }

  // Check if requested file exists
  fs.stat(filePath, (err, stats) => {
    if (res.headersSent) return;

    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA client-side routing
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (err2, content) => {
        if (res.headersSent) return;
        if (err2) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error loading DocuMatrix Studio: dist/index.html not found. Please build the project first.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DocStudio server running on port ${PORT}`);
});
