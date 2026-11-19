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
    syncTouch: false,
    autoRaf: false
  });
  lenis.on("scroll", function () {
    if (document.body.classList.contains("is-locked")) return;
    ScrollTrigger.update();
  });
  gsap.ticker.add(function (time) {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  function setTriggers(on) {
    ScrollTrigger.getAll().forEach(function (st) {
      if (on) st.enable();
      else st.disable(false);
    });
  }

  function pauseVideos() {
    document.querySelectorAll("video").forEach(function (video) {
      if (video.paused) return;
      video.pause();
      video.dataset.wasPlaying = "1";
    });
  }

  function resumeVideos() {
    document.querySelectorAll("video").forEach(function (video) {
      if (video.dataset.wasPlaying !== "1") return;
      delete video.dataset.wasPlaying;
      var box = video.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= window.innerHeight) return;
      video.muted = true;
      var attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(function () {});
    });
  }

  var lockWatch = new MutationObserver(function () {
    var locked = document.body.classList.contains("is-locked");
    document.documentElement.classList.toggle("is-modal", locked);
    if (locked) {
      lenis.stop();
      setTriggers(false);
      pauseVideos();
    } else {
      setTriggers(true);
      lenis.start();
      ScrollTrigger.update();
      resumeVideos();
    }
  });
  lockWatch.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  var arrive = document.querySelector(".cine-arrive");
  var feature = document.getElementById("featureFilm");
  var speech = document.getElementById("speechFilm");

  function playVideo(video, on) {
    if (!video) return;
    if (on) {
      var attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(function () {});
    } else if (!video.paused) {
      video.pause();
    }
  }

  gsap.fromTo(".glass-card .line-rise", { yPercent: 110 }, {
    yPercent: 0,
    duration: 1.15,
    stagger: 0.14,
    ease: "power3.out",
    delay: 0.08
  });

  var mobile = window.matchMedia("(max-width: 759px)").matches;
  if (speech) gsap.set(speech, { autoAlpha: 0 });
  playVideo(feature, true);

  gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: arrive,
      start: "top top",
      end: mobile ? "+=28%" : "+=40%",
      pin: true,
      scrub: 0.35,
      anticipatePin: 0,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        var p = self.progress;
        playVideo(feature, p < 0.92);
        if (speech && p > 0.04) {
          if (speech.getAttribute("preload") === "none") speech.setAttribute("preload", "auto");
          playVideo(speech, true);
        } else {
          playVideo(speech, false);
        }
      }
    }
  })
    .to(feature, { autoAlpha: 0 }, 0.18)
    .to(speech, { autoAlpha: 1 }, 0.18);

  document.querySelectorAll("main h1.display, main h2.headline, main h2.display, main h3.display").forEach(function (heading) {
    if (heading.closest(".glass-card, .pair, .art-title") || heading.classList.contains("art-title")) return;
    if (heading.querySelector(".line-mask")) return;
    var parts = heading.innerHTML.split(/<br\s*\/?>/i);
    heading.innerHTML = parts.map(function (part) {
      return '<span class="line-mask"><span class="line-rise">' + part.trim() + "</span></span>";
    }).join("");
    var lines = heading.querySelectorAll(".line-rise");
    gsap.fromTo(lines, { yPercent: 110 }, {
      yPercent: 0,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: {
        trigger: heading,
        start: "top 88%",
        end: "top 60%",
        scrub: 0.45
      }
    });
  });

  if (window.matchMedia("(min-width: 900px)").matches) {
    gsap.utils.toArray(".scatter .shot").forEach(function (shot) {
      var depth = (parseFloat(shot.getAttribute("data-depth")) || 40) * 0.4;
      gsap.fromTo(shot, { y: depth }, {
        y: -depth,
        ease: "none",
        scrollTrigger: {
          trigger: ".scatter",
          start: "top bottom",
          end: "bottom top",
          scrub: true
        }
      });
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

    if ("IntersectionObserver" in window) {
      var playObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target.querySelector("video");
          if (!video) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            video.muted = true;
            var attempt = video.play();
            if (attempt && attempt.catch) attempt.catch(function () {});
          } else if (!video.paused) {
            video.pause();
          }
        });
      }, { threshold: [0, 0.6] });
      tiles.forEach(function (tile) { playObserver.observe(tile); });
    }
  }

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();
