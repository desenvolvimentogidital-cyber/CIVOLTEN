'use strict';
/**
 * CIVOLTEN - API privada para backup sincronizado, SEM substituir a lógica financeira.
 * Acesso somente com JWT Neon Auth verificado por JWKS; dados isolados pelo 'sub'.
 * Vercel recebe DATABASE_URL apenas no servidor (nunca NEXT_PUBLIC_/VITE_).
 */
const MAX_STATE_BYTES = 3_500_000;
const requiredArrays = ['clients','quotes','workers','materials','services','expenses'];

function validState(data) {
  return data !== null && typeof data === 'object' && !Array.isArray(data) &&
    requiredArrays.every(k => Array.isArray(data[k])) &&
    data.company !== null && typeof data.company === 'object' && !Array.isArray(data.company);
}
function json(res, status, body) { return res.status(status).json(body); }
function createHandler({ authenticate, load, save }) {
  return async (req, res) => {
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('X-Content-Type-Options','nosniff');
    if (req.method !== 'GET' && req.method !== 'PUT') {
      res.setHeader('Allow','GET, PUT');
      return json(res,405,{error:'Método não permitido'});
    }
    const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.headers?.authorization || '');
    if (!match) return json(res,401,{error:'Autenticação necessária'});
    let owner;
    try { owner = await authenticate(match[1]); }
    catch { return json(res,401,{error:'Sessão inválida ou expirada'}); }
    if (typeof owner !== 'string' || !owner || owner.length > 200)
      return json(res,401,{error:'Identidade inválida'});
    try {
      if (req.method === 'GET') {
        const existing = await load(owner);
        return json(res,200,existing ?
          {revision:Number(existing.revision),data:existing.data,updatedAt:existing.updated_at} :
          {revision:0,data:null,updatedAt:null});
      }
      if (!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
        return json(res,415,{error:'Envie JSON'});
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return json(res,400,{error:'JSON inválido'}); }
      }
      const expectedRevision = body?.expectedRevision;
      const data = body?.data;
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !validState(data))
        return json(res,400,{error:'Estrutura ou revisão inválida'});
      const dataString = JSON.stringify(data);
      if (Buffer.byteLength(dataString,'utf8') > MAX_STATE_BYTES)
        return json(res,413,{error:'Backup muito grande; exporte o JSON local e revise os catálogos importados'});
      const updated = await save(owner,expectedRevision,dataString);
      if (!updated) return json(res,409,{error:'Existem alterações mais recentes na nuvem. Baixe ou compare antes de substituir.'});
      return json(res,200,{revision:Number(updated.revision),updatedAt:updated.updated_at});
    } catch (error) {
      // Nunca registre CPF, cliente, orçamento, conteúdo do JSON ou credenciais.
      console.error('CIVOLTEN_CLOUD_ERROR',error?.code || error?.name || 'error');
      return json(res,503,{error:'Backup em nuvem temporariamente indisponível; seus dados locais não foram alterados'});
    }
  };
}

let remoteJwks;
async function authenticate(token) {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_JWKS_URL)
    throw new Error('Configuração de autenticação ausente');
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  remoteJwks ||= createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
  const {payload} = await jwtVerify(token,remoteJwks,{
    issuer:process.env.NEON_AUTH_BASE_URL, algorithms:['EdDSA']
  });
  return payload.sub;
}
function client() {
  if (!process.env.DATABASE_URL) throw new Error('Conexão Neon ausente');
  return require('@neondatabase/serverless').neon(process.env.DATABASE_URL);
}
async function load(owner) {
  const rows = await client().query(
    'SELECT revision, data, updated_at FROM civolten_app.user_state WHERE auth_user_id=$1',
    [owner]
  );
  return rows[0] || null;
}
async function save(owner,expectedRevision,dataString) {
  // CAS atômico: nenhum aparelho pode sobrescrever silenciosamente o outro.
  // O trigger no Postgres arquiva automaticamente a versão anterior.
  const sql = expectedRevision === 0
    ? 'INSERT INTO civolten_app.user_state(auth_user_id,revision,data,updated_at) ' +
      'SELECT $1,1,$2::jsonb,now() WHERE $3::bigint=0 ' +
      'ON CONFLICT(auth_user_id) DO NOTHING RETURNING revision,updated_at'
    : 'UPDATE civolten_app.user_state SET data=$2::jsonb, ' +
      'revision=revision+1, updated_at=now() ' +
      'WHERE auth_user_id=$1 AND revision=$3::bigint RETURNING revision,updated_at';
  const rows = await client().query(sql,[owner,dataString,expectedRevision]);
  return rows[0] || null;
}
const handler = createHandler({ authenticate, load, save });
module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.validState = validState;
