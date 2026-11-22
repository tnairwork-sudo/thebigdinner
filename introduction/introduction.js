(function () {
  var form = document.getElementById("ask");
  var wait = document.getElementById("wait");
  var waitLine = document.getElementById("waitLine");
  var result = document.getElementById("result");
  var error = document.getElementById("error");
  var sampleNote = document.getElementById("sampleNote");
  var trial = document.getElementById("trial");
  var again = document.getElementById("again");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var trialGuest = null;
  var busy = false;

  function show(node, on) {
    if (on) node.removeAttribute("hidden");
    else node.setAttribute("hidden", "");
  }

  function say(message) {
    error.textContent = message || "";
    show(error, Boolean(message));
  }

  function clearResult() {
    show(result, false);
    result.classList.remove("is-in");
    document.getElementById("resultName").textContent = "";
    document.getElementById("resultMeta").textContent = "";
    document.getElementById("resultReason").textContent = "";
    document.getElementById("resultLinks").replaceChildren();
  }

  function link(href, label) {
    if (!href) return null;
    var anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = label;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    return anchor;
  }

  function paint(recommendation) {
    var name = document.getElementById("resultName");
    var meta = document.getElementById("resultMeta");
    var reason = document.getElementById("resultReason");
    var links = document.getElementById("resultLinks");
    name.textContent = recommendation.name || "";
    var bits = [];
    if (recommendation.city) bits.push(recommendation.city);
    if (recommendation.occupation) bits.push(recommendation.occupation.replace(/\.$/, ""));
    meta.textContent = bits.join(" · ");
    reason.textContent = recommendation.reason || "";
    links.replaceChildren();
    var linkedin = link(recommendation.linkedin, "LinkedIn");
    var instagram = link(recommendation.instagram, "Instagram");
    if (linkedin) links.appendChild(linkedin);
    if (instagram) links.appendChild(instagram);
    show(links, Boolean(linkedin || instagram));
    show(result, true);
    result.classList.add("is-in");
    name.focus();
  }

  fetch("/api/introduction", { headers: { accept: "application/json" } })
    .then(function (response) { return response.json(); })
    .then(function (body) {
      if (!body || body.source !== "sample") return;
      show(sampleNote, true);
      trialGuest = body.trial || null;
      if (trialGuest && trialGuest.name) show(trial, true);
    })
    .catch(function () {});

  if (trial) {
    trial.addEventListener("click", function () {
      if (!trialGuest) return;
      document.getElementById("name").value = trialGuest.name || "";
      document.getElementById("email").value = trialGuest.email || "";
      document.getElementById("phone").value = trialGuest.phone || "";
      document.getElementById("focus").focus();
    });
  }

  again.addEventListener("click", function () {
    clearResult();
    show(form, true);
    say("");
    document.getElementById("name").focus();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy) return;
    say("");
    clearResult();
    var payload = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      phone: document.getElementById("phone").value,
      focus: document.getElementById("focus").value,
      care: document.getElementById("care").value
    };
    if (!payload.name.trim() || (!payload.email.trim() && !payload.phone.trim())) {
      say("Give a name, and an email or a phone.");
      return;
    }
    busy = true;
    form.querySelector(".intro-ask").disabled = true;
    show(form, false);
    waitLine.textContent = "The room is choosing.";
    show(wait, true);
    var delay = reduce ? 0 : 1600;
    if (!reduce) {
      window.setTimeout(function () {
        if (!wait.hasAttribute("hidden")) waitLine.textContent = "Not the familiar name.";
      }, 700);
    }
    var request = fetch("/api/introduction", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().then(function (body) {
        return { status: response.status, body: body };
      });
    });
    Promise.all([request, new Promise(function (resolve) { window.setTimeout(resolve, delay); })])
      .then(function (parts) {
        var status = parts[0].status;
        var body = parts[0].body || {};
        show(wait, false);
        show(form, true);
        if (body.ok && body.recommendation && body.recommendation.name) {
          show(form, false);
          paint(body.recommendation);
          return;
        }
        if (body.error === "missing") {
          say("Give a name, and an email or a phone.");
          return;
        }
        if (body.error === "unrecognised") {
          say("The room does not recognise that pairing. No one else is shown.");
          return;
        }
        if (status === 429 || body.error === "quiet") {
          say("The room is quiet just now. Try again in a moment.");
          return;
        }
        say("The room is quiet just now. Try again in a moment.");
      })
      .catch(function () {
        show(wait, false);
        show(form, true);
        say("The room is quiet just now. Try again in a moment.");
      })
      .then(function () {
        busy = false;
        form.querySelector(".intro-ask").disabled = false;
      });
  });
})();
