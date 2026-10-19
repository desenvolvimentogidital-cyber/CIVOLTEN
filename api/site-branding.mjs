import {EDGE} from '../lib/civolten-security.mjs';

// A identidade é pública; nenhum cookie ou token administrativo é encaminhado.
const api = new URL(EDGE);
api.searchParams.set('api', 'site-branding');
const reply = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

export default {
  async fetch(req) {
    if (req.method !== 'GET') return reply({error: 'Método não permitido'}, 405);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      let upstream;
      try {
        upstream = await fetch(api, {
          method: 'GET',
          headers: {'Accept': 'application/json'},
          cache: 'no-store',
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!upstream.ok) return reply({error: 'Identidade indisponível'}, 502);
      if (Number(upstream.headers.get('content-length') || 0) > 360000) return reply({error: 'Resposta excessiva'}, 502);
      const data = await upstream.json();
      if (!data || typeof data !== 'object' || !data.branding || typeof data.branding !== 'object') {
        return reply({error: 'Identidade inválida'}, 502);
      }
      return reply({branding: data.branding});
    } catch {
      return reply({error: 'Não foi possível carregar a identidade visual'}, 502);
    }
  }
};
