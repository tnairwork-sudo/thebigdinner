(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.gsap || !window.ScrollTrigger || !window.Lenis) return;
  if (!document.querySelector(".cine-arrive")) return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add("cine");

  var lenis = new window.Lenis({
    duration: 1.2,
    smoothWheel: true,
    syncTouch: false
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(function (time) {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  var lockWatch = new MutationObserver(function () {
    if (document.body.classList.contains("is-locked")) lenis.stop();
    else lenis.start();
  });
  lockWatch.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  var arrive = document.querySelector(".cine-arrive");
  var feature = document.getElementById("featureFilm");
  var door = arrive.querySelector(".film-frame");
  var lineA = arrive.querySelector(".display span:nth-child(1)");
  var lineB = arrive.querySelector(".display span:nth-child(2)");

  function playFeature(on) {
    if (!feature) return;
    if (on) {
      var attempt = feature.play();
      if (attempt && attempt.catch) attempt.catch(function () {});
    } else if (!feature.paused) {
      feature.pause();
    }
  }
  playFeature(false);

  var mobile = window.matchMedia("(max-width: 759px)").matches;

  gsap.set(door, { clipPath: "none" });
  gsap.timeline({
    defaults: { ease: "power1.out" },
    scrollTrigger: {
      trigger: arrive,
      start: "top top",
      end: mobile ? "+=85%" : "+=110%",
      pin: true,
      scrub: 0.75,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        playFeature(self.progress > 0.98);
        arrive.style.setProperty("--night", self.progress.toFixed(3));
      }
    }
  })
    .fromTo(door, { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1 }, 0)
    .to(lineA, { y: mobile ? 6 : 8 }, 0)
    .to(lineB, { y: mobile ? 16 : 22 }, 0);

  var speech = document.getElementById("speechFrame");
  if (speech) {
    ScrollTrigger.create({
      trigger: speech,
      start: "top bottom",
      end: "bottom top",
      scrub: true,
      onUpdate: function (self) {
        speech.style.setProperty("--flame-x", (10 + self.progress * 80).toFixed(1) + "%");
      }
    });
  }

  var phil = document.querySelector("#philosophy .headline");
  if (phil) {
    gsap.fromTo(phil, { y: 22 }, {
      y: -18,
      ease: "none",
      scrollTrigger: {
        trigger: "#philosophy",
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });
  }

  gsap.utils.toArray(".city-card .city-flip").forEach(function (flip) {
    gsap.fromTo(flip, { autoAlpha: 0 }, {
      autoAlpha: 1,
      ease: "power1.out",
      scrollTrigger: {
        trigger: flip.closest(".city-card"),
        start: "top 92%",
        end: "top 58%",
        scrub: 0.6
      }
    });
  });

  var grid = document.querySelector(".reels .reel-grid");
  if (grid) {
    var track = document.createElement("div");
    track.className = "reel-track";
    while (grid.firstChild) track.appendChild(grid.firstChild);
    grid.appendChild(track);
    var tiles = Array.prototype.filter.call(track.children, function (node) {
      return node.classList && node.classList.contains("reel-tile") && !node.classList.contains("is-echo");
    });
    tiles.forEach(function (tile) {
      var video = tile.querySelector("video");
      if (video) video.pause();
    });

    function focusMoments() {
      var mid = window.innerWidth / 2;
      var best = null;
      var bestFocus = 0;
      tiles.forEach(function (tile) {
        var rect = tile.getBoundingClientRect();
        var center = rect.left + rect.width / 2;
        var dist = Math.abs(center - mid) / Math.max(rect.width, 1);
        var focus = Math.max(0, 1 - dist);
        tile.style.setProperty("--focus", focus.toFixed(3));
        if (focus > bestFocus) {
          bestFocus = focus;
          best = tile;
        }
      });
      tiles.forEach(function (tile) {
        var video = tile.querySelector("video");
        if (!video) return;
        if (tile === best && bestFocus > 0.62) {
          video.muted = true;
          var attempt = video.play();
          if (attempt && attempt.catch) attempt.catch(function () {});
        } else if (!video.paused) {
          video.pause();
        }
      });
    }

    gsap.to(track, {
      x: function () {
        return -Math.max(0, track.scrollWidth - window.innerWidth);
      },
      ease: "none",
      scrollTrigger: {
        trigger: ".reels",
        start: "top top",
        end: function () {
          return "+=" + Math.max(window.innerHeight * 0.8, track.scrollWidth - window.innerWidth);
        },
        pin: true,
        scrub: 0.65,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: focusMoments,
        onRefresh: focusMoments
      }
    });
  }

  var inviteHead = document.querySelector("#apply .headline");
  if (inviteHead) {
    gsap.fromTo(inviteHead, { y: 24 }, {
      y: 0,
      ease: "none",
      scrollTrigger: {
        trigger: "#apply",
        start: "top 80%",
        end: "center 55%",
        scrub: true
      }
    });
  }

  var foot = document.querySelector(".colophon");
  var lastLine = document.querySelector(".colophon-line");
  if (lastLine && foot) {
    gsap.fromTo(lastLine, { y: 28, scale: 0.94 }, {
      y: 0,
      scale: 1.28,
      ease: "none",
      scrollTrigger: {
        trigger: foot,
        start: "top 90%",
        end: "top 35%",
        scrub: true
      }
    });
  }

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();
