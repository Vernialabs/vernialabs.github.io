import nodemailer from 'nodemailer';
import tls from 'node:tls';

export function mailReady(env) { return Boolean(env.SMTP_PASSWORD); }
export async function mailHealth(env,error) {
  let detail=error ? String(error.message||error.code||'SMTP error') : 'SMTP accepted the message';
  if(env.SMTP_PASSWORD) {detail=detail.split(env.SMTP_PASSWORD).join('[secret]');try{detail=detail.split(btoa(env.SMTP_PASSWORD)).join('[secret]');}catch{}}
  detail=detail.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/ig,'[address]').slice(0,240);
  try{await env.DB.prepare('INSERT INTO service_health(service,state,detail) VALUES(?,?,?) ON CONFLICT(service) DO UPDATE SET state=excluded.state,detail=excluded.detail,updated_at=unixepoch()').bind('smtp',error?'error':'ok',detail).run();}catch{}
}
export function createMailer(env) {
  const transport = nodemailer.createTransport({
    host: 'mail.spacemail.com', port: 465, secure: true,
    auth: { user: 'team@vernia.in', pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
    // Let the Workers TLS stack resolve the hostname; do not pin a mail-server IP.
    getSocket(options,callback) {
      const socket=tls.connect({host:'mail.spacemail.com',port:465,servername:'mail.spacemail.com',rejectUnauthorized:true,minVersion:'TLSv1.2'});
      const timeout=setTimeout(()=>socket.destroy(new Error('SMTP connection timeout')),10000);
      const fail=error=>{clearTimeout(timeout);callback(error);};
      socket.once('error',fail);
      socket.once('secureConnect',()=>{clearTimeout(timeout);socket.removeListener('error',fail);callback(null,{connection:socket,secured:true});});
    },
  });
  return async message => {
    if (!mailReady(env)) throw Object.assign(new Error('Mail not configured'), {code:'NOT_CONFIGURED'});
    try { const result=await transport.sendMail({from: 'Vernia Labs <team@vernia.in>', replyTo:'team@vernia.in', ...message}); await mailHealth(env); return result; }
    catch(error){await mailHealth(env,error);throw error;}
  };
}
const labels = {'grip-one':'Grip One',headset:'View One headset','tactile-gloves':'Tactile gloves',data:'Data pilot'};
export function welcomeMessage(lead) {
  const interests = JSON.parse(lead.interests).map(i=>labels[i]).filter(Boolean).join(', ');
  return {
    to: lead.email, subject: `You're on the Vernia waitlist — #${lead.id}`,
    messageId: `<waitlist-${lead.id}@vernia.in>`,
    text: `You're on the list.\n\nThanks for joining Vernia Labs. Your signup number is #${lead.id}.\n\nYour interests: ${interests}.\n\nWe'll email you when there is relevant news or an opportunity to get involved. This is a signup number, not a shipping or delivery position.\n\nHave a question, want to change your interests, or didn't sign up? Reply to this email and our team will help. To leave the waitlist, reply with "unsubscribe".\n\nVernia Labs\nhttps://vernia.in\nhttps://vernia.in/privacy.html`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f2f8;color:#211b30;font-family:Arial,sans-serif"><div style="max-width:560px;margin:32px auto;background:white;padding:40px;border-top:5px solid #9f83e9"><p style="letter-spacing:3px;font-size:13px">VERNIA LABS</p><h1 style="font-size:32px;font-weight:500">You're on the list.</h1><p>Thanks for joining us. Your signup number is:</p><p style="font-size:48px;margin:20px 0;color:#7755be">#${lead.id}</p><p><strong>Your interests:</strong> ${interests}</p><p style="line-height:1.7">We'll email you when there is relevant news or an opportunity to get involved. This is a signup number, not a shipping or delivery position.</p><p style="line-height:1.7">Have a question or want to update your preferences? Just reply. If you didn't sign up, or want to leave, reply with “unsubscribe”.</p><hr style="border:0;border-top:1px solid #e9e4ef;margin:30px 0"><a href="https://vernia.in">Vernia Labs</a> · <a href="https://vernia.in/privacy.html">Privacy</a></div></body></html>`
  };
}
export async function drainOutbox(env, send = createMailer(env), max = 5) {
  if (!mailReady(env)) return;
  // Expired leases may have sent before a Worker interruption: never blindly resend.
  await env.DB.prepare("UPDATE email_outbox SET status='uncertain',error_code='INTERRUPTED' WHERE status='sending' AND lease_until < unixepoch()").run();
  for(let i=0;i<max;i++) {
    const job = await env.DB.prepare(`UPDATE email_outbox SET status='sending',attempts=attempts+1,lease_until=unixepoch()+120
      WHERE id=(SELECT id FROM email_outbox WHERE status='pending' AND next_attempt<=unixepoch() ORDER BY id LIMIT 1)
      AND status='pending' RETURNING *`).first();
    if(!job) break;
    const lead = await env.DB.prepare("SELECT * FROM waitlist WHERE id=? AND status!='withdrawn'").bind(job.waitlist_id).first();
    if(!lead) { await env.DB.prepare("UPDATE email_outbox SET status='failed',error_code='WITHDRAWN' WHERE id=?").bind(job.id).run(); continue; }
    try {
      const result = await send(welcomeMessage(lead));
      if(!result.accepted?.length) throw Object.assign(new Error('Rejected'),{code:'EENVELOPE',responseCode:550});
      await env.DB.prepare("UPDATE email_outbox SET status='sent',sent_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),error_code='' WHERE id=?").bind(job.id).run();
    } catch(error) {
      const code = ['EAUTH','ECONNECTION','ETIMEDOUT','ESOCKET','EENVELOPE','EMESSAGE'].includes(error.code) ? error.code : 'UNKNOWN';
      const preData = ['CONN','EHLO','HELO','AUTH','AUTH PLAIN','AUTH LOGIN','MAIL FROM','RCPT TO'].some(c=>error.command===c);
      const safeRetry = preData || code==='EAUTH' || code==='ECONNECTION' || (Number(error.responseCode)>=400 && Number(error.responseCode)<500);
      const permanent = Number(error.responseCode)>=500 && code!=='EAUTH';
      const state = permanent ? 'failed' : safeRetry ? (job.attempts>=5?'failed':'pending') : 'uncertain';
      await env.DB.prepare('UPDATE email_outbox SET status=?,error_code=?,next_attempt=unixepoch()+? WHERE id=?').bind(state,code,Math.min(3600,60*2**job.attempts),job.id).run();
    }
  }
}
