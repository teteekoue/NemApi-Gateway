import { Plugin } from 'vite';

/**
 * Plugin Vite pour intercepter les requêtes locales /status, /stats, /backend
 * et /v1/chat/completions en mode développement / conteneur web,
 * tout en tentant le proxy vers le port 8090 si proxy.py s'exécute en local.
 */
export function nemapiMockBridgePlugin(): Plugin {
  return {
    name: 'nemapi-mock-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Intercepter /status pour répondre instantanément sans spammer ECONNREFUSED
        if (url === '/status' || url.startsWith('/status?')) {
          // Essayer d'interroger le proxy local 8090 avec un timeout court
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 200);
            const proxyRes = await fetch('http://127.0.0.1:8090/status', {
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (proxyRes.ok) {
              const body = await proxyRes.text();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(body);
              return;
            }
          } catch (_) {
            // Le proxy Python local n'est pas démarré sur 8090 (normal dans le conteneur cloud)
          }

          // Répondre avec un statut sain émulé pour l'interface
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: true,
              engine: 'NemApi Embedded Bridge',
              port: 8090,
              uptime: 3600,
              mode: 'embedded',
              providers: 7,
            })
          );
          return;
        }

        // Intercepter /stats
        if (url === '/stats' || url.startsWith('/stats?')) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 200);
            const proxyRes = await fetch('http://127.0.0.1:8090/stats', {
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (proxyRes.ok) {
              const body = await proxyRes.text();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(body);
              return;
            }
          } catch (_) {}

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              total_requests: 0,
              tokens_processed: 0,
              providers_online: 7,
            })
          );
          return;
        }

        next();
      });
    },
  };
}
