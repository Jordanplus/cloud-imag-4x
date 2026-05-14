// Cloudflare Pages Function — proxy to Replicate.
// Routes:
//   POST /api/predict   body: { model, input }       → { id }
//   GET  /api/predict?id=<id>                        → { status, output, error }
//
// Auth: header `Authorization: Bearer <ACCESS_PASSWORD>` must match env.ACCESS_PASSWORD.
// Env:  REPLICATE_TOKEN, ACCESS_PASSWORD

const MODELS = {
  standard: {
    owner: 'nightmareai',
    name: 'real-esrgan',
    // input: { image, scale, face_enhance }  — pass-through from front-end
    buildInput: (input) => input,
  },
  anime: {
    owner: 'xinntao',
    name: 'realesrgan',
    // xinntao 官方 repo：用 'img' (非 'image')，用 version enum 切 anime variant。
    buildInput: (input) => ({
      img: input.image,
      scale: input.scale ?? 4,
      version: 'Anime - anime6B',
    }),
  },
  denoise: {
    owner: 'cszn',
    name: 'scunet',
    // model_name enum: 'real image denoising' / 'color images-25' / 'grayscale images-25' / ...
    // Output shape: { denoised_image, image_with_added_noise } — front-end extracts .denoised_image
    buildInput: (input) => ({
      image: input.image,
      model_name: 'real image denoising',
    }),
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function checkAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.ACCESS_PASSWORD) return false;
  return auth === 'Bearer ' + env.ACCESS_PASSWORD;
}

async function getLatestVersion(owner, name, token) {
  const r = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
    headers: { Authorization: 'Token ' + token },
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(`model ${owner}/${name}: ${d.detail || r.status}`);
  }
  const d = await r.json();
  return d.latest_version?.id;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return jsonResponse({ error: 'unauthorized' }, 401);
  if (!env.REPLICATE_TOKEN) return jsonResponse({ error: 'server missing REPLICATE_TOKEN' }, 500);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'invalid json' }, 400); }

  const cfg = MODELS[body.model];
  if (!cfg) return jsonResponse({ error: 'unknown model: ' + body.model }, 400);
  if (!body.input || !body.input.image) return jsonResponse({ error: 'missing input.image' }, 400);

  let versionId;
  try { versionId = await getLatestVersion(cfg.owner, cfg.name, env.REPLICATE_TOKEN); }
  catch (e) { return jsonResponse({ error: e.message }, 502); }
  if (!versionId) return jsonResponse({ error: `${cfg.owner}/${cfg.name} 沒有可用版本` }, 502);

  const input = cfg.buildInput(body.input);
  const r = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': 'Token ' + env.REPLICATE_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ version: versionId, input }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return jsonResponse({ error: data.detail || data.title || ('replicate ' + r.status) }, r.status);
  }
  return jsonResponse({ id: data.id, status: data.status });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return jsonResponse({ error: 'unauthorized' }, 401);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return jsonResponse({ error: 'missing id' }, 400);

  const r = await fetch('https://api.replicate.com/v1/predictions/' + encodeURIComponent(id), {
    headers: { 'Authorization': 'Token ' + env.REPLICATE_TOKEN },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return jsonResponse({ error: data.detail || ('replicate ' + r.status) }, r.status);

  return jsonResponse({
    status: data.status,
    output: data.output ?? null,
    error: data.error ?? null,
  });
}
