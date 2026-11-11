// Обработчик форм сайта для Yandex Cloud Functions (Node.js 18+).
// Принимает заявку с сайта и пересылает её в Telegram.
// Секреты задаются в переменных окружения функции, в коде их нет:
//   BOT_TOKEN — токен бота от @BotFather
//   CHAT_ID   — ваш числовой id в телеграме
//   ALLOWED_ORIGIN — адрес сайта, с которого принимать заявки (необязательно)

const MAX = 3900; // запас до лимита сообщения Telegram (4096)

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function chunks(text) {
  const out = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > MAX) { out.push(cur); cur = line; }
    else cur = cur ? cur + '\n' + line : line;
  }
  if (cur) out.push(cur);
  return out;
}

async function tg(text) {
  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;
  for (const part of chunks(text)) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.CHAT_ID, text: part, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    if (!r.ok) throw new Error('telegram ' + r.status + ' ' + (await r.text()));
  }
}

module.exports.handler = async function (event) {
  const origin = (event.headers && (event.headers.Origin || event.headers.origin)) || '';
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  const cors = {
    'Access-Control-Allow-Origin': allowed === '*' ? '*' : allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  const reply = (code, obj) => ({ statusCode: code, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false });
  if (allowed !== '*' && origin && origin !== allowed) return reply(403, { ok: false });

  let data;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
    data = JSON.parse(raw);
  } catch (e) { return reply(400, { ok: false, error: 'bad json' }); }

  const fields = Array.isArray(data.fields) ? data.fields.slice(0, 80) : [];
  if (!fields.length) return reply(400, { ok: false, error: 'empty' });

  const title = data.kind === 'brief' ? '📋 <b>Новый бриф с сайта</b>' : '✉️ <b>Новая заявка с сайта</b>';
  const lines = [title, ''];
  for (const f of fields) {
    if (!Array.isArray(f) || f.length < 2) continue;
    const k = String(f[0]).slice(0, 80), v = String(f[1]).slice(0, 3000);
    lines.push(`<b>${esc(k)}:</b> ${esc(v)}`);
  }
  if (data.page) lines.push('', `<i>${esc(String(data.page).slice(0, 200))}</i>`);

  try {
    await tg(lines.join('\n'));
    return reply(200, { ok: true });
  } catch (e) {
    console.error(e);
    return reply(502, { ok: false });
  }
};
