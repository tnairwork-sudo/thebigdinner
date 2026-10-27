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
