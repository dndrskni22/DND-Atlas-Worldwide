import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  let apiRouter: express.RequestHandler | null = null;
  let frontendMiddleware: express.RequestHandler | null = null;

  // Bind port 3000 immediately so Cloud Run / reverse proxy never gets ECONNREFUSED (502 Bad Gateway)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CargoTrace full-stack server listening on http://0.0.0.0:${PORT}`);
  });

  const initPromise = (async () => {
    try {
      // Ensure TypeScript module & enum loader is active even when invoked via `node server.ts`
      await import('tsx/esm');
    } catch {
      // Already running under tsx
    }

    const { createCargoTraceApiRouter } = await import('./src/api/cargoTraceRouter.ts');
    apiRouter = createCargoTraceApiRouter();

    const distIndex = path.join(__dirname, 'dist', 'index.html');
    const useProdStatic = process.env.NODE_ENV === 'production' && fs.existsSync(distIndex);

    if (!useProdStatic) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true,
          hmr: false,
        },
        appType: 'spa',
      });
      frontendMiddleware = vite.middlewares;
    } else {
      const distPath = path.join(__dirname, 'dist');
      const staticHandler = express.static(distPath);
      frontendMiddleware = (req, res, next) => {
        staticHandler(req, res, (err) => {
          if (err) return next(err);
          res.sendFile(distIndex);
        });
      };
    }
  })();

  // Wait for initialization if a request arrives during the first few hundred milliseconds
  app.use(async (_req, _res, next) => {
    await initPromise;
    next();
  });

  app.use('/api', (req, res, next) => {
    if (apiRouter) {
      return apiRouter(req, res, next);
    }
    next();
  });

  app.use((req, res, next) => {
    if (frontendMiddleware) {
      return frontendMiddleware(req, res, next);
    }
    next();
  });
}

startServer();
