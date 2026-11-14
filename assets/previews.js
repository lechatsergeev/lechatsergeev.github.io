/* Живые обложки на главной. В рамке устройства — настоящий интерфейс
   проекта, и он сам проигрывает главный момент кейса: «палец» нажимает,
   цифры меняются. Касаний фрейм не принимает, поэтому прокрутку страницы
   не перехватывает; нажатие по карточке открывает кейс.
   Играет, только пока карточка на экране; при «уменьшить движение» стоит. */
(function () {
  "use strict";
  var phone = window.matchMedia("(max-width: 760px)").matches;
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- общие помощники ---------- */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function fit(device) {
    var frame = device.querySelector("iframe");
    if (!frame) return;
    var w = +device.dataset.w, h = +device.dataset.h, s = device.clientWidth / w;
    frame.style.width = w + "px";
    frame.style.height = h + "px";
    frame.style.transform = "scale(" + s + ")";
  }

  // Видимое касание внутри фрейма: кружок там, где «нажали»
  function tap(win, el) {
    if (!el) return;
    var doc = win.document, r = el.getBoundingClientRect();
    if (!doc.getElementById("pf-tap-style")) {
      var st = doc.createElement("style");
      st.id = "pf-tap-style";
      st.textContent = ".pf-tap{position:fixed;z-index:2147483647;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;" +
        "background:rgba(20,20,20,.18);border:2px solid rgba(20,20,20,.55);pointer-events:none;animation:pf-tap .7s ease-out forwards}" +
        "@keyframes pf-tap{0%{transform:scale(.4);opacity:0}25%{transform:scale(1);opacity:1}100%{transform:scale(1.5);opacity:0}}";
      doc.head.appendChild(st);
    }
    var dot = doc.createElement("div");
    dot.className = "pf-tap";
    dot.style.left = r.left + r.width / 2 + "px";
    dot.style.top = r.top + r.height / 2 + "px";
    doc.body.appendChild(dot);
    setTimeout(function () { dot.remove(); }, 800);
    el.click();
  }

  function scrollWin(win, top) {
    try { win.scrollTo({ top: top, behavior: "smooth" }); } catch (e) { win.scrollTo(0, top); }
  }
  function byText(root, sel, text) {
    return Array.prototype.find.call(root.querySelectorAll(sel), function (e) { return e.textContent.trim().indexOf(text) === 0; });
  }

  /* ---------- сценарии ---------- */
  var SCRIPTS = {
    // Месяц заполняется сменами: календарь темнеет графитом, сумма растёт,
    // в конце — «Итоги месяца».
    bot: async function (win, live) {
      var demo = win.__demo;
      if (!demo || !win.render) return sleep(500);
      var full = demo.stats(), today = full.today_day;
      function partial(k) {
        var days = full.month_days.map(function (d) {
          return d.day <= k ? d : { day: d.day, tips: 0, cash: 0, card: 0, spent: 0 };
        });
        var tips = 0, net = 0, shifts = 0, week = 0;
        days.forEach(function (d) {
          tips += d.tips; net += d.tips - d.spent; if (d.tips) shifts++;
          if (d.day > k - 7 && d.day <= k) week += d.tips - d.spent;
        });
        var t = days[k - 1] || { tips: 0, spent: 0 };
        return Object.assign({}, full, { month_days: days, month_tips: tips, month_net: net,
          shifts_count: shifts, week_net: week, today_net: t.tips - t.spent,
          goal_pct: Math.min(100, Math.round(t.tips / 40)), total_net: full.total_net - (full.month_net - net) });
      }
      win.scrollTo(0, 0);
      win.render(partial(0));
      await sleep(900);
      for (var k = 1; k <= today; k++) {
        if (!live()) return;
        var worked = full.month_days[k - 1].tips > 0;
        win.render(partial(k));
        await sleep(worked ? 650 : 90);
      }
      await sleep(1400);
      if (!live()) return;
      tap(win, win.document.getElementById("open-poster"));
      await sleep(3800);
      tap(win, win.document.getElementById("close-poster"));
      await sleep(1500);
    },

    // Вкладка «График»: даты встают к именам, касание клетки показывает, кто и во сколько.
    schedule: async function (win, live) {
      var doc = win.document;
      var heads = doc.querySelectorAll("thead th.sg-day"), rows = doc.querySelectorAll("tbody tr");
      if (!heads.length) return sleep(800);
      win.scrollTo(0, 0);
      await sleep(1600);
      for (var k = 1; k < 5 && live(); k++) { tap(win, heads[k]); await sleep(1300); }
      for (var r = 0; r < 3 && live(); r++) {
        var cells = rows[r * 3 + 1] ? rows[r * 3 + 1].querySelectorAll("td.sg-c") : [];
        if (cells[2]) { tap(win, cells[2]); await sleep(1500); }
      }
      if (live()) { tap(win, doc.getElementById("sg-prev")); await sleep(2200); tap(win, doc.getElementById("sg-next")); await sleep(1800); }
      if (heads[0]) heads[0].click();
      await sleep(800);
    },

    // Пост канала: карточки листаются одна за другой.
    newsroom: async function (win, live) {
      if (!win.showCard) return sleep(800);
      win.showCard(0);
      await sleep(1800);
      for (var k = 1; k < 6 && live(); k++) { win.showCard(k); await sleep(1600); }
      await sleep(1200);
    },

    // Товар сразу за первым экраном, потом лента приготовления со своей прокруткой.
    mazza: async function (win, live) {
      var doc = win.document;
      var assort = doc.getElementById("assortment"), floor = doc.querySelector(".floor");
      if (!assort || !floor) return sleep(1000);
      win.scrollTo(0, 0);
      await sleep(3000);
      if (!live()) return;
      scrollWin(win, assort.getBoundingClientRect().top + win.scrollY - 70);
      await sleep(3200);
      if (!live()) return;
      scrollWin(win, floor.getBoundingClientRect().top + win.scrollY - 40);
      await sleep(2200);
      var next = doc.querySelector('[aria-label="Следующий шаг"]');
      for (var i = 0; i < 4 && live(); i++) { tap(win, next); await sleep(1700); }
      var prev = doc.querySelector('[aria-label="Предыдущий шаг"]');
      for (var j = 0; j < 4 && prev; j++) prev.click();
      await sleep(600);
      scrollWin(win, 0);
      await sleep(1600);
    },

    // «Купить зерна» с первого экрана ведёт к каталогу, помол выбирается
    // прямо в карточке, пачка улетает в корзину.
    coffee: async function (win, live, viewH) {
      var doc = win.document;
      var h = Array.prototype.find.call(doc.querySelectorAll("h4"), function (e) { return e.textContent.indexOf("Эфиопия") !== -1; });
      var card = h && h.closest(".group");
      if (!card) return sleep(800);
      win.scrollTo(0, 0);
      await sleep(2200);
      if (!live()) return;
      tap(win, byText(doc, "button", "Купить зерна"));
      await sleep(1800);
      // низ карточки (цена и «+») — у нижнего края видимой части рамки
      var r = card.getBoundingClientRect();
      scrollWin(win, r.bottom + win.scrollY - viewH + 24);
      await sleep(1300);
      tap(win, byText(card, "button", "Фильтр"));
      await sleep(1100);
      var btns = card.querySelectorAll("button");
      tap(win, btns[btns.length - 1]);                 // «+»
      await sleep(1300);
      tap(win, btns[btns.length - 1]);                 // ещё одна пачка
      await sleep(2200);
      // убрать за собой: в этой сборке «−» есть только в корзине,
      // поэтому корзину проще обнулить перезагрузкой (она хранится в памяти)
      scrollWin(win, 0);
      await sleep(900);
      win.location.reload();
      await sleep(2500);
    },

    // Бронь за четыре шага: капсула, время — цена складывается, будильник, QR.
    hotel: async function (win, live) {
      var doc = win.document, $ = function (s) { return doc.querySelector(s); };
      if (!$("#s1")) return sleep(800);
      doc.querySelectorAll(".screen").forEach(function (s) { s.classList.toggle("on", s.id === "s1"); });
      win.scrollTo(0, 0);
      await sleep(1600);
      if (!live()) return;
      tap(win, $('.card[data-type="single"] .pick'));
      await sleep(1100);
      var slots = doc.querySelectorAll('.card[data-type="single"] .slot');
      tap(win, slots[10]);
      await sleep(900);
      tap(win, slots[12]);
      await sleep(1700);
      if (!live()) return;
      tap(win, $("#go1"));
      await sleep(1700);
      tap(win, $("#wake"));
      await sleep(3200);
    },
  };

  /* ---------- запуск ---------- */
  var devices = Array.prototype.slice.call(document.querySelectorAll(".live-device"));

  devices.forEach(function (device) {
    if (phone && device.dataset.srcPhone) {
      device.dataset.src = device.dataset.srcPhone;
      device.dataset.w = device.dataset.wPhone;
      device.dataset.h = device.dataset.hPhone;
      var poster = device.querySelector(".poster");
      if (poster && device.dataset.posterPhone) poster.src = device.dataset.posterPhone;
    }
    device.visible = false;
  });

  function load(device) {
    if (device.dataset.loaded) return;
    device.dataset.loaded = "1";
    var frame = document.createElement("iframe");
    frame.src = device.dataset.src;
    frame.title = device.dataset.title || "Живой интерфейс";
    frame.setAttribute("tabindex", "-1");
    frame.setAttribute("aria-hidden", "true");
    frame.addEventListener("load", function () {
      device.classList.add("ready");
      if (!calm) play(device, frame);
    });
    device.insertBefore(frame, device.firstChild);
    fit(device);
  }

  async function play(device, frame) {
    var script = SCRIPTS[device.dataset.play];
    if (!script || device.playing) return;
    var win;
    try { win = frame.contentWindow; void win.document.body; } catch (e) { return; }   // чужой домен: просто живой сайт
    device.playing = true;
    await sleep(1500);                                   // дать странице дорисоваться
    var live = function () { return device.visible && !document.hidden; };
    for (;;) {
      while (!live()) await sleep(400);
      var viewH = device.clientHeight / (device.clientWidth / +device.dataset.w);
      try { await script(win, live, viewH); } catch (e) { await sleep(2000); }
    }
  }

  if ("IntersectionObserver" in window) {
    // Грузим заранее, когда карточка на подходе. Тяжёлый сайт «Маццы»
    // на телефоне — только когда карточка уже на экране.
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        if (phone && e.target.dataset.lazyPhone === "visible") return;
        load(e.target); near.unobserve(e.target);
      });
    }, { rootMargin: "300px 0px" });
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.visible = e.isIntersecting;
        if (e.isIntersecting) load(e.target);
      });
    }, { threshold: 0.35 });
    devices.forEach(function (d) { near.observe(d); seen.observe(d); });
  } else {
    devices.forEach(load);
  }

  var t;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () { devices.forEach(fit); }, 120);
  });
})();
