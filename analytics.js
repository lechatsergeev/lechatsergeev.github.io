/**
 * Счётчик просмотров портфолио.
 *
 * Пишет события в Supabase напрямую из браузера. Ключ здесь публичный —
 * так и задумано: на таблице стоит политика, разрешающая только запись.
 * Читать данные можно лишь из панели Supabase, где нужен другой ключ.
 *
 * Что собирается: страница, источник перехода, размер экрана, глубина
 * прокрутки и время на странице. Личные данные и IP не собираются.
 */
(function () {
  var URL_ = "https://wuzsoaxwmeqnubhqscxb.supabase.co";
  var KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1enNvYXh3bWVxbnViaHFzY3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDEyMjQsImV4cCI6MjEwNDM3NzIyNH0.SlWZdJozN20a4nqmqHAQAO5K_WXqp9iCNyj2JMJg9Aw";

  // Пока адрес не подставлен, скрипт молчит и не шлёт запросов в никуда.
  if (!URL_ || !KEY) return;

  /** Случайный идентификатор посетителя: связывает повторные визиты. */
  function visitor() {
    try {
      var id = localStorage.getItem("pf_visitor");
      if (!id) {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem("pf_visitor", id);
      }
      return id;
    } catch (e) {
      // Приватное окно или запрет на хранилище — визит просто не свяжется
      // с прошлыми, остальное работает.
      return "no-storage";
    }
  }

  /**
   * Откуда пришли. Метка в адресе важнее реферера: её ставим мы сами,
   * когда отправляем ссылку в конкретный отклик.
   */
  function source() {
    var q = new URLSearchParams(location.search);
    var tag = q.get("from") || q.get("utm_source");
    if (tag) return tag;
    if (!document.referrer) return "прямой заход";
    try {
      return new URL(document.referrer).hostname;
    } catch (e) {
      return "неизвестно";
    }
  }

  var started = Date.now();
  var deepest = 0;
  var sent = false;

  function depth() {
    var doc = document.documentElement;
    var full = doc.scrollHeight - window.innerHeight;
    if (full <= 0) return 100;
    return Math.min(100, Math.round(((window.scrollY || 0) / full) * 100));
  }

  function send(event, extra) {
    var row = {
      event: event,
      page: location.pathname.split("/").pop() || "index.html",
      visitor: visitor(),
      source: source(),
      referrer: document.referrer || null,
      screen: window.innerWidth < 768 ? "телефон" : "десктоп",
      width: window.innerWidth,
    };
    for (var k in extra) row[k] = extra[k];

    // Ключ уходит параметром в адресе, а не заголовком: только так
    // работает sendBeacon, а он единственный надёжно доставляет запрос
    // при уходе со страницы. Ключ всё равно публичный.
    var url = URL_ + "/rest/v1/views?apikey=" + KEY;
    var body = JSON.stringify(row);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }

    fetch(url, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: body,
    }).catch(function () {});
  }

  send("open");

  window.addEventListener(
    "scroll",
    function () {
      var d = depth();
      if (d > deepest) deepest = d;
    },
    { passive: true }
  );

  /**
   * Итог визита. Шлём на скрытии вкладки, а не на unload: в мобильных
   * браузерах unload часто не срабатывает вовсе.
   */
  function finish() {
    if (sent) return;
    sent = true;
    send("leave", {
      depth: Math.max(deepest, depth()),
      seconds: Math.round((Date.now() - started) / 1000),
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") finish();
  });
  window.addEventListener("pagehide", finish);
})();
