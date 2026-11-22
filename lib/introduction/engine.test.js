const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  BANNED,
  PUBLIC_KEYS,
  SAMPLE_MEMBERS,
  buildMembers,
  classify,
  extractLinks,
  normPhone,
  parseCsv,
  recommendFor,
  verify
} = require("./engine");

const root = path.join(__dirname, "..", "..");

function byId(id) {
  return SAMPLE_MEMBERS.find((member) => member.id === id);
}

test("phone numbers normalise to the last ten digits", () => {
  assert.equal(normPhone("+91 90000 00001"), "9000000001");
  assert.equal(normPhone("09000000001"), "9000000001");
  assert.equal(normPhone("12345"), "");
});

test("csv keeps a quoted essay on one field", () => {
  const rows = parseCsv('name,note\n"Ada Marlowe","A line.\nStill the same field."\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], "A line.\nStill the same field.");
});

test("headers recognise an allowlist, a form, and a tracker", () => {
  assert.equal(classify(["name", "phone", "city", "month", "group"]), "allowlist");
  assert.equal(classify(["city", "name", "email", "phone", "occupation", "status"]), "tracker");
  assert.equal(classify(["Your Name", "Email Address", "What accomplishment are you most proud of"]), "form");
});

test("links keep linkedin and instagram, and skip an email", () => {
  const links = extractLinks("https://www.linkedin.com/in/ada-marlowe-example?trk=public and @farid.example");
  assert.equal(links.linkedin, "https://www.linkedin.com/in/ada-marlowe-example");
  assert.equal(links.instagram, "https://instagram.com/farid.example");
  const email = extractLinks("ada.marlowe@example.com");
  assert.equal(email.linkedin, "");
  assert.equal(email.instagram, "");
});

test("a fictional guest receives someone else", () => {
  const ada = byId("sample-ada");
  const result = recommendFor(SAMPLE_MEMBERS, {
    name: ada.displayName,
    email: ada.emails[0],
    phone: "",
    focus: "I draw quiet public rooms",
    care: "I care about patience more than scale"
  });
  assert.equal(result.ok, true);
  assert.notEqual(result.recommendation.name, "Ada Marlowe");
  assert.notEqual(result.recommendation.name, "Kabir Sen");
  assert.deepEqual(Object.keys(result.recommendation).sort(), [...PUBLIC_KEYS].sort());
  assert.match(result.recommendation.reason, /ordinary life/i);
  assert.doesNotMatch(result.recommendation.reason, BANNED);
  const again = recommendFor(SAMPLE_MEMBERS, {
    name: "Ada Marlowe",
    email: "ada.marlowe@example.com",
    focus: "I draw quiet public rooms",
    care: "I care about patience more than scale"
  });
  assert.equal(again.recommendation.name, result.recommendation.name);
});

test("every fictional guest gets one other person, with no contact details", () => {
  SAMPLE_MEMBERS.forEach((member) => {
    const result = recommendFor(SAMPLE_MEMBERS, { name: member.displayName, phone: member.phones[0] });
    assert.equal(result.ok, true, member.id);
    assert.notEqual(normName(result.recommendation.name), member.names[0]);
    const text = JSON.stringify(result.recommendation);
    assert.doesNotMatch(text, /@/);
    assert.doesNotMatch(text, /90000000/);
    assert.doesNotMatch(result.recommendation.reason, BANNED);
    PUBLIC_KEYS.forEach((key) => assert.equal(typeof result.recommendation[key], "string"));
  });
});

test("a wrong pairing reveals nobody", () => {
  const wrong = recommendFor(SAMPLE_MEMBERS, { name: "Ada Marlowe", phone: "9000000099" });
  assert.deepEqual(wrong, { ok: false, error: "unrecognised" });
  const stranger = recommendFor(SAMPLE_MEMBERS, { name: "Nobody Guest", email: "nobody@example.com" });
  assert.equal(stranger.ok, false);
  const missing = recommendFor(SAMPLE_MEMBERS, { name: "Ada Marlowe" });
  assert.equal(missing.error, "missing");
});

test("a shared name is separated by phone and email", () => {
  const delhi = verify(SAMPLE_MEMBERS, { name: "Samir Cole", phone: "9000000009" });
  const bombay = verify(SAMPLE_MEMBERS, { name: "Samir Cole", email: "samir.cole.bombay@example.com" });
  assert.equal(delhi.member.id, "sample-samir-capital");
  assert.equal(bombay.member.id, "sample-samir-poet");
  const clash = verify(SAMPLE_MEMBERS, {
    name: "Samir Cole",
    phone: "9000000009",
    email: "samir.cole.bombay@example.com"
  });
  assert.equal(clash.member, null);
  const delhiIntro = recommendFor(SAMPLE_MEMBERS, { name: "Samir Cole", phone: "9000000009" });
  const bombayIntro = recommendFor(SAMPLE_MEMBERS, { name: "Samir Cole", phone: "9000000010" });
  assert.notEqual(delhiIntro.recommendation.name, "Samir Cole");
  assert.notEqual(bombayIntro.recommendation.name, "Samir Cole");
  assert.notEqual(delhiIntro.recommendation.name, bombayIntro.recommendation.name);
});

test("only attendees are members, and essays stay off the page", () => {
  const allow = [
    { name: "Ada Marlowe", phone: "9000000001", city: "Bombay", month: "March 2026", group: "March" },
    { name: "Rohan Vale", phone: "9000000002", city: "Delhi", month: "January 2026", group: "January" }
  ];
  const forms = [
    {
      name: "Ada Marlowe",
      email: "ada.marlowe@example.com",
      phone: "9000000001",
      occupation: "Architect of small public libraries",
      links: "https://www.linkedin.com/in/ada-marlowe-example",
      principle: "A room should lower the voice.",
      conversation: "A watchman spoke about care.",
      proud: "A reading room."
    },
    {
      name: "Zoe Applicant",
      email: "zoe.applicant@example.com",
      phone: "9000000088",
      occupation: "Poet",
      links: "",
      principle: "Only an application, not an evening.",
      conversation: "This person never attended.",
      proud: "Stayed home."
    }
  ];
  const members = buildMembers(allow, forms, []);
  assert.equal(members.length, 2);
  assert.equal(verify(members, { name: "Zoe Applicant", email: "zoe.applicant@example.com" }).member, null);
  const intro = recommendFor(members, { name: "Ada Marlowe", email: "ada.marlowe@example.com" });
  assert.equal(intro.recommendation.name, "Rohan Vale");
  assert.doesNotMatch(intro.recommendation.reason, /never attended/i);
});

test("a long essay is not copied onto the page", () => {
  const essay = `Doubt is a form of respect. ${"The middle of the essay stays private and should not travel. ".repeat(12)}`;
  const members = buildMembers(
    [
      { name: "Ada Marlowe", phone: "9000000001", city: "Bombay", month: "March", group: "" },
      { name: "Meera Qureshi", phone: "9000000003", city: "Hyderabad", month: "November", group: "" }
    ],
    [
      {
        name: "Meera Qureshi",
        email: "meera.qureshi@example.com",
        phone: "9000000003",
        occupation: "Criminal defence counsel. Also wrote 9000000099 in passing.",
        links: "@meera.example",
        principle: essay,
        conversation: "",
        proud: ""
      }
    ],
    []
  );
  const intro = recommendFor(members, { name: "Ada Marlowe", phone: "9000000001", care: "patience" });
  assert.equal(intro.ok, true);
  assert.equal(intro.recommendation.name, "Meera Qureshi");
  assert.doesNotMatch(intro.recommendation.reason, /middle of the essay/);
  assert.doesNotMatch(JSON.stringify(intro.recommendation), /9000000099/);
  assert.equal(intro.recommendation.instagram, "https://instagram.com/meera.example");
});

test("two people on one phone stay distinct", () => {
  const members = buildMembers([
    { name: "Priya Sharma", phone: "9000000021", city: "Delhi", month: "May", group: "May" },
    { name: "Amit Sharma", phone: "9000000021", city: "Delhi", month: "May", group: "May" },
    { name: "Leela Voss", phone: "9000000005", city: "Bombay", month: "August", group: "August" }
  ], [], []);
  assert.equal(members.length, 3);
  const priya = verify(members, { name: "Priya Sharma", phone: "9000000021" });
  const amit = verify(members, { name: "Amit Sharma", phone: "9000000021" });
  assert.notEqual(priya.member.id, amit.member.id);
  assert.equal(verify(members, { name: "Someone Sharma", phone: "9000000021" }).member, null);
});

test("the page script does not carry the room", () => {
  const client = fs.readFileSync(path.join(root, "introduction", "introduction.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "introduction", "index.html"), "utf8");
  assert.doesNotMatch(client, /example\.com|90000000|Marlowe|Qureshi/);
  assert.doesNotMatch(html, /example\.com|90000000|Marlowe|Qureshi/);
  assert.doesNotMatch(`${client}\n${html}`, BANNED);
});

function normName(value) {
  return String(value || "").toLowerCase();
}
