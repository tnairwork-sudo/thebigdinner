(function () {
  var nav = document.querySelector("[data-nav]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function dialogOpen() {
    return document.querySelector(".welcome.is-open, .overlay.is-open, .form-notice.is-open");
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
