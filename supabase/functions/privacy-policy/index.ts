import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const HTML = `<!DOCTYPE html>
<html lang="mk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Политика за приватност - Dzeble</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      padding: 30px 16px;
      margin: 0;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px 32px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .badge {
      display: inline-block;
      background: #ecfdf5;
      color: #059669;
      padding: 4px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 16px;
      letter-spacing: 0.5px;
    }
    h1 {
      color: #0f172a;
      margin-top: 0;
      font-size: 28px;
      line-height: 1.2;
    }
    h2 {
      color: #0f172a;
      font-size: 19px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
      margin-top: 28px;
    }
    .date {
      color: #64748b;
      font-size: 13px;
      margin-bottom: 24px;
    }
    p, li {
      color: #334155;
      font-size: 15px;
    }
    ul {
      padding-left: 20px;
    }
    .highlight {
      background: #f1f5f9;
      border-left: 4px solid #059669;
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      margin: 20px 0;
      font-size: 14px;
    }
    .contact-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 16px 20px;
      border-radius: 10px;
      margin-top: 28px;
    }
    a {
      color: #059669;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Dzeble Mobile App</div>
    <h1>Политика за приватност (Privacy Policy)</h1>
    <div class="date">Последно ажурирање: 18 Ноември 2026</div>

    <div class="highlight">
      <strong>Вашата приватност е наш приоритет:</strong> Мобилната апликација <strong>Dzeble</strong> не продава, не изнајмува и не споделува ваши лични податоци со рекламни мрежи, маркетинг агенции или трети лица. Податоците се користат исклучиво за обезбедување на функционалностите на апликацијата.
    </div>

    <h2>1. Кои податоци ги собираме и зошто?</h2>
    <ul>
      <li><strong>Локација (GPS):</strong> Се користи исклучиво додека апликацијата е отворена за да ви прикаже најблиски банкомати, дежурни аптеки, бензински пумпи и комунални прекини во радиус до 3 км. Апликацијата не врши континуирано следење на вашата локација во позадина за рекламни цели.</li>
      <li><strong>Корисничка сметка (Емаил):</strong> Доколку одлучите да се регистрирате или најавите со емаил/Google, вашата емаил адреса се користи за чување на вашите преференции и лојални картички. Апликацијата може да се користи и целосно без регистрација (како гостин).</li>
      <li><strong>Push нотификации (FCM Token):</strong> За испорака на известувања за прекини на струја/вода или временски предупредувања, се користи анонимен идентификациски токен преку Google Firebase Cloud Messaging.</li>
      <li><strong>Лојални картички:</strong> Бројките и кодовите од вашите картички за попуст се чуваат сигурно за брз приказ на каса.</li>
    </ul>

    <h2>2. Безбедност и складирање на податоците</h2>
    <p>Сите комуникации се одвиваат преку безбеден шифриран протокол (HTTPS / TLS 1.3). Податоците се чуваат во сигурна cloud база на податоци управувана од <strong>Supabase Inc.</strong> во дата-центри во рамките на Европската Унија (Frankfurt, Германија), во целосна согласност со GDPR регулативите.</p>

    <h2>3. Трети страни</h2>
    <p>Апликацијата соработува со сервиси од доверливи провајдери единствено за техничко овозможување на функциите:</p>
    <ul>
      <li><strong>Google Firebase:</strong> За испорака на push нотификации.</li>
      <li><strong>Supabase:</strong> За автентикација и база на податоци.</li>
      <li><strong>Отворени метеоролошки сервиси:</strong> За приказ на временска прогноза и квалитет на воздух.</li>
    </ul>

    <h2>4. Бришење на кориснички податоци (Data Deletion)</h2>
    <p>Корисниците имаат право во секое време да побараат целосно бришење на нивната сметка и сите поврзани податоци. Бришењето може да се изврши директно од менито Поставки во апликацијата или со испраќање порака на <strong>privacy@dzeble.com</strong>. Податоците се бришат трајно во рок од 48 часа.</p>

    <h2>5. Контакт</h2>
    <div class="contact-box">
      За какви било прашања или барања поврзани со приватноста, слободно контактирајте нè на:<br>
      Емаил: <a href="mailto:privacy@dzeble.com">privacy@dzeble.com</a> или <a href="mailto:support@dzeble.com">support@dzeble.com</a>
    </div>
  </div>
</body>
</html>`;

serve((_req) => {
  return new Response(HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
