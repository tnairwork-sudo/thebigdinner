(function () {
  var nav = document.querySelector("[data-nav]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function dialogOpen() {
    return document.querySelector(".welcome.is-open, .overlay.is-open, .form-notice.is-open, .reel-lightbox.is-open");
  }

  if (nav) {
    var toggle = nav.querySelector("[data-nav-toggle]");

    function onScroll() {
      nav.classList.toggle("is-scrolled", window.scrollY > 12);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    function closeMenu() {
      nav.classList.remove("is-open");
      if (!dialogOpen()) document.body.classList.remove("is-locked");
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Menu";
      }
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.textContent = open ? "Close" : "Menu";
        document.body.classList.toggle("is-locked", open || !!dialogOpen());
      });

      nav.querySelectorAll(".nav-links a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && nav.classList.contains("is-open")) closeMenu();
      });
    }
  }

  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  reveals.forEach(function (el) { observer.observe(el); });
})();

(function () {
  var tiles = document.querySelectorAll(".reel-tile");
  var box = document.getElementById("reelLightbox");
  if (!tiles.length || !box) return;
  var player = box.querySelector(".reel-lightbox-video");
  var closer = box.querySelector(".reel-lightbox-close");
  var lastTile = null;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function preview(video) {
    var attempt = video.play();
    if (attempt && attempt.catch) attempt.catch(function () {});
  }

  function rest(video) {
    if (!video || video.paused) return;
    video.pause();
  }

  function open(tile, video) {
    var source = video.querySelector("source");
    rest(video);
    lastTile = tile;
    player.poster = video.getAttribute("poster") || "";
    player.src = source ? source.getAttribute("src") : "";
    player.muted = false;
    box.hidden = false;
    box.classList.add("is-open");
    document.body.classList.add("is-locked");
    var attempt = player.play();
    if (attempt && attempt.catch) {
      attempt.catch(function () {
        player.muted = true;
        var again = player.play();
        if (again && again.catch) again.catch(function () {});
      });
    }
    closer.focus();
  }

  function closeBox() {
    player.pause();
    player.removeAttribute("src");
    player.load();
    box.classList.remove("is-open");
    box.hidden = true;
    var menuOpen = document.querySelector("[data-nav].is-open");
    var other = document.querySelector(".welcome.is-open, .overlay.is-open, .form-notice.is-open");
    if (!menuOpen && !other) document.body.classList.remove("is-locked");
    if (lastTile && lastTile.focus) lastTile.focus();
  }

  tiles.forEach(function (tile) {
    var video = tile.querySelector("video");
    if (finePointer) {
      tile.addEventListener("pointerenter", function () { preview(video); });
      tile.addEventListener("pointerleave", function () { rest(video); });
    }
    tile.addEventListener("click", function () {
      if (!finePointer && video.paused) {
        preview(video);
        return;
      }
      open(tile, video);
    });
  });

  if (!finePointer) {
    document.addEventListener("pointerdown", function (event) {
      tiles.forEach(function (tile) {
        if (!tile.contains(event.target)) rest(tile.querySelector("video"));
      });
    });
  }

  closer.addEventListener("click", closeBox);
  box.querySelector(".reel-lightbox-scrim").addEventListener("click", closeBox);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && box.classList.contains("is-open")) closeBox();
  });
})();

(function () {
  var button = document.getElementById("soundToggle");
  if (!button) return;
  var sections = document.querySelectorAll("main > section, footer.colophon");
  if (!sections.length) return;

  var names = ["powder", "raspberry", "cream", "pistachio", "cornflower", "teal", "mustard", "tangerine", "lilac", "pink"];
  var rootStyle = getComputedStyle(document.documentElement);

  function parseColor(value) {
    var text = String(value || "").trim();
    var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    if (hex) {
      var raw = hex[1];
      if (raw.length === 3) raw = raw.replace(/./g, function (ch) { return ch + ch; });
      var num = parseInt(raw, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    var rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(text);
    if (!rgb) return null;
    return [+rgb[1], +rgb[2], +rgb[3]];
  }

  var palette = [];
  names.forEach(function (name) {
    var rgb = parseColor(rootStyle.getPropertyValue("--" + name));
    if (rgb) palette.push({ name: name, rgb: rgb });
  });

  function toneFor(section) {
    var rgb = parseColor(getComputedStyle(section).backgroundColor);
    if (!rgb || !palette.length) return "cream";
    var best = palette[0];
    var bestDist = Infinity;
    palette.forEach(function (item) {
      var dist = Math.pow(rgb[0] - item.rgb[0], 2) + Math.pow(rgb[1] - item.rgb[1], 2) + Math.pow(rgb[2] - item.rgb[2], 2);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    });
    return best.name;
  }

  function sectionBehind() {
    var box = button.getBoundingClientRect();
    var y = box.top + box.height / 2;
    var found = null;
    sections.forEach(function (section) {
      var rect = section.getBoundingClientRect();
      if (rect.top <= y && rect.bottom >= y) found = section;
    });
    return found || sections[0];
  }

  var current = "";
  function paint(section) {
    if (!section) return;
    var tone = toneFor(section);
    var next = "is-tone-" + tone;
    if (tone === current && button.classList.contains(next)) return;
    var stale = [];
    button.classList.forEach(function (name) {
      if (name.indexOf("is-tone-") === 0) stale.push(name);
    });
    stale.forEach(function (name) { button.classList.remove(name); });
    button.classList.add(next);
    current = tone;
  }

  paint(sectionBehind());

  var scheduled = 0;
  function sync() {
    if (scheduled) return;
    scheduled = window.requestAnimationFrame(function () {
      scheduled = 0;
      paint(sectionBehind());
    });
  }

  if ("IntersectionObserver" in window) {
    var thresholds = [0, 1];
    var step;
    for (step = 1; step < 20; step++) thresholds.push(step / 20);
    var observer = new IntersectionObserver(sync, {
      root: null,
      rootMargin: "-90% 0px -2% 0px",
      threshold: thresholds
    });
    sections.forEach(function (section) { observer.observe(section); });
  }

  window.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
})();
