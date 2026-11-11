// Обработчик форм сайта для Yandex Cloud Functions (Node.js 18+), без внешних библиотек.
// 1) сохраняет заявку в бакет Object Storage (хранение в России),
// 2) присылает уведомление письмом через Яндекс Почту (SMTP).
// Секреты задаются в переменных окружения функции, в коде их нет:
//   BUCKET     — имя бакета, куда сохраняется каждая заявка
//   SMTP_USER  — адрес Яндекс Почты, с которого уходят уведомления (например, login@yandex.ru)
//   SMTP_PASS  — пароль приложения для почты (не обычный пароль от аккаунта)
//   MAIL_TO    — куда присылать уведомления (можно несколько через запятую); по умолчанию SMTP_USER
//   ALLOWED_ORIGIN — адреса сайта через запятую, с которых принимать заявки; * — с любых
// Функции назначается сервисный аккаунт с ролью storage.uploader. Таймаут функции — 15 с.

const tls = require('tls');

function rnd() { return Math.random().toString(36).slice(2, 8); }
function stamp() { const d = new Date(); return { month: d.toISOString().slice(0, 7), iso: d.toISOString().replace(/[:.]/g, '-') }; }

async function put(folder, ext, body, type, context) {
  const bucket = process.env.BUCKET;
  const token = context && context.token && context.token.access_token;
  if (!bucket || !token) throw new Error('storage not configured');
  const s = stamp();
  const key = `${folder}/${s.month}/${s.iso}-${rnd()}.${ext}`;
  const r = await fetch(`https://storage.yandexcloud.net/${bucket}/${key}`, {
    method: 'PUT',
    signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': type },
    body
  });
  if (!r.ok) throw new Error('storage ' + r.status + ' ' + (await r.text()));
  return key;
}

// --- минимальный SMTP-клиент (TLS, порт 465, AUTH PLAIN) ---
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const hdr = s => `=?UTF-8?B?${b64(s)}?=`;

function smtpSend({ host, port, user, pass, to, subject, text, replyTo }) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host, port, servername: host });
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('smtp timeout')); }, 8000);
    let buf = '', waiter = null;
    const fail = e => { clearTimeout(timer); sock.destroy(); reject(e); };
    sock.on('error', fail);
    sock.on('data', d => {
      buf += d.toString('utf8');
      const lines = buf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {          // последняя строка ответа сервера
          const reply = lines.slice(0, i + 1).join('\n');
          buf = lines.slice(i + 1).join('\r\n');
          const w = waiter; waiter = null;
          if (w) w(reply);
          return;
        }
      }
    });
    const read = () => new Promise(r => { waiter = r; });
    const cmd = async (line, ok) => {
      if (line !== null) sock.write(line + '\r\n');
      const reply = await read();
      if (!reply.startsWith(String(ok))) throw new Error(`smtp ${line ? line.split(' ')[0] : 'greeting'}: ${reply.slice(0, 200)}`);
      return reply;
    };
    (async () => {
      const rcpts = to.split(',').map(s => s.trim()).filter(Boolean);
      await cmd(null, 220);
      await cmd('EHLO functions.yandexcloud.net', 250);
      await cmd('AUTH PLAIN ' + Buffer.from(`\0${user}\0${pass}`, 'utf8').toString('base64'), 235);
      await cmd(`MAIL FROM:<${user}>`, 250);
      for (const r of rcpts) await cmd(`RCPT TO:<${r}>`, 250);
      await cmd('DATA', 354);
      const body = b64(text).replace(/.{1,76}/g, '$&\r\n');
      const msg = [
        `From: ${hdr('Сайт Сони Граниной')} <${user}>`,
        `To: ${rcpts.join(', ')}`,
        replyTo ? `Reply-To: <${replyTo}>` : null,
        `Subject: ${hdr(subject)}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${Date.now()}.${rnd()}@${user.split('@')[1] || 'yandex.ru'}>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        body
      ].filter(l => l !== null).join('\r\n');
      await cmd(msg + '\r\n.', 250);
      sock.write('QUIT\r\n');
      clearTimeout(timer); sock.end(); resolve();
    })().catch(fail);
  });
}

module.exports.handler = async function (event, context) {
  const origin = (event.headers && (event.headers.Origin || event.headers.origin)) || '';
  const list = (process.env.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
  const anyOrigin = list.includes('*');
  const okOrigin = anyOrigin || !origin || list.includes(origin);
  const cors = {
    'Access-Control-Allow-Origin': anyOrigin ? '*' : (list.includes(origin) ? origin : list[0]),
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  const reply = (code, obj) => ({ statusCode: code, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false });
  if (!okOrigin) return reply(403, { ok: false });

  let data;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
    data = JSON.parse(raw);
  } catch (e) { return reply(400, { ok: false, error: 'bad json' }); }

  const fields = (Array.isArray(data.fields) ? data.fields.slice(0, 80) : [])
    .filter(f => Array.isArray(f) && f.length >= 2)
    .map(f => [String(f[0]).slice(0, 80), String(f[1]).slice(0, 3000)]);
  if (!fields.length) return reply(400, { ok: false, error: 'empty' });

  // 1) сначала сохраняем заявку в хранилище в России
  const record = { received: new Date().toISOString(), kind: data.kind || 'contact', page: data.page || '', fields };
  let key;
  try { key = await put('leads', 'json', JSON.stringify(record, null, 2), 'application/json; charset=utf-8', context); }
  catch (e) { console.error(e); return reply(502, { ok: false }); }

  // 2) затем письмо-уведомление
  const isBrief = data.kind === 'brief';
  const name = (fields.find(f => /имя/i.test(f[0])) || [])[1] || '';
  const email = (fields.map(f => f[1]).join(' ').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [])[0] || '';
  const text = [
    isBrief ? 'Новый бриф с сайта' : 'Новая заявка с сайта', '',
    ...fields.map(([k, v]) => `${k}: ${v}`), '',
    data.page ? `Страница: ${String(data.page).slice(0, 200)}` : '',
    `Сохранено: ${key}`
  ].join('\n');
  try {
    const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
    if (!user || !pass) throw new Error('smtp not configured');
    await smtpSend({
      host: process.env.SMTP_HOST || 'smtp.yandex.ru', port: Number(process.env.SMTP_PORT || 465),
      user, pass, to: process.env.MAIL_TO || user, replyTo: email,
      subject: (isBrief ? 'Бриф с сайта' : 'Заявка с сайта') + (name ? `: ${name}` : ''),
      text
    });
  } catch (e) {
    // заявка уже сохранена, поэтому отвечаем успехом; журналы в Облаке бывают недоступны,
    // поэтому причину сбоя кладём рядом, в папку errors/
    console.error(e);
    try { await put('errors', 'txt', String(e && e.message || e), 'text/plain; charset=utf-8', context); } catch (_) {}
  }
  return reply(200, { ok: true });
};
