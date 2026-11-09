(function () {
  var nav = document.querySelector("[data-nav]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function dialogOpen() {
    return document.querySelector(".overlay.is-open, .form-notice.is-open, .reel-lightbox.is-open");
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
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var grid = document.querySelector(".reels .reel-grid");

  if (grid && !reduceMotion && !document.querySelector(".cine-arrive")) {
    var track = document.createElement("div");
    track.className = "reel-track";
    while (grid.firstChild) track.appendChild(grid.firstChild);
    Array.prototype.slice.call(track.children).forEach(function (node) {
      var copy = node.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      copy.setAttribute("tabindex", "-1");
      copy.classList.add("is-echo");
      track.appendChild(copy);
    });
    grid.appendChild(track);
  }

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
    var other = document.querySelector(".overlay.is-open, .form-notice.is-open");
    if (!menuOpen && !other) document.body.classList.remove("is-locked");
    if (lastTile && lastTile.focus) lastTile.focus();
  }

  tiles.forEach(function (tile) {
    var video = tile.querySelector("video");
    if (finePointer) {
      tile.addEventListener("pointerenter", function () { preview(video); });
    }
    tile.addEventListener("click", function () {
      open(tile, video);
    });
  });

  if (!reduceMotion && "IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (entry.isIntersecting) {
          video.muted = true;
          var attempt = video.play();
          if (attempt && attempt.catch) attempt.catch(function () {});
        } else if (!video.paused) {
          video.pause();
        }
      });
    }, { threshold: 0.4 });
    document.querySelectorAll(".reel-tile video, .video-feed video").forEach(function (video) {
      seen.observe(video);
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
    var named = getComputedStyle(section).getPropertyValue("--sound-tone").trim();
    if (named) return named;
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

(function () {
  var videos = document.querySelectorAll(".film .film-video");
  if (!videos.length) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var globalSound = document.getElementById("soundToggle");
  var filmsInView = 0;

  function setFilmInView(on) {
    filmsInView += on ? 1 : -1;
    if (filmsInView < 0) filmsInView = 0;
    var active = filmsInView > 0;
    document.body.classList.toggle("film-in-view", active);
    if (!globalSound) return;
    if (active) {
      globalSound.setAttribute("aria-hidden", "true");
      globalSound.setAttribute("tabindex", "-1");
    } else {
      globalSound.setAttribute("aria-hidden", "false");
      globalSound.removeAttribute("tabindex");
    }
  }

  videos.forEach(function (video) {
    var frame = video.closest(".film-frame") || video.parentElement;
    var toggle = frame.querySelector(".film-sound");

    function play() {
      var attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(function () {});
    }

    function setSound(on) {
      video.muted = !on;
      if (!toggle) return;
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
      toggle.textContent = on ? "Sound: On" : "Sound: Off";
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        setSound(video.muted);
        if (video.paused) play();
      });
    }

    video.addEventListener("click", function () {
      video.controls = true;
    });

    if (reduce || !("IntersectionObserver" in window)) return;

    var playObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) play();
        else video.pause();
      });
    }, { threshold: 0.4 });
    playObserver.observe(video);
  });

  if (!("IntersectionObserver" in window)) return;

  var viewObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      setFilmInView(entry.isIntersecting);
    });
  }, { threshold: 0 });
  document.querySelectorAll(".film").forEach(function (film) {
    viewObserver.observe(film);
  });
})();

(function () {
  if (!document.getElementById("approach")) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var patterns = {
    tap: [10],
    key: [10, 46, 18, 46, 30],
    land: [16],
    soft: [12],
    press: [36],
    flourish: [12, 40, 18, 40, 26, 52, 40]
  };
  var pulseClass = {
    tap: "is-pulse",
    key: "is-pulse-3",
    land: "is-pulse",
    soft: "is-pulse",
    press: "is-pulse-firm",
    flourish: "is-pulse-flourish"
  };
  var pulseNames = ["is-pulse", "is-pulse-2", "is-pulse-3", "is-pulse-firm", "is-pulse-flourish"];
  var gentleQueue = [];
  var gentleTimer = 0;
  var lastDirect = 0;

  function pulse(el, kind) {
    if (reduce || !el) return;
    var cls = pulseClass[kind] || "is-pulse";
    pulseNames.forEach(function (name) { el.classList.remove(name); });
    requestAnimationFrame(function () { el.classList.add(cls); });
    function done() {
      el.classList.remove(cls);
      el.removeEventListener("animationend", done);
    }
    el.addEventListener("animationend", done);
  }

  function pumpGentle() {
    if (gentleTimer || !gentleQueue.length) return;
    var since = performance.now() - lastDirect;
    if (since < 420) {
      gentleTimer = setTimeout(function () {
        gentleTimer = 0;
        pumpGentle();
      }, 440 - since);
      return;
    }
    var kind = gentleQueue.shift();
    try { navigator.vibrate(patterns[kind]); } catch (err) {}
    gentleTimer = setTimeout(function () {
      gentleTimer = 0;
      pumpGentle();
    }, 720);
  }

  function buzz(kind) {
    if (reduce || !navigator.vibrate) return;
    if (kind === "soft" || kind === "land") {
      if (gentleQueue.length < 3) gentleQueue.push(kind);
      pumpGentle();
      return;
    }
    lastDirect = performance.now();
    try { navigator.vibrate(patterns[kind] || [10]); } catch (err) {}
  }

  function feel(kind, el) {
    pulse(el, kind);
    buzz(kind);
  }

  function sparkle(el) {
    if (reduce || !el) return;
    var rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    var node = document.createElement("span");
    node.className = "spark";
    node.setAttribute("aria-hidden", "true");
    var y = Math.min(rect.bottom - 16, Math.max(rect.top + 28, 72));
    node.style.left = (rect.left + rect.width / 2) + "px";
    node.style.top = y + "px";
    var spots = [-22, -10, 0, 12, 20];
    var rise = [-18, -32, -24, -36, -16];
    for (var i = 0; i < spots.length; i++) {
      var mote = document.createElement("i");
      mote.style.setProperty("--x", spots[i] + "px");
      mote.style.setProperty("--y", rise[i] + "px");
      node.appendChild(mote);
    }
    document.body.appendChild(node);
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 1300);
  }

  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function formatWhen(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return "";
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (!y || !m || !d) return "";
    var target = new Date(y, m - 1, d);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var days = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (days < 0) return "";
    var label = d + " " + months[m - 1] + " " + y;
    if (days === 0) return label + " · Today";
    if (days === 1) return label + " · 1 day";
    return label + " · " + days + " days";
  }
  document.querySelectorAll(".city-when").forEach(function (el) {
    var text = formatWhen(el.getAttribute("data-date"));
    el.textContent = text;
    el.hidden = !text;
  });

  var MARK = "tbd-mark";

  function explore(card, fromTap) {
    if (!card) return;
    card.classList.add("is-open");
    if (fromTap) feel("tap", card.querySelector(".art") || card);
  }

  if (reduce) {
    document.querySelectorAll(".city-card").forEach(function (card) {
      card.classList.add("is-open");
    });
  }

  if ("IntersectionObserver" in window) {
    var cityObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        explore(entry.target, false);
        cityObserver.unobserve(entry.target);
      });
    }, { threshold: 0.42 });
    document.querySelectorAll(".city-card").forEach(function (card) {
      cityObserver.observe(card);
    });
  }

  var keepsake = document.getElementById("keepsake");
  function setKept() {
    if (!keepsake) return;
    keepsake.classList.add("is-kept");
    keepsake.setAttribute("aria-pressed", "true");
    var word = keepsake.querySelector(".keepsake-word");
    if (word) word.textContent = "Kept";
  }
  try {
    if (localStorage.getItem(MARK) === "1") setKept();
  } catch (err) {}
  if (keepsake) {
    keepsake.addEventListener("click", function () {
      if (keepsake.getAttribute("aria-pressed") === "true") return;
      setKept();
      try { localStorage.setItem(MARK, "1"); } catch (err) {}
    });
  }

  var keyLock = 0;
  function unlockKey(source) {
    var now = Date.now();
    if (now - keyLock < 1200) return;
    keyLock = now;
    var line = document.getElementById("philosophyLine");
    if (!line) return;
    if (reduce) {
      line.classList.add("is-kept-line");
      return;
    }
    var rect = line.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      line.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    line.classList.remove("is-shimmer");
    requestAnimationFrame(function () { line.classList.add("is-shimmer"); });
    feel("key", source || line);
    setTimeout(function () { line.classList.remove("is-shimmer"); }, 2000);
  }

  function bindKey(el) {
    if (!el) return;
    var timer = 0;
    var held = false;
    var lastTap = 0;
    var sx = 0;
    var sy = 0;
    function clear() { clearTimeout(timer); }
    el.addEventListener("pointerdown", function (event) {
      if (event.button && event.button !== 0) return;
      held = false;
      sx = event.clientX;
      sy = event.clientY;
      el.classList.add("is-holding");
      clear();
      timer = setTimeout(function () {
        held = true;
        el.classList.remove("is-holding");
        unlockKey(el);
      }, 560);
    });
    el.addEventListener("pointermove", function (event) {
      if (Math.abs(event.clientX - sx) > 12 || Math.abs(event.clientY - sy) > 12) {
        clear();
        el.classList.remove("is-holding");
      }
    });
    function release() {
      clear();
      el.classList.remove("is-holding");
    }
    el.addEventListener("pointerup", function () {
      clear();
      el.classList.remove("is-holding");
      if (held) { held = false; lastTap = 0; return; }
      var now = Date.now();
      if (now - lastTap < 380) unlockKey(el);
      lastTap = now;
    });
    el.addEventListener("pointercancel", release);
  }

  bindKey(document.getElementById("crest"));
  bindKey(document.querySelector(".hero .display"));
  bindKey(document.querySelector(".colophon .wordmark"));
  var crest = document.getElementById("crest");
  if (crest) {
    crest.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        unlockKey(crest);
      }
    });
  }

  var quizRoot = document.getElementById("guestQuiz");
  if (quizRoot && window.fetch) {
    fetch("/guest-quiz.json", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("quiz");
        return res.json();
      })
      .then(function (config) { startGuestQuiz(config); })
      .catch(function () {});
  }

  function startGuestQuiz(config) {
    if (!config || !config.types || !config.questions) return;
    if (config.questions.length < 10 || config.questions.length > 12) return;
    if (!config.types.length) return;
    var body = document.getElementById("guestQuizBody");
    var stepEl = document.getElementById("guestStep");
    var askEl = document.getElementById("guestAsk");
    var answersEl = document.getElementById("guestAnswers");
    var backBtn = document.getElementById("guestBack");
    var card = document.getElementById("guestCard");
    var nameEl = document.getElementById("guestName");
    var sigEl = document.getElementById("guestSignature");
    var traitsEl = document.getElementById("guestStrengths");
    var roomEl = document.getElementById("guestRoom");
    var clickEl = document.getElementById("guestClick");
    var shareBtn = document.getElementById("guestShare");
    var copiedEl = document.getElementById("guestCopied");
    var againBtn = document.getElementById("guestAgain");
    if (!body || !askEl || !answersEl || !card) return;
    body.hidden = false;
    var picks = [];
    var currentType = null;

    function typeById(id) {
      var i;
      for (i = 0; i < config.types.length; i++) {
        if (config.types[i].id === id) return config.types[i];
      }
      return null;
    }

    function winningType(list) {
      var totals = {};
      config.types.forEach(function (type) { totals[type.id] = 0; });
      list.forEach(function (answer) {
        var scores = answer && answer.scores ? answer.scores : {};
        Object.keys(scores).forEach(function (id) {
          if (totals[id] == null) totals[id] = 0;
          totals[id] += scores[id];
        });
      });
      var best = -1;
      config.types.forEach(function (type) {
        if ((totals[type.id] || 0) > best) best = totals[type.id] || 0;
      });
      var tied = config.types.filter(function (type) { return (totals[type.id] || 0) === best; });
      if (tied.length === 1) return tied[0];
      var i;
      var j;
      for (i = list.length - 1; i >= 0; i--) {
        var scores = list[i] && list[i].scores ? list[i].scores : {};
        var lead = 0;
        var leadType = null;
        for (j = 0; j < tied.length; j++) {
          var n = scores[tied[j].id] || 0;
          if (n > lead) {
            lead = n;
            leadType = tied[j];
          }
        }
        if (leadType) return leadType;
      }
      return tied[0];
    }

    function showQuestion(index) {
      var question = config.questions[index];
      if (!question) return;
      card.hidden = true;
      if (copiedEl) copiedEl.hidden = true;
      if (stepEl) {
        stepEl.hidden = false;
        stepEl.textContent = (index + 1) + " of " + config.questions.length;
      }
      askEl.hidden = false;
      answersEl.hidden = false;
      askEl.textContent = question.prompt || "";
      answersEl.innerHTML = "";
      (question.answers || []).forEach(function (answer) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-line guest-answer";
        btn.textContent = answer.text || "";
        btn.addEventListener("click", function () {
          picks[index] = answer;
          picks.length = index + 1;
          if (index + 1 < config.questions.length) showQuestion(index + 1);
          else showResult(winningType(picks), true);
        });
        answersEl.appendChild(btn);
      });
      if (backBtn) backBtn.hidden = index === 0;
    }

    function showResult(type, celebrate) {
      if (!type) return;
      currentType = type;
      askEl.hidden = true;
      answersEl.hidden = true;
      answersEl.innerHTML = "";
      if (stepEl) stepEl.hidden = true;
      if (backBtn) backBtn.hidden = false;
      if (nameEl) nameEl.textContent = type.name || "";
      if (sigEl) sigEl.textContent = type.signature || "";
      if (traitsEl) {
        traitsEl.innerHTML = "";
        (type.strengths || type.traits || []).forEach(function (trait) {
          var item = document.createElement("li");
          item.textContent = trait;
          traitsEl.appendChild(item);
        });
      }
      if (roomEl) roomEl.textContent = type.room || "";
      if (clickEl) {
        var other = typeById(type.clicksWith);
        clickEl.textContent = other ? other.name : (type.clicksWith || "");
      }
      card.hidden = false;
      if (!celebrate) return;
      setTimeout(function () {
        feel("flourish", card);
        if (card.focus) card.focus();
      }, 220);
    }

    function shareUrl(type) {
      var url = new URL(location.href);
      url.searchParams.set("guest", type.id);
      url.hash = "";
      return url.toString();
    }

    function markCopied() {
      if (!copiedEl) return;
      copiedEl.hidden = false;
      setTimeout(function () { copiedEl.hidden = true; }, 1600);
    }

    function copyText(value) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(markCopied).catch(function () {
          legacyCopy(value);
        });
        return;
      }
      legacyCopy(value);
    }

    function legacyCopy(value) {
      var area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-999px";
      document.body.appendChild(area);
      area.select();
      try {
        if (document.execCommand("copy")) markCopied();
      } catch (err) {}
      document.body.removeChild(area);
    }

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (!picks.length) {
          showQuestion(0);
          return;
        }
        picks.pop();
        showQuestion(picks.length);
      });
    }
    if (againBtn) {
      againBtn.addEventListener("click", function () {
        picks = [];
        currentType = null;
        var url = new URL(location.href);
        url.searchParams.delete("guest");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
        showQuestion(0);
      });
    }
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (!currentType) return;
        var url = shareUrl(currentType);
        var text = "I am " + currentType.name + ". " + (currentType.signature || "");
        if (navigator.share) {
          navigator.share({ title: currentType.name, text: text, url: url }).catch(function (err) {
            if (err && err.name === "AbortError") return;
            copyText(text + " " + url);
          });
          return;
        }
        copyText(text + " " + url);
      });
    }

    var presetId = "";
    try { presetId = new URLSearchParams(location.search).get("guest") || ""; } catch (err) {}
    var preset = typeById(presetId);
    if (preset) showResult(preset, false);
    else showQuestion(0);
  }

  var order = ["room", "films", "philosophy", "standard", "lineage", "cities", "invitation"];
  var markNames = {
    room: "The room",
    films: "The films",
    philosophy: "The philosophy",
    standard: "The standard",
    lineage: "The lineage",
    cities: "The cities",
    invitation: "The invitation"
  };
  var far = -1;
  var rewards = { films: false, editions: false, invite: false };
  var pending = { films: false, invite: false, editionEl: null };
  var note = document.getElementById("approachNote");
  var rail = document.getElementById("approachRail");
  var ticks = document.querySelectorAll("#approachTicks [data-tick]");
  var counted = false;

  function armed() { return window.scrollY > 20; }

  function rewardFilms() {
    if (rewards.films) return;
    if (!armed()) { pending.films = true; return; }
    pending.films = false;
    rewards.films = true;
    var film = document.querySelector(".film");
    feel("soft", film);
    sparkle(film);
  }

  function rewardInvite() {
    if (rewards.invite) return;
    if (!armed()) { pending.invite = true; return; }
    pending.invite = false;
    rewards.invite = true;
    var btn = document.querySelector("#apply .invite-btn");
    var line = document.getElementById("goalLine");
    if (line) line.hidden = false;
    if (btn) btn.classList.add("is-reward");
    feel("soft", btn);
    sparkle(btn || document.getElementById("apply"));
  }

  function rewardEdition(el) {
    if (rewards.editions) return;
    if (!armed()) {
      pending.editionEl = el || pending.editionEl;
      return;
    }
    rewards.editions = true;
    pending.editionEl = null;
    feel("land", el);
    sparkle(el);
  }

  function paintTicks() {
    ticks.forEach(function (tick, i) {
      tick.classList.toggle("is-lit", i <= far);
    });
  }

  function setFar(id) {
    var idx = order.indexOf(id);
    if (idx < 0 || idx <= far) return;
    var prev = far;
    far = idx;
    paintTicks();
    if (note && markNames[id]) note.textContent = markNames[id];
    var filmAt = order.indexOf("films");
    var inviteAt = order.indexOf("invitation");
    if (prev < filmAt && idx >= filmAt) rewardFilms();
    if (prev < inviteAt && idx >= inviteAt) rewardInvite();
  }

  function animateCount(el, to, ms, done) {
    var start = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - start) / ms);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(frame);
      else if (done) done();
    }
    requestAnimationFrame(frame);
  }

  function runCount() {
    if (counted) return;
    counted = true;
    var root = document.getElementById("editionCount");
    if (!root) return;
    var nums = root.querySelectorAll("[data-to]");
    var total = root.querySelector("[data-total]");
    if (reduce) {
      rewardEdition(total || root);
      return;
    }
    var landed = false;
    nums.forEach(function (el, index) {
      var to = parseInt(el.getAttribute("data-to"), 10) || 0;
      el.textContent = "0";
      setTimeout(function () {
        animateCount(el, to, 880, el.hasAttribute("data-total") ? function () {
          if (landed) return;
          landed = true;
          rewardEdition(el);
        } : null);
      }, index * 80);
    });
  }

  if ("IntersectionObserver" in window) {
    var markObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        setFar(entry.target.getAttribute("data-mark"));
      });
    }, { threshold: 0.22, rootMargin: "0px 0px -18% 0px" });
    document.querySelectorAll("[data-mark]").forEach(function (el) {
      markObserver.observe(el);
    });
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCount();
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.45 });
    var countEl = document.getElementById("editionCount");
    if (countEl) countObserver.observe(countEl);
  } else {
    setFar("invitation");
    runCount();
  }
  setFar("room");

  var scheduled = 0;
  function onScroll() {
    if (scheduled) return;
    scheduled = window.requestAnimationFrame(function () {
      scheduled = 0;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (rail) {
        rail.style.setProperty("--p", p.toFixed(4));
        rail.setAttribute("aria-valuenow", String(Math.round(p * 100)));
      }
      if (pending.films) rewardFilms();
      if (pending.invite) rewardInvite();
      if (pending.editionEl) rewardEdition(pending.editionEl);
    });
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  document.addEventListener("click", function (event) {
    var btn = event.target.closest("button");
    if (btn) {
      if (btn.classList.contains("invite-btn")) feel("press", btn);
      else feel("tap", btn);
      return;
    }
    var card = event.target.closest(".city-card");
    if (card) {
      explore(card, true);
      return;
    }
    var film = event.target.closest(".film-frame");
    if (film) feel("tap", film);
  });
})();

(function () {
  var nodes = document.querySelectorAll(".film, .poster-run, .reels, .archive, .gallery-block, .press, footer.colophon");
  if (!nodes.length) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    nodes.forEach(function (el) { el.classList.add("is-seen"); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-seen");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.05, rootMargin: "0px 0px -24px 0px" });
  nodes.forEach(function (el) { observer.observe(el); });
})();

(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (document.querySelector(".cine-arrive")) return;
  var sections = Array.prototype.filter.call(
    document.querySelectorAll("main > section"),
    function (section) {
      return !section.classList.contains("reels") && !section.classList.contains("film") && !section.classList.contains("city-card");
    }
  );
  if (!sections.length) return;
  var ticking = false;
  function frame() {
    ticking = false;
    var vh = window.innerHeight || 1;
    sections.forEach(function (section) {
      var rect = section.getBoundingClientRect();
      var mid = rect.top + rect.height * 0.5;
      var dist = (mid - vh * 0.5) / vh;
      var cam = Math.max(-1, Math.min(1, dist));
      var near = 1 - Math.min(1, Math.abs(cam));
      section.style.setProperty("--cam", cam.toFixed(3));
      section.style.setProperty("--near", near.toFixed(3));
    });
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  frame();
})();
