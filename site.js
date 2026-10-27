(function () {
  var nav = document.querySelector("[data-nav]");
  if (nav) {
    var toggle = nav.querySelector("[data-nav-toggle]");
    function onScroll() {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.textContent = open ? "Close" : "Menu";
      });
      nav.querySelectorAll(".nav-links a").forEach(function (link) {
        link.addEventListener("click", function () {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.textContent = "Menu";
        });
      });
    }
  }

  var tabs = document.querySelectorAll("[data-city-tab]");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var id = tab.getAttribute("aria-controls");
      tabs.forEach(function (other) {
        var on = other === tab;
        other.setAttribute("aria-selected", on ? "true" : "false");
        var panel = document.getElementById(other.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      var panel = document.getElementById(id);
      if (panel) panel.hidden = false;
    });
  });

  var form = document.getElementById("inviteForm");
  if (!form) return;

  var cityForms = {
    delhi: "https://forms.gle/zVchUBLogxfGeH5g6",
    bombay: "https://forms.gle/Am7Z96A1Ur1ZHF2X6",
    london: "https://docs.google.com/forms/d/e/1FAIpQLSdZrsP5Gd6toGWuQ10uEYVDx4f6BnMFgIyjZlvAX9X7suuwQA/viewform",
    bengaluru: "https://docs.google.com/forms/d/e/1FAIpQLSeOmRzh8oDVehdVauDcbmUsJTYla-mTBYo_91mjRAtQsW8XYw/viewform?usp=send_form",
    hyderabad: "https://forms.gle/maV5MoNA5wGTWkjZ9",
    dubai: "https://forms.gle/59dfvTV3jtLq1ws26"
  };

  var step1 = document.getElementById("step1");
  var step2 = document.getElementById("step2");
  var dot1 = document.getElementById("dot1");
  var dot2 = document.getElementById("dot2");
  var know = document.getElementById("knowGuest");
  var guestWrap = document.getElementById("guestWrap");
  var guestName = document.getElementById("guestName");
  var editionCity = document.getElementById("editionCity");
  var handoff = document.getElementById("handoff");
  var note = document.getElementById("formNote");

  function mark(field, bad) {
    field.classList.toggle("is-invalid", bad);
  }

  function step1Valid() {
    var ok = true;
    ["fullName", "email", "phone", "homeCity", "social", "about"].forEach(function (id) {
      var input = document.getElementById(id);
      var bad = !input.value.trim();
      if (id === "email" && input.value && !input.checkValidity()) bad = true;
      mark(input.closest(".field"), bad);
      if (bad) ok = false;
    });
    var knowBad = !know.value;
    mark(know.closest(".field"), knowBad);
    if (knowBad) ok = false;
    if (know.value === "yes") {
      var nameBad = !guestName.value.trim();
      mark(guestWrap, nameBad);
      if (nameBad) ok = false;
    } else {
      mark(guestWrap, false);
    }
    return ok;
  }

  know.addEventListener("change", function () {
    var yes = know.value === "yes";
    guestWrap.hidden = !yes;
    guestName.required = yes;
    if (!yes) guestName.value = "";
  });

  document.getElementById("toStep2").addEventListener("click", function () {
    if (!step1Valid()) return;
    step1.hidden = true;
    step2.hidden = false;
    dot1.classList.remove("is-on");
    dot2.classList.add("is-on");
    editionCity.focus();
  });

  document.getElementById("toStep1").addEventListener("click", function () {
    step2.hidden = true;
    step1.hidden = false;
    dot2.classList.remove("is-on");
    dot1.classList.add("is-on");
  });

  function syncHandoff() {
    var url = cityForms[editionCity.value] || "";
    var edition = document.getElementById("edition").value;
    var ready = !!url && !!edition;
    if (ready) handoff.setAttribute("href", url);
    else handoff.setAttribute("href", "#");
    handoff.setAttribute("aria-disabled", ready ? "false" : "true");
  }

  editionCity.addEventListener("change", syncHandoff);
  document.getElementById("edition").addEventListener("change", syncHandoff);

  handoff.addEventListener("click", function (event) {
    var url = cityForms[editionCity.value];
    var edition = document.getElementById("edition").value;
    if (!url || !edition) {
      event.preventDefault();
      mark(editionCity.closest(".field"), !url);
      mark(document.getElementById("edition").closest(".field"), !edition);
      return;
    }
    note.textContent = "The form for this evening is open. Finish it there.";
  });

  if (new URLSearchParams(location.search).get("invite") === "1") {
    var target = document.getElementById("invitation");
    if (target) target.scrollIntoView();
    var name = document.getElementById("fullName");
    if (name) name.focus();
  }
})();
