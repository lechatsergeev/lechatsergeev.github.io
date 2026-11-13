/* Живые обложки на главной: в рамке устройства открывается настоящий
   интерфейс проекта. Пока его не «потрогали», он не перехватывает
   прокрутку страницы; грузится, только когда карточка рядом с экраном. */
(function () {
  "use strict";
  var phoneLayout = window.matchMedia("(max-width: 760px)").matches;

  function fit(device) {
    var frame = device.querySelector("iframe");
    if (!frame) return;
    var w = +device.dataset.w, h = +device.dataset.h;
    var s = device.clientWidth / w;
    frame.style.width = w + "px";
    frame.style.height = h + "px";
    frame.style.transform = "scale(" + s + ")";
    device.style.setProperty("--device-h", Math.round(h * s) + "px");
  }

  function load(device) {
    if (device.dataset.loaded) return;
    device.dataset.loaded = "1";
    var frame = document.createElement("iframe");
    frame.src = device.dataset.src;
    frame.title = device.dataset.title || "Живой интерфейс";
    frame.setAttribute("tabindex", "-1");
    frame.addEventListener("load", function () { device.classList.add("ready"); });
    device.insertBefore(frame, device.firstChild);
    fit(device);
  }

  var devices = Array.prototype.slice.call(document.querySelectorAll(".live-device"));
  devices.forEach(function (device) {
    // Сайт «Маццы» тяжёлый (3D-модели): на телефоне только по нажатию
    if (phoneLayout && device.dataset.srcPhone) {
      device.dataset.src = device.dataset.srcPhone;
      device.dataset.w = device.dataset.wPhone;
      device.dataset.h = device.dataset.hPhone;
      var poster = device.querySelector(".poster");
      if (poster && device.dataset.posterPhone) poster.src = device.dataset.posterPhone;
    }
    var btn = device.querySelector(".touch");
    btn.addEventListener("click", function () {
      load(device);
      device.classList.add("active");
      var f = device.querySelector("iframe");
      if (f) { f.removeAttribute("tabindex"); try { f.focus({ preventScroll: true }); } catch (e) {} }
    });
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var d = e.target;
        if (!(phoneLayout && d.dataset.lazyPhone === "tap")) load(d);
        io.unobserve(d);
      });
    }, { rootMargin: "300px 0px" });
    devices.forEach(function (d) { io.observe(d); });
  }

  var t;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () { devices.forEach(fit); }, 120);
  });
})();
