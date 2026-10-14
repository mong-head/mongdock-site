/* mongdock site v2 — one small shared script (no dependencies) */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * STORE LINK — the only place to change at launch.
   * Leave empty before launch: every [data-get] button shows
   * its "coming soon" label in the page language (disabled look).
   * At launch, put the Microsoft Store address here, e.g.
   *   var STORE_URL = "https://apps.microsoft.com/detail/9NQ3NKW93F3M";
   * and every get button becomes a live store link with its data-ready label.
   * ------------------------------------------------------------------ */
  var STORE_URL = "";

  var doc = document;
  var root = doc.documentElement;
  root.classList.add("js");
  var lang = root.getAttribute("lang") || "ko";

  /* Label for the frame dots under each scene: (frame number, frame count) */
  var DOT_LABEL = {
    ko: function (k, n) { return k + "번째 장면 보기 (" + n + "장 중)"; },
    en: function (k, n) { return "Show frame " + k + " of " + n; },
    ja: function (k, n) { return "場面 " + k + " / " + n + " を表示"; },
    "zh-Hans": function (k, n) { return "显示第 " + k + " 个画面（共 " + n + " 个）"; },
    "zh-Hant": function (k, n) { return "顯示第 " + k + " 個畫面（共 " + n + " 個）"; },
    de: function (k, n) { return "Bild " + k + " von " + n + " zeigen"; },
    fr: function (k, n) { return "Afficher l’image " + k + " sur " + n; },
    es: function (k, n) { return "Mostrar imagen " + k + " de " + n; }
  };
  var dotLabel = DOT_LABEL[lang] || DOT_LABEL.en;

  /* ---------- Get buttons ---------- */
  if (STORE_URL) {
    var gets = doc.querySelectorAll("[data-get]");
    for (var g = 0; g < gets.length; g++) {
      var el = gets[g];
      var a = el;
      if (el.tagName !== "A") {
        a = doc.createElement("a");
        a.className = el.className;
        a.setAttribute("data-get", "");
        el.parentNode.replaceChild(a, el);
      }
      a.setAttribute("href", STORE_URL);
      a.setAttribute("rel", "noopener");
      a.removeAttribute("aria-disabled");
      a.classList.remove("is-soon");
      a.removeAttribute("role");
      a.removeAttribute("tabindex");
      var label = el.getAttribute("data-ready");
      if (label) a.textContent = label;
    }
  }

  /* ---------- Header: translucent when scrolled ---------- */
  var header = doc.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", (window.scrollY || window.pageYOffset) > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile menu ---------- */
  var toggle = doc.querySelector(".nav-toggle");
  var nav = doc.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    });
  }

  /* ---------- Dropdowns: Features + language menus ----------
   * Any button with aria-controls inside the header nav (.nav-drop-btn) or a
   * language menu (.lang-btn) opens its list. One open at a time; click
   * outside or Esc closes (Esc returns focus to the button). */
  var dropBtns = doc.querySelectorAll(".nav-drop-btn, .lang-btn");
  var drops = [];
  for (var d = 0; d < dropBtns.length; d++) {
    var list = doc.getElementById(dropBtns[d].getAttribute("aria-controls"));
    if (list) drops.push({ btn: dropBtns[d], list: list });
  }
  function setDrop(item, open) {
    item.btn.setAttribute("aria-expanded", String(open));
    item.list.classList.toggle("is-open", open);
  }
  function closeDrops(except) {
    for (var c = 0; c < drops.length; c++) {
      if (drops[c] !== except && drops[c].btn.getAttribute("aria-expanded") === "true") setDrop(drops[c], false);
    }
  }
  for (var e2 = 0; e2 < drops.length; e2++) {
    (function (item) {
      item.btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = item.btn.getAttribute("aria-expanded") !== "true";
        closeDrops(item);
        setDrop(item, open);
      });
    })(drops[e2]);
  }
  if (drops.length) {
    doc.addEventListener("click", function (e) {
      for (var c = 0; c < drops.length; c++) {
        if (!drops[c].list.contains(e.target)) setDrop(drops[c], false);
      }
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      for (var c = 0; c < drops.length; c++) {
        if (drops[c].btn.getAttribute("aria-expanded") === "true") {
          setDrop(drops[c], false);
          drops[c].btn.focus();
        }
      }
    });
  }

  /* ---------- Scenes: stacked frames, cross-fade ----------
   * Only the first frame has a src in the HTML. The other frames carry
   * data-src / data-srcset and are filled in when the scene comes near the
   * screen, so a page only downloads the scenes the visitor scrolls to. */
  var STEP = 1400;      // ms per frame
  var LAST_HOLD = 2000; // ms on the last frame before looping
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function Scene(fig) {
    this.frames = fig.querySelectorAll(".scene-frames img");
    this.n = this.frames.length;
    this.i = 0;
    this.timer = null;
    this.visible = false;
    if (this.n < 2) return;
    var dots = fig.querySelector(".scene-dots");
    if (!dots) {
      dots = doc.createElement("div");
      dots.className = "scene-dots";
      fig.appendChild(dots);
    }
    dots.removeAttribute("hidden");
    this.dots = [];
    var self = this;
    for (var k = 0; k < this.n; k++) {
      var b = doc.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", dotLabel(k + 1, this.n));
      b.setAttribute("aria-current", k === 0 ? "true" : "false");
      (function (idx) {
        b.addEventListener("click", function () { self.load(); self.show(idx); self.schedule(); });
      })(k);
      dots.appendChild(b);
      this.dots.push(b);
    }
  }
  Scene.prototype.show = function (idx) {
    for (var k = 0; k < this.n; k++) {
      var on = k === idx;
      this.frames[k].classList.toggle("is-on", on);
      if (this.dots) this.dots[k].setAttribute("aria-current", on ? "true" : "false");
    }
    this.i = idx;
  };
  Scene.prototype.load = function () {
    if (this.loaded) return;
    this.loaded = true;
    for (var k = 0; k < this.n; k++) {
      var im = this.frames[k];
      var ss = im.getAttribute("data-srcset");
      var src = im.getAttribute("data-src");
      if (ss) { im.setAttribute("srcset", ss); im.removeAttribute("data-srcset"); }
      if (src) { im.setAttribute("src", src); im.removeAttribute("data-src"); }
    }
  };
  Scene.prototype.schedule = function () {
    clearTimeout(this.timer);
    this.timer = null;
    if (reduce || !this.visible || this.n < 2 || doc.hidden) return;
    var self = this;
    var wait = this.i === this.n - 1 ? LAST_HOLD : STEP;
    this.timer = setTimeout(function () {
      var next = self.frames[(self.i + 1) % self.n];
      if (!next.complete) { // still downloading: wait a little instead of fading to an empty frame
        self.timer = setTimeout(function () { self.schedule(); }, 300);
        return;
      }
      self.show((self.i + 1) % self.n);
      self.schedule();
    }, wait);
  };
  Scene.prototype.setVisible = function (v) {
    this.visible = v;
    if (v) this.load();
    this.schedule();
  };

  var scenes = [];
  var figs = doc.querySelectorAll("[data-scene]");
  for (var s = 0; s < figs.length; s++) {
    var sc = new Scene(figs[s]);
    if (sc.n >= 2) { sc.el = figs[s]; scenes.push(sc); }
  }

  if (scenes.length) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e++) {
          for (var q = 0; q < scenes.length; q++) {
            if (scenes[q].el === entries[e].target) scenes[q].setVisible(entries[e].isIntersecting);
          }
        }
      }, { threshold: 0.3 });
      for (var q = 0; q < scenes.length; q++) io.observe(scenes[q].el);
      // start downloading the remaining frames a little before a scene scrolls into view
      var near = new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e++) {
          if (!entries[e].isIntersecting) continue;
          for (var q = 0; q < scenes.length; q++) {
            if (scenes[q].el === entries[e].target) { scenes[q].load(); near.unobserve(scenes[q].el); }
          }
        }
      }, { rootMargin: "300px 0px" });
      for (var q2 = 0; q2 < scenes.length; q2++) near.observe(scenes[q2].el);
    } else {
      for (var r = 0; r < scenes.length; r++) { scenes[r].load(); scenes[r].setVisible(true); }
    }
    doc.addEventListener("visibilitychange", function () {
      for (var t = 0; t < scenes.length; t++) scenes[t].schedule();
    });
  }
})();
