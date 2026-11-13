/* Живые демо внутри кейсов. Каждое находит свой контейнер по data-demo.
   Данные выдуманные; правила повторяют настоящий код проектов. */
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");

  var fmt = function (n) {
    // Как в боте: разряды через неразрывный пробел, без копеек у целых
    var s = Math.abs(n) % 1 ? Math.abs(n).toFixed(2).replace(".", ",") : String(Math.round(Math.abs(n)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };
  function $(root, sel) { return root.querySelector(sel); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function segment(root, onChange) {
    var buttons = root.querySelectorAll(".seg button");
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        buttons.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        onChange(b.dataset.value);
      });
    });
  }

  /* ---------- Разбор сообщений: порт parser.py бота ---------- */
  // В JS \b не понимает кириллицу, поэтому границы слова заданы явно.
  var L = "(?<![а-яёa-z0-9])", R = "(?![а-яёa-z0-9])";
  var K_SUFFIX = new RegExp("(\\d+(?:[.,]\\d+)?)\\s*(?:тыс\\.?|тысяч[аи]?|к)" + R, "gi");
  var CURRENCY = /(?<=\d)\s*(?:₽|руб(?:лей|ля|\.)?|р\.?)(?=\s|$|,)/gi;
  var NUMBER = /[-−+]?\d[\d ]*(?:[.,]\d+)?/g;
  var CASH = new RegExp("(?:" + L + "(?:наличными|наличкой|наличк[аи]|наличные|налом|нал|кэш(?:ем)?)" + R + "|в кармане)", "i");
  var CARD = /(?:на карте|на карту|картой|карта|на сч[её]те|на сч[её]т|безнал(?:ом)?)/i;
  var NOT_AMOUNTS = [
    /(?:стол[а-яё]*|ст\.|№|#)\s*№?\s*\d+/gi,
    /\d{1,2}:\d{2}/g,
    /\d+\s*(?:шт|штук|чел|человек|гост|персон)[а-яё]*/gi,
  ];
  var INCOME = [
    [L + "чаевы[ех]" + R + "|" + L + "чай" + R, "Чаевые"],
    [L + "зп" + R + "|зарплат|аванс|оклад", "Зарплата"],
    [L + "смена" + R + "|подработк|шабашк", "Подработка"],
    ["преми|бонус", "Зарплата"],
  ];
  var EXPENSE = [
    ["продукт|еда|обед|ужин|завтрак|кофе|перекус|столов|магаз|пятероч|магнит|вкусно", "Еда"],
    ["такси|метро|автобус|проезд|бензин|заправк|каршер|самокат", "Транспорт"],
    ["аренда|квартир|коммунал|жкх|свет|электрич", "Жильё"],
    ["кино|бар|клуб|игр|развлеч|концерт", "Развлечения"],
    ["аптек|врач|лекарств|стоматолог", "Здоровье"],
    ["связь|телефон|интернет|подписк|мобильн", "Подписки"],
    ["одежд|обувь|кроссовк|куртк", "Одежда"],
  ];

  function normalize(t) {
    return t.replace(/[  ]/g, " ")
      .replace(K_SUFFIX, function (_, n) { return String(Math.round(parseFloat(n.replace(",", ".")) * 1000)); })
      .replace(CURRENCY, "");
  }
  function classify(text) {
    var lower = normalize(text.toLowerCase());
    if (/^\s*\d[\d ]*(?:[.,]\d{1,2})?\s*$/.test(lower)) return ["income", "Чаевые"];
    for (var i = 0; i < INCOME.length; i++) if (new RegExp(INCOME[i][0], "i").test(lower)) return ["income", INCOME[i][1]];
    for (var j = 0; j < EXPENSE.length; j++) if (new RegExp(EXPENSE[j][0], "i").test(lower)) return ["expense", EXPENSE[j][1]];
    return ["expense", "Прочее"];
  }
  function parse(text) {
    var items = [];
    var parts = text.split(/[;\n]+|(?<!\d),|,(?!\d{1,2}(?:\D|$))/);
    for (var i = 0; i < parts.length; i++) {
      var part = (parts[i] || "").trim();
      if (!part) continue;
      var counted = normalize(part);
      NOT_AMOUNTS.forEach(function (re) { counted = counted.replace(re, " "); });
      var nums = counted.match(NUMBER) || [];
      if (nums.length > 1) return { error: "Не стал записывать: в одной записи две суммы. Раздели их запятой." };
      if (!nums.length) continue;
      var amount = parseFloat(nums[0].replace(/ /g, "").replace(",", "."));
      if (!(amount > 0) || amount > 1e7) continue;
      var kc = classify(part);
      var account = CASH.test(part) ? "cash" : CARD.test(part) ? "card" : (kc[0] === "income" && (kc[1] === "Чаевые" || kc[1] === "Подработка") ? "cash" : "card");
      items.push({ kind: kc[0], category: kc[1], account: account, amount: amount, note: part });
    }
    return { items: items };
  }

  /* ---------- Демо: запись одним сообщением ---------- */
  function chatDemo(root) {
    var log = $(root, ".chat-log"), form = $(root, "form"), input = $(root, "input");
    var entries = [];
    var ACC = { cash: "Наличные", card: "Карта" };
    function today() {
      var inc = 0, sp = 0;
      entries.forEach(function (e) { if (e.dead) return; if (e.kind === "income") inc += e.amount; else sp += e.amount; });
      return "<b>Чистыми за сегодня: " + fmt(inc - sp) + " ₽</b>\nЧаевые до расходов " + fmt(inc) + " − расходы " + fmt(sp);
    }
    function line(e, withNote) {
      return (e.kind === "income" ? "➕ +" : "➖ −") + fmt(e.amount) + " ₽ · " + e.category + " · " + ACC[e.account] + (withNote ? " (" + esc(e.note) + ")" : "");
    }
    function say(text) {
      var me = el("div", "msg me"); me.textContent = text; log.appendChild(me);
      var res = parse(text);
      var bot = el("div", "msg bot");
      if (res.error) bot.textContent = res.error;
      else if (!res.items.length) bot.innerHTML = "Здесь нет суммы. Напиши, например, «чай 500».";
      else {
        var saved = res.items.map(function (it) { entries.push(it); return it; });
        var body = el("div");
        function render() {
          body.innerHTML = saved.map(function (e) { return '<span class="' + (e.dead ? "struck" : "") + '">' + line(e, saved.length === 1) + "</span>"; }).join("\n") + "\n\n" + today();
        }
        render();
        bot.appendChild(body);
        var kb = el("div", "kb");
        if (saved.length === 1) {
          var tog = el("button");
          var setLabel = function () { tog.textContent = "Изменить на " + (saved[0].account === "cash" ? "безналичные" : "наличные"); };
          setLabel();
          tog.type = "button";
          tog.onclick = function () { saved[0].account = saved[0].account === "cash" ? "card" : "cash"; setLabel(); render(); };
          kb.appendChild(tog);
        }
        var undo = el("button", "", "↩️ Отменить"); undo.type = "button";
        undo.onclick = function () { saved.forEach(function (e) { e.dead = true; }); undo.disabled = true; kb.querySelectorAll("button").forEach(function (b) { b.disabled = true; }); render(); };
        kb.appendChild(undo);
        bot.appendChild(kb);
      }
      setTimeout(function () { log.appendChild(bot); log.scrollTop = log.scrollHeight; }, 280);
      log.scrollTop = log.scrollHeight;
    }
    form.addEventListener("submit", function (ev) { ev.preventDefault(); var v = input.value.trim(); if (v) { say(v); input.value = ""; } });
    root.querySelectorAll(".chips button").forEach(function (b) { b.addEventListener("click", function () { say(b.textContent); }); });
    // Первый пример уже отправлен: демо выглядит живым до первого касания
    say("чай 500");
  }

  /* ---------- Демо: смена после полуночи ---------- */
  function nightDemo(root) {
    // Одна смена 12 сентября, 22:00–01:30. Время записи — по Москве.
    var rows = [["12.09", "22:10", 500], ["12.09", "23:40", 1000], ["13.09", "00:30", 700], ["13.09", "01:20", 300]];
    var out = $(root, ".demo-out");
    function draw(start) {
      var days = {};
      rows.forEach(function (r) {
        var h = parseInt(r[1], 10);
        var d = start === 6 && h < 6 ? "12.09" : r[0];
        (days[d] = days[d] || []).push(r);
      });
      var keys = Object.keys(days).sort();
      var total = rows.reduce(function (s, r) { return s + r[2]; }, 0);
      var html = '<div class="night"><div class="night-col"><h4>Записи по дням</h4>';
      keys.forEach(function (k) {
        var sum = days[k].reduce(function (s, r) { return s + r[2]; }, 0);
        html += '<div class="day"><div class="day-head"><span>' + k + '</span><span class="mono">' + fmt(sum) + " ₽</span></div><ul>" +
          days[k].map(function (r) { return "<li><span>" + r[0] + " " + r[1] + '</span><span class="mono">+' + fmt(r[2]) + "</span></li>"; }).join("") + "</ul></div>";
      });
      var shifts = keys.length, cls = shifts > 1 ? "mono bad" : "mono";
      html += '</div><div class="night-col"><h4>Статистика месяца</h4>' +
        '<div class="stat"><span>Смен</span><span class="' + cls + '">' + shifts + "</span></div>" +
        '<div class="stat"><span>Средний чай за смену</span><span class="' + cls + '">' + fmt(total / shifts) + " ₽</span></div>" +
        '<div class="stat"><span>«За сегодня» в 00:30</span><span class="' + cls + '">' + (start === 6 ? "1 500 → 2 200" : "0 → 700") + " ₽</span></div>" +
        "</div></div>";
      out.innerHTML = html;
    }
    segment(root, function (v) { draw(+v); });
    draw(0);
  }

  /* ---------- Демо: колонка сумм ---------- */
  function sumsDemo(root) {
    var box = $(root, ".sums");
    segment(root, function (v) { box.className = "sums " + v; });
  }

  /* ---------- Демо: сколько прокрутки до товара ---------- */
  function scrollDemo(root) {
    var view = $(root, ".scroller-view"), status = $(root, ".scroller-status");
    var sets = JSON.parse(root.dataset.sets);
    var current;
    function show(key) {
      current = sets[key];
      view.innerHTML = current.frames.map(function (src, i) {
        return '<img src="' + src + '" alt="' + esc(current.alts[i] || "") + '" width="960" height="600" decoding="async">';
      }).join("");
      view.scrollTop = 0;
      update();
    }
    function update() {
      var h = view.clientHeight || 1;
      var screen = Math.min(current.frames.length, Math.floor((view.scrollTop + h * 0.5) / (view.scrollHeight / current.frames.length)) + 1);
      var found = screen >= current.productAt;
      status.innerHTML = '<span class="mono">Экран ' + screen + " из " + current.frames.length + "</span>" +
        (found ? '<span class="found">Ассортимент на экране ' + current.productAt + "</span>"
               : '<span class="wait">Товара пока нет · ещё ' + (current.productAt - screen) + " " + plural(current.productAt - screen) + "</span>");
    }
    function plural(n) { return n % 10 === 1 && n % 100 !== 11 ? "экран" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "экрана" : "экранов"; }
    view.addEventListener("scroll", update, { passive: true });
    // Кадры второй версии грузим заранее, чтобы переключение не показывало пустое окно
    Object.keys(sets).forEach(function (k) { sets[k].frames.forEach(function (src) { var i = new Image(); i.src = src; }); });
    segment(root, show);
    show("before");
  }

  /* ---------- Демо: мощности смены ---------- */
  function capDemo(root) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        root.querySelectorAll(".cap-bar i").forEach(function (i) { i.style.width = i.dataset.w; });
        io.disconnect();
      });
    }, { threshold: 0.4 });
    io.observe(root);
  }

  /* ---------- Демо: карточка зерна (по BeansCard.tsx) ---------- */
  function coffeeDemo(root) {
    var qty = 0, grind = "Зерно";
    var foot = $(root, ".cf-action"), badge = $(root, ".cf-cart b"), toast = $(root, ".cf-toast");
    root.querySelectorAll(".cf-grind button").forEach(function (b) {
      b.addEventListener("click", function () {
        root.querySelectorAll(".cf-grind button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        grind = b.textContent;
      });
    });
    function draw() {
      foot.innerHTML = qty === 0
        ? '<button class="cf-add" type="button" aria-label="Добавить в корзину">+</button>'
        : '<span class="cf-step"><button type="button" aria-label="Убрать одну пачку">−</button><span>' + qty + '</span><button type="button" aria-label="Добавить ещё пачку">+</button></span>';
      badge.textContent = qty; badge.classList.toggle("on", qty > 0);
      var add = foot.querySelector(".cf-add, .cf-step button:last-child"), rem = foot.querySelector(".cf-step button:first-child");
      add.onclick = function () { qty++; toast.textContent = "В корзине: Эфиопия Буле Хора (" + grind + ") × " + qty; draw(); };
      if (rem) rem.onclick = function () { qty--; toast.textContent = qty ? "В корзине × " + qty : "Корзина пуста"; draw(); };
    }
    draw();
  }

  /* ---------- Демо: время и цена капсулы ---------- */
  function hotelDemo(root) {
    // Загрузка отеля по часам: 0 — свободно, 1 — средне, 2 — плотно. Цена часа зависит от загрузки.
    var hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    var load = [0, 0, 1, 1, 0, 0, 0, 1, 2, 2, 1, 1, 1, 0, 0];
    var PRICE = { single: [800, 1000, 1200], double: [1200, 1500, 1800] };  // «от 800 / от 1200 руб/час», как на экране
    var COLORS = ["#8bc28c", "#e3b341", "#d9634c"];
    var type = "single", from = null, to = null;
    var grid = $(root, ".slot-grid"), box = $(root, ".price-box");
    grid.innerHTML = hours.map(function (h, i) {
      return '<button type="button" class="slot" style="--load:' + COLORS[load[i]] + '" data-i="' + i + '">' + String(h).padStart(2, "0") + ":00</button>";
    }).join("");
    grid.addEventListener("click", function (e) {
      var b = e.target.closest(".slot"); if (!b) return;
      var i = +b.dataset.i;
      if (from === null || to !== null) { from = i; to = null; }
      else if (i < from) { from = i; }
      else { to = i; }
      draw();
    });
    segment(root, function (v) { type = v; draw(); });
    function draw() {
      grid.querySelectorAll(".slot").forEach(function (b, i) {
        var end = to === null ? from : to;
        b.classList.toggle("on", i === from || i === to);
        b.classList.toggle("mid", from !== null && i > from && i < end);
      });
      if (from === null) { box.innerHTML = "<small>Выберите начало и конец пребывания —<br>цена появится здесь</small><strong>—</strong>"; return; }
      var end = to === null ? from : to, sum = 0, parts = [0, 0, 0];
      for (var i = from; i <= end; i++) { sum += PRICE[type][load[i]]; parts[load[i]]++; }
      var n = end - from + 1;
      var words = ["свободно", "средне", "плотно"];
      var detail = parts.map(function (c, k) { return c ? c + " ч · " + PRICE[type][k] + " ₽ (" + words[k] + ")" : ""; }).filter(Boolean).join("<br>");
      box.innerHTML = "<small>" + String(hours[from]).padStart(2, "0") + ":00–" + String(hours[end] + 1).padStart(2, "0") + ":00 · " + n + " ч<br>" + detail + "</small><strong class=\"mono\">" + fmt(sum) + " ₽</strong>";
    }
    draw();
  }

  var DEMOS = { chat: chatDemo, night: nightDemo, sums: sumsDemo, scroll: scrollDemo, cap: capDemo, coffee: coffeeDemo, hotel: hotelDemo };
  document.querySelectorAll("[data-demo]").forEach(function (root) {
    var f = DEMOS[root.dataset.demo];
    if (f) try { f(root); } catch (e) { root.insertAdjacentHTML("beforeend", '<p class="demo-note">Демо не запустилось в этом браузере.</p>'); }
  });

  /* ---------- Время в Петербурге ---------- */
  var clock = document.getElementById("clock");
  if (clock) {
    var tf = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
    var tick = function () { clock.textContent = tf.format(new Date()); };
    tick(); setInterval(tick, 15000);
  }

  /* ---------- Появление при прокрутке ---------- */
  var items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { items.forEach(function (i) { i.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  items.forEach(function (i) { io.observe(i); });
})();
