// The Introduction
//
// Members are people who have attended a dinner (the allowlist).
// Form answers enrich them. People who only applied are not members
// and are never recommended.
//
// Private data, for a real match:
//   Set MEMBERS_CSV_DIR to a folder of CSVs that is not in git, or place
//   those CSVs in data/private/ (gitignored). The folder is read in this
//   process at runtime and never written back.
//   Expected files are detected by their headers, not by filename:
//     allowlist: name, phone, city, month
//     forms: occupation, a principle or an accomplishment, email, phone
//     tracker: name, email, phone, occupation, status
//   Phones and emails stay in memory for the match. They are not stored
//   in any committed file, and the browser receives one recommendation
//   with no phone and no email.
//
// Public preview, when that folder is absent:
//   lib/introduction/sample.js, a fictional room labelled as a sample.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { SAMPLE_MEMBERS, sampleTrial } = require("./sample");

const PUBLIC_KEYS = ["name", "city", "occupation", "linkedin", "instagram", "reason"];
const BANNED = /\b(tables?|apply|founders|seated|seat|prices|taj)\b|five[\s-]*star|[\u2012\u2013\u2014\u2015]/i;

const DOMAIN_RULES = [
  ["medicine", /\b(doctor|surgeon|physician|cardiolog|neurolog|hospital|clinic|pharma|nurs(?:e|ing)|dentist|ayurved|therapist|psycholog|paediatric|pediatric)\b/i],
  ["law", /\b(lawyer|advocate|legal|counsel|barrister|solicitor|judge|attorney|defence|defense)\b/i],
  ["capital", /\b(invest(?:or|ing|ment)?|venture|equity|\bfund\b|banker|banking|finance|financier|wealth|trader|capital)\b/i],
  ["technology", /\b(engineer|software|developer|product|\bdata\b|machine learning|\bai\b|\bcto\b|programmer|cyber)\b/i],
  ["research", /\b(professor|academic|\bphd\b|scientist|research|scholar|faculty|climate)\b/i],
  ["public life", /\b(policy|government|diplomat|civil service|ministry|parliament)\b/i],
  ["media", /\b(journal(?:ist|ism)?|editor|media|podcast|broadcast|columnist)\b/i],
  ["art", /\b(artists?|designers?|architects?|films?|music|composers?|writers?|authors?|poets?|creative|curators?|photographers?|actors?|ceramicists?|ceramists?|potters?)\b/i],
  ["food", /\b(chef|restaurant|culinary|hospitality|hotel)\b/i],
  ["systems", /\b(logistics|supply|operations|shipping|infrastructure|cargo|harbour|harbor)\b/i],
  ["land", /\b(real estate|property|construction)\b/i],
  ["social", /\b(nonprofit|non-profit|\bngo\b|foundation|philanthrop)\b/i],
  ["company", /\b(entrepreneur|startup|company|operator|\bfounder\b)\b/i]
];

const DOMAIN_PHRASE = {
  medicine: "medicine",
  law: "the law",
  capital: "capital and markets",
  technology: "technology",
  research: "research",
  "public life": "public life",
  media: "editing and the press",
  art: "form and making",
  food: "food and the house",
  systems: "routes and distance",
  land: "land and buildings",
  social: "work done for other people",
  company: "building a company"
};

const THEME_RULES = [
  ["time", /\b(patience|\bslow\b|decade|legacy|long view)\b/i],
  ["doubt", /\b(doubt|uncertain|humility|not knowing)\b/i],
  ["ambition", /\b(ambition|\bscale\b|growth|hustle)\b/i],
  ["care", /\b(kindness|tenderness|\bfamily\b|children|service)\b/i],
  ["craft", /\b(craft|beauty|discipline|practice|making)\b/i],
  ["justice", /\b(justice|fairness|\brights\b|dignity|believed)\b/i],
  ["money", /\b(money|profit|market|wealth|liquidity|capital)\b/i]
];

const CONTRASTS = [
  ["ambition", "doubt"],
  ["ambition", "time"],
  ["money", "craft"],
  ["money", "care"],
  ["justice", "ambition"],
  ["craft", "ambition"],
  ["time", "ambition"]
];

function cleanRaw(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function scrub(value) {
  return cleanRaw(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, ",")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){10,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normName(value) {
  let name = cleanRaw(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  name = name.replace(/[^a-z\s]/g, " ");
  name = name.replace(/\b(mr|mrs|ms|dr|prof)\b/g, " ");
  return name.replace(/\s+/g, " ").trim();
}

function normPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.length === 10 ? digits : "";
}

function normEmail(value) {
  const email = cleanRaw(value).toLowerCase().replace(/^mailto:/, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  if (email.endsWith("@example.com") || email.endsWith("@example.test")) return email;
  return email;
}

function tokens(name) {
  return normName(name).split(" ").filter((part) => part.length > 1);
}

function samePerson(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const left = tokens(a);
  const right = tokens(b);
  if (!left.length || !right.length) return false;
  const rightSet = new Set(right);
  const leftSet = new Set(left);
  const overlap = left.filter((part) => rightSet.has(part));
  return overlap.length === left.length || overlap.length === rightSet.size && right.every((part) => leftSet.has(part));
}

function nameOk(member, name) {
  if (!name) return false;
  return member.names.some((known) => {
    if (known === name || samePerson(known, name)) return true;
    const knownFirst = known.split(" ")[0];
    const givenFirst = name.split(" ")[0];
    return knownFirst.length > 2 && knownFirst === givenFirst;
  });
}

function soften(name) {
  const letters = name.replace(/[^A-Za-z]/g, "");
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    return name.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }
  return name;
}

function chooseDisplay(rawNames) {
  const counts = new Map();
  rawNames.forEach((raw) => {
    const trimmed = cleanRaw(raw);
    if (!normName(trimmed)) return;
    counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
  });
  const options = [...counts.entries()];
  options.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const width = b[0].split(" ").length - a[0].split(" ").length;
    if (width) return width;
    return b[0].length - a[0].length;
  });
  return options.length ? soften(options[0][0]) : "";
}

function mode(values) {
  const counts = new Map();
  values.forEach((value) => {
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  let best = "";
  let score = 0;
  counts.forEach((count, value) => {
    if (count > score) {
      best = value;
      score = count;
    }
  });
  return best;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char !== "\r") field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cleanRaw(cell)));
}

function headerIndex(headers, pattern) {
  return headers.findIndex((header) => pattern.test(header.toLowerCase()));
}

function cell(headers, row, pattern) {
  const index = headerIndex(headers, pattern);
  if (index < 0 || index >= row.length) return "";
  return cleanRaw(row[index]);
}

function classify(headers) {
  const joined = headers.map((header) => header.toLowerCase().replace(/\s+/g, " ")).join(" | ");
  const has = (pattern) => headers.some((header) => pattern.test(header.toLowerCase()));
  if (has(/^name$/) && has(/^phone$/) && has(/^city$/) && has(/^month$/)) return "allowlist";
  if (has(/^name$/) && has(/occupation/) && has(/status/) && has(/email/)) return "tracker";
  if (has(/proud|accomplishment|guiding principle|guiding_principle|conversation/)) return "form";
  if (/occupation/.test(joined) && /email/.test(joined) && /name/.test(joined)) return "form";
  return "unknown";
}

function mapAllow(headers, row) {
  return {
    name: cell(headers, row, /^name$/),
    phone: cell(headers, row, /^phone$/),
    city: cell(headers, row, /^city$/),
    month: cell(headers, row, /^month$/),
    group: cell(headers, row, /^group$/)
  };
}

function mapForm(headers, row) {
  return {
    name: cell(headers, row, /your name|^name$/),
    email: cell(headers, row, /email/),
    phone: cell(headers, row, /contact number|^phone$/),
    occupation: cell(headers, row, /occupation|focus/),
    links: cell(headers, row, /linkedin|instagram/),
    proud: cell(headers, row, /proud|accomplishment/),
    conversation: cell(headers, row, /conversation/),
    principle: cell(headers, row, /principle|single idea/)
  };
}

function mapTracker(headers, row) {
  return {
    name: cell(headers, row, /^name$/),
    email: cell(headers, row, /email/),
    phone: cell(headers, row, /^phone$/),
    occupation: cell(headers, row, /occupation/),
    city: cell(headers, row, /^city$/)
  };
}

function toHttps(url) {
  const trimmed = url.replace(/[),.;]+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, "")}`;
}

function safeSocial(url, hostPart) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (!parsed.hostname.toLowerCase().includes(hostPart)) return "";
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function extractLinks(text) {
  const raw = String(text || "");
  const found = [];
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  const bareRe = /(?:www\.)?(?:linkedin\.com|instagram\.com|instagr\.am)\/[^\s<>"']+/gi;
  let match;
  while ((match = urlRe.exec(raw))) found.push(match[0]);
  while ((match = bareRe.exec(raw))) found.push(match[0]);
  let linkedin = "";
  let instagram = "";
  found.forEach((item) => {
    const url = toHttps(item);
    if (/linkedin\.com/i.test(url) && !linkedin) linkedin = safeSocial(url, "linkedin");
    if (/(instagram\.com|instagr\.am)/i.test(url) && !instagram) instagram = safeSocial(url, "instagram");
  });
  if (!instagram) {
    const withoutEmails = raw.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ");
    const handles = withoutEmails.match(/@([A-Za-z0-9._]{2,30})/g) || [];
    handles.forEach((handle) => {
      if (instagram) return;
      const name = handle.slice(1).replace(/\.+$/, "");
      if (!name || /\.(com|net|org|in|co)$/i.test(name)) return;
      instagram = safeSocial(`https://instagram.com/${name}`, "instagram");
    });
  }
  return { linkedin, instagram };
}

function takeAttendance(member, row) {
  const name = normName(row.name);
  if (name && !member.names.includes(name)) member.names.push(name);
  if (cleanRaw(row.name)) {
    const next = chooseDisplay([member.displayName, cleanRaw(row.name)].filter(Boolean));
    if (next) member.displayName = next;
  }
  const city = cleanRaw(row.city);
  const month = cleanRaw(row.month);
  if (city) member.cityBag.push(city);
  if (month && !member.months.includes(month)) member.months.push(month);
  if ((month || city) && !member.editionKeys.includes(`${month}||${city}`)) {
    member.editionKeys.push(`${month}||${city}`);
  }
  const group = cleanRaw(row.group);
  if (group && !member.editionKeys.includes(`group||${group}`)) member.editionKeys.push(`group||${group}`);
}

function emptyMember(rows, phones) {
  const member = {
    id: "",
    displayName: "",
    names: [],
    phones: unique(phones.map(normPhone)),
    emails: [],
    cities: [],
    cityBag: [],
    months: [],
    editionKeys: [],
    occupation: "",
    principle: "",
    conversation: "",
    proud: "",
    linkedin: "",
    instagram: ""
  };
  rows.forEach((row) => takeAttendance(member, row));
  return member;
}

function clusterRows(rows) {
  const parent = rows.map((_, index) => index);
  function find(index) {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]];
      cursor = parent[cursor];
    }
    return cursor;
  }
  function unite(left, right) {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  }
  const named = [];
  rows.forEach((row, index) => {
    const name = normName(row.name);
    if (name) named.push({ index, name });
  });
  for (let i = 0; i < named.length; i += 1) {
    for (let j = i + 1; j < named.length; j += 1) {
      if (samePerson(named[i].name, named[j].name)) unite(named[i].index, named[j].index);
    }
  }
  const groups = new Map();
  rows.forEach((row, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(row);
  });
  const clusters = [...groups.values()];
  const namedClusters = clusters.filter((group) => group.some((row) => normName(row.name)));
  const unnamed = clusters.filter((group) => group.every((row) => !normName(row.name)));
  if (namedClusters.length === 1) return [namedClusters[0].concat(...unnamed)];
  return namedClusters;
}

function absorbRow(member, row) {
  takeAttendance(member, row);
}

function addProfile(member, record, preferEssay) {
  const email = normEmail(record.email);
  if (email && !member.emails.includes(email)) member.emails.push(email);
  const occupation = scrub(record.occupation);
  if (occupation && (!member.occupation || occupation.length > member.occupation.length)) {
    member.occupation = occupation;
  }
  const incoming = scrub(record.principle).length + scrub(record.conversation).length;
  const current = scrub(member.principle).length + scrub(member.conversation).length;
  if (incoming && (preferEssay || incoming > current)) {
    member.principle = scrub(record.principle);
    member.conversation = scrub(record.conversation);
    member.proud = scrub(record.proud);
  }
  const links = extractLinks(record.links);
  if (links.linkedin && !member.linkedin) member.linkedin = links.linkedin;
  if (links.instagram && !member.instagram) member.instagram = links.instagram;
}

function indexPush(map, key, member) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  const list = map.get(key);
  if (!list.includes(member)) list.push(member);
}

function attachRecords(members, records, preferEssay) {
  const byPhone = new Map();
  const byEmail = new Map();
  const byName = new Map();
  members.forEach((member) => {
    member.phones.forEach((phone) => indexPush(byPhone, phone, member));
    member.emails.forEach((email) => indexPush(byEmail, email, member));
    member.names.forEach((name) => indexPush(byName, name, member));
  });
  const pending = [];
  records.forEach((record) => {
    const phone = normPhone(record.phone);
    const email = normEmail(record.email);
    const name = normName(record.name);
    const phoneHits = phone ? (byPhone.get(phone) || []) : [];
    let target = null;
    if (phoneHits.length === 1) target = phoneHits[0];
    else if (phoneHits.length > 1 && name) {
      const named = phoneHits.filter((member) => nameOk(member, name));
      if (named.length === 1) target = named[0];
    }
    if (target) {
      addProfile(target, record, preferEssay);
      if (email) indexPush(byEmail, email, target);
      return;
    }
    pending.push(record);
  });
  pending.forEach((record) => {
    const phone = normPhone(record.phone);
    const email = normEmail(record.email);
    const name = normName(record.name);
    if (email && byEmail.has(email) && byEmail.get(email).length === 1) {
      addProfile(byEmail.get(email)[0], record, preferEssay);
      return;
    }
    if (!name || tokens(name).length < 2) return;
    const hits = byName.get(name) || [];
    if (hits.length !== 1) return;
    const member = hits[0];
    if (phone && member.phones.length && !member.phones.includes(phone)) return;
    if (email && member.emails.length && !member.emails.includes(email)) return;
    if (phone && byPhone.has(phone) && !byPhone.get(phone).includes(member)) return;
    addProfile(member, record, preferEssay);
    if (email) indexPush(byEmail, email, member);
    if (phone && !member.phones.includes(phone) && !(byPhone.get(phone) || []).length) {
      member.phones.push(phone);
      indexPush(byPhone, phone, member);
    }
  });
}

function finishMember(member, index, seen) {
  const primary = mode(member.cityBag || []);
  member.cities = unique([primary, ...(member.cityBag || [])]);
  delete member.cityBag;
  let id = crypto.createHash("sha256")
    .update(["introduction", member.phones.slice().sort().join(","), member.names.slice().sort().join("|"), String(index)].join("\n"))
    .digest("hex")
    .slice(0, 16);
  while (seen.has(id)) id = `${id}${index}`;
  seen.add(id);
  member.id = id;
  return member;
}

function assignIds(members) {
  const seen = new Set();
  return members
    .filter((member) => member.displayName && member.names.length)
    .map((member, index) => finishMember(member, index, seen));
}

function buildMembers(allowRows, formRows, trackerRows) {
  const byPhone = new Map();
  const noPhone = [];
  allowRows.forEach((row) => {
    const phone = normPhone(row.phone);
    const name = normName(row.name);
    if (!phone && !name) return;
    if (!phone) {
      noPhone.push(row);
      return;
    }
    if (!byPhone.has(phone)) byPhone.set(phone, []);
    byPhone.get(phone).push(row);
  });
  const members = [];
  byPhone.forEach((rows, phone) => {
    clusterRows(rows).forEach((group) => {
      const member = emptyMember(group, [phone]);
      if (member.displayName) members.push(member);
    });
  });
  const loose = [];
  noPhone.forEach((row) => {
    const name = normName(row.name);
    if (!name) return;
    const exact = members.filter((member) => member.names.includes(name));
    const soft = members.filter((member) => member.names.some((known) => samePerson(known, name)));
    if (exact.length === 1) absorbRow(exact[0], row);
    else if (exact.length === 0 && soft.length === 1) absorbRow(soft[0], row);
    else if (exact.length === 0 && soft.length === 0) loose.push(row);
  });
  const looseGroups = new Map();
  loose.forEach((row) => {
    const name = normName(row.name);
    if (!looseGroups.has(name)) looseGroups.set(name, []);
    looseGroups.get(name).push(row);
  });
  looseGroups.forEach((rows) => {
    const member = emptyMember(rows, []);
    if (member.displayName) members.push(member);
  });
  attachRecords(members, trackerRows || [], false);
  attachRecords(members, formRows || [], true);
  return assignIds(members);
}

function clip(value, max) {
  const clean = scrub(value);
  if (!clean) return "";
  const sentence = clean.split(/(?<=[.!?])\s+/)[0];
  let out = sentence;
  if (out.length > max) {
    out = out.slice(0, max);
    const cut = out.lastIndexOf(" ");
    if (cut > 40) out = out.slice(0, cut);
    out = out.replace(/[,:;]+$/, "");
  }
  if (out && !/[.!?]$/.test(out)) out += ".";
  return out;
}

function usable(value, max) {
  const text = clip(value, max);
  if (!text || BANNED.test(text)) return "";
  return text;
}

function phrase(value) {
  return value.replace(/[.]+$/, "");
}

function domainsFrom(text) {
  const found = [];
  DOMAIN_RULES.forEach(([name, pattern]) => {
    if (pattern.test(text) && !found.includes(name)) found.push(name);
  });
  return found;
}

function domainsOf(member) {
  return domainsFrom(`${member.occupation || ""} ${member.focus || ""}`);
}

function themesFrom(text) {
  const found = [];
  THEME_RULES.forEach(([name, pattern]) => {
    if (pattern.test(text) && !found.includes(name)) found.push(name);
  });
  return found;
}

function themesOf(member, includeSelf) {
  const text = [
    member.principle,
    member.conversation,
    member.proud,
    includeSelf ? member.care : "",
    includeSelf ? member.focus : ""
  ].join(" ");
  return themesFrom(text);
}

function shareCity(left, right) {
  return left.cities.some((city) => right.cities.includes(city));
}

function shareEdition(left, right) {
  return left.editionKeys.some((key) => right.editionKeys.includes(key));
}

function shareDomain(left, right) {
  const other = new Set(domainsOf(right));
  return domainsOf(left).some((domain) => other.has(domain));
}

function themeContrast(left, right) {
  const a = new Set(themesOf(left, true));
  const b = new Set(themesOf(right, false));
  return CONTRASTS.some(([one, two]) => (a.has(one) && b.has(two)) || (a.has(two) && b.has(one)));
}

function isSelf(left, right) {
  if (left.id && left.id === right.id) return true;
  if (left.phones.some((phone) => right.phones.includes(phone))) return true;
  if (left.emails.some((email) => right.emails.includes(email))) return true;
  return left.names.some((name) => right.names.some((other) => name === other || samePerson(name, other)));
}

function primaryCity(member) {
  return member.cities[0] || "";
}

function richness(member) {
  return (member.principle ? 3 : 0)
    + (member.conversation ? 2 : 0)
    + (member.occupation ? 2 : 0)
    + (member.linkedin ? 1 : 0)
    + (member.instagram ? 1 : 0)
    + Math.min(4, Math.round((scrub(member.principle).length + scrub(member.conversation).length) / 80));
}

function scorePair(self, other) {
  let score = 1;
  const cityDiff = !shareCity(self, other);
  const leftDomains = domainsOf(self);
  const rightDomains = domainsOf(other);
  const domainDiff = leftDomains.length > 0 && rightDomains.length > 0 && !shareDomain(self, other);
  if (cityDiff) score += 5;
  if (domainDiff) score += 6;
  if (!cityDiff && !domainDiff && leftDomains.length && rightDomains.length) score -= 5;
  if (themeContrast(self, other)) score += 4;
  if (shareEdition(self, other)) score -= 8;
  if (other.principle) score += 3;
  if (other.conversation) score += 2;
  if (other.occupation) score += 2;
  if (other.linkedin || other.instagram) score += 2;
  return score;
}

function chooseOther(members, self) {
  const ranked = [];
  members.forEach((other) => {
    if (!other.displayName || isSelf(self, other)) return;
    ranked.push({
      other,
      score: scorePair(self, other),
      rich: richness(other),
      tie: crypto.createHash("sha256").update(`${self.id}|${other.id}`).digest("hex")
    });
  });
  ranked.sort((a, b) => b.score - a.score || b.rich - a.rich || (a.tie < b.tie ? -1 : 1));
  return ranked.length ? ranked[0].other : null;
}

function workSentence(self) {
  const focus = usable(self.focus, 100);
  if (focus) {
    const body = phrase(focus);
    if (/^i\b/i.test(body)) return `Your days, in your own words: ${body}.`;
    return `You described your days as ${body}.`;
  }
  const domains = domainsOf(self);
  if (!domains.length) return "";
  return `Your days sit with ${DOMAIN_PHRASE[domains[0]]}.`;
}

function writeReason(self, other) {
  const city = primaryCity(other);
  const selfCity = primaryCity(self);
  const principle = usable(other.principle, 150);
  const conversation = usable(other.conversation, 150);
  const care = usable(self.care, 140);
  const lines = [];
  if (care && principle) {
    const body = phrase(care);
    if (/^i\b/i.test(body)) lines.push(`You brought this with you: ${body}.`);
    else lines.push(`You said you care about ${body}.`);
    lines.push(`They hold a different line: ${phrase(principle)}.`);
  } else if (conversation) {
    lines.push(`A conversation changed how they think. ${conversation}`);
  } else if (principle) {
    lines.push(`A principle guides them: ${phrase(principle)}.`);
  }
  if (usable(self.focus, 100) || !shareDomain(self, other)) {
    const work = workSentence(self);
    if (work) lines.push(work);
  }
  if (selfCity && city && !shareCity(self, other)) {
    lines.push("They keep another city, and ordinary life would not have introduced you.");
  } else if (!shareEdition(self, other)) {
    const month = other.months.find((item) => !self.months.includes(item));
    if (month) lines.push(`They were in the room for ${month}. You were not at that gathering.`);
    else lines.push("You were not at that gathering. Ordinary life would not have introduced you.");
  } else {
    lines.push("The likeness is thin, which is the reason to write.");
  }
  const reason = scrub(lines.join(" "));
  if (!reason || BANNED.test(reason)) {
    return "Ordinary life would not have introduced you. That distance is the reason to write.";
  }
  return reason;
}

function toPublic(other, reason) {
  const payload = {
    name: scrub(other.displayName),
    city: scrub(primaryCity(other)),
    occupation: usable(other.occupation, 160),
    linkedin: other.linkedin || "",
    instagram: other.instagram || "",
    reason: scrub(reason)
  };
  PUBLIC_KEYS.forEach((key) => {
    if (typeof payload[key] !== "string") payload[key] = "";
  });
  const leaked = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(JSON.stringify(payload))
    || /(?:\d[\s-]?){10,}/.test(`${payload.occupation} ${payload.reason} ${payload.name} ${payload.city}`);
  if (leaked || BANNED.test(payload.reason)) {
    payload.occupation = usable(payload.occupation, 160);
    payload.reason = "Ordinary life would not have introduced you. That distance is the reason to write.";
  }
  return payload;
}

function verify(members, input) {
  const name = normName(input.name);
  const email = normEmail(input.email);
  const phone = normPhone(input.phone);
  if (name.length < 2 || (!email && !phone)) return { member: null, error: "missing" };
  const hits = [];
  members.forEach((member) => {
    const phoneHit = Boolean(phone && member.phones.includes(phone));
    const emailHit = Boolean(email && member.emails.includes(email));
    if (phone && email) {
      if (phoneHit && emailHit && nameOk(member, name)) hits.push(member);
      else if (phoneHit && !emailHit && member.emails.length === 0 && nameOk(member, name)) hits.push(member);
      else if (emailHit && !phoneHit && member.phones.length === 0 && nameOk(member, name)) hits.push(member);
      return;
    }
    if ((phoneHit || emailHit) && nameOk(member, name)) hits.push(member);
  });
  if (hits.length === 1) return { member: hits[0], error: null };
  const exact = hits.filter((member) => member.names.includes(name));
  if (exact.length === 1) return { member: exact[0], error: null };
  return { member: null, error: "unrecognised" };
}

function decorate(member, input) {
  return {
    ...member,
    names: member.names.slice(),
    phones: member.phones.slice(),
    emails: member.emails.slice(),
    cities: member.cities.slice(),
    months: member.months.slice(),
    editionKeys: member.editionKeys.slice(),
    focus: scrub(input.focus || "").slice(0, 280),
    care: scrub(input.care || "").slice(0, 280)
  };
}

function recommendFor(members, input) {
  const verdict = verify(members, input);
  if (!verdict.member) return { ok: false, error: verdict.error };
  const self = decorate(verdict.member, input);
  const other = chooseOther(members, self);
  if (!other) return { ok: false, error: "unrecognised" };
  const recommendation = toPublic(other, writeReason(self, other));
  if (!recommendation.name || recommendation.name === self.displayName && isSelf(self, other)) {
    return { ok: false, error: "unrecognised" };
  }
  return { ok: true, recommendation };
}

function readSources(dir) {
  const names = fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".csv"));
  const allow = [];
  const forms = [];
  const tracker = [];
  names.forEach((name) => {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    const grid = parseCsv(text);
    if (!grid.length) return;
    const headers = grid[0].map((header) => cleanRaw(header));
    const kind = classify(headers);
    grid.slice(1).forEach((row) => {
      if (kind === "allowlist") allow.push(mapAllow(headers, row));
      else if (kind === "form") forms.push(mapForm(headers, row));
      else if (kind === "tracker") tracker.push(mapTracker(headers, row));
    });
  });
  return { allow, forms, tracker };
}

function dirHasAllowlist(dir) {
  try {
    const sources = readSources(dir);
    return sources.allow.length > 0;
  } catch (error) {
    return false;
  }
}

function privateDir() {
  const candidates = [];
  if (process.env.MEMBERS_CSV_DIR) candidates.push(process.env.MEMBERS_CSV_DIR);
  else candidates.push(path.join(process.cwd(), "data", "private"));
  for (let i = 0; i < candidates.length; i += 1) {
    if (dirHasAllowlist(candidates[i])) return candidates[i];
  }
  if (process.env.MEMBERS_CSV_DIR) {
    const error = new Error("private room unavailable");
    error.code = "PRIVATE_UNAVAILABLE";
    throw error;
  }
  return null;
}

let cached = null;

function loadRoom() {
  if (cached) return cached;
  const dir = privateDir();
  if (!dir) {
    cached = { source: "sample", members: SAMPLE_MEMBERS.map((member) => ({ ...member })), forms: [] };
    return cached;
  }
  const sources = readSources(dir);
  cached = {
    source: "private",
    members: buildMembers(sources.allow, sources.forms, sources.tracker),
    forms: sources.forms
  };
  return cached;
}

function resetRoomCache() {
  cached = null;
}

const hits = new Map();

function rateLimited(req) {
  const forwarded = cleanRaw(req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"]));
  const key = (forwarded.split(",")[0] || "local").slice(0, 80);
  const now = Date.now();
  const bucket = hits.get(key) || { count: 0, reset: now + 10 * 60 * 1000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 10 * 60 * 1000;
  }
  bucket.count += 1;
  hits.set(key, bucket);
  return bucket.count > 30;
}

function field(value, max) {
  return cleanRaw(value).slice(0, max);
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  if (raw.length > 4000) {
    const error = new Error("too large");
    error.code = "TOO_LARGE";
    throw error;
  }
  return JSON.parse(raw);
}

function jsonResult(status, body) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    },
    body
  };
}

async function handleIntroduction(req) {
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") return jsonResult(405, { ok: false, error: "quiet" });
  let room;
  try {
    room = loadRoom();
  } catch (error) {
    return jsonResult(500, { ok: false, error: "quiet" });
  }
  if (method === "GET") {
    const body = { ok: true, source: room.source };
    if (room.source === "sample") body.trial = sampleTrial();
    return jsonResult(200, body);
  }
  if (rateLimited(req)) return jsonResult(429, { ok: false, error: "quiet", source: room.source });
  let payload;
  try {
    payload = await readBody(req);
  } catch (error) {
    return jsonResult(400, { ok: false, error: "quiet", source: room.source });
  }
  const input = {
    name: field(payload.name, 80),
    email: field(payload.email, 120),
    phone: field(payload.phone, 40),
    focus: field(payload.focus, 280),
    care: field(payload.care, 280)
  };
  const result = recommendFor(room.members, input);
  if (!result.ok) return jsonResult(200, { ok: false, error: result.error, source: room.source });
  const recommendation = {};
  PUBLIC_KEYS.forEach((key) => {
    recommendation[key] = result.recommendation[key] || "";
  });
  return jsonResult(200, { ok: true, source: room.source, recommendation });
}

function auditMembers(members, forms) {
  let phoneAttempts = 0;
  let verifiedPhone = 0;
  let selfMatches = 0;
  let publicLeaks = 0;
  let differentCity = 0;
  let hasLink = 0;
  let hasReason = 0;
  members.forEach((member) => {
    if (!member.phones.length || !member.displayName) return;
    phoneAttempts += 1;
    const result = recommendFor(members, { name: member.displayName, phone: member.phones[0], email: "", focus: "", care: "" });
    if (!result.ok) return;
    verifiedPhone += 1;
    const text = JSON.stringify(result.recommendation);
    const keys = Object.keys(result.recommendation);
    if (keys.length !== PUBLIC_KEYS.length || keys.some((key) => !PUBLIC_KEYS.includes(key))) publicLeaks += 1;
    const named = members.filter((item) => normName(item.displayName) === normName(result.recommendation.name));
    if (named.some((item) => isSelf(member, item))) selfMatches += 1;
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) publicLeaks += 1;
    if (/"phone"|"email"|phones|emails/.test(text)) publicLeaks += 1;
    if (/(?:\d[\s-]?){10,}/.test(`${result.recommendation.occupation} ${result.recommendation.reason}`)) publicLeaks += 1;
    const other = members.find((item) => item.displayName === result.recommendation.name && !isSelf(member, item));
    if (other && !shareCity(member, other)) differentCity += 1;
    if (result.recommendation.linkedin || result.recommendation.instagram) hasLink += 1;
    if ((result.recommendation.reason || "").length > 40) hasReason += 1;
  });
  let emailAttempts = 0;
  let emailVerified = 0;
  members.forEach((member) => {
    if (!member.emails.length || !member.displayName) return;
    if (emailAttempts >= 80) return;
    emailAttempts += 1;
    const result = recommendFor(members, { name: member.displayName, email: member.emails[0], phone: "", focus: "", care: "" });
    if (result.ok) emailVerified += 1;
  });
  const memberPhones = new Set(members.flatMap((member) => member.phones));
  let applicantAttempts = 0;
  let applicantRejected = 0;
  (forms || []).forEach((form) => {
    const phone = normPhone(form.phone);
    if (!phone || memberPhones.has(phone) || !normName(form.name)) return;
    if (applicantAttempts >= 40) return;
    applicantAttempts += 1;
    const result = recommendFor(members, { name: form.name, phone, email: "", focus: "", care: "" });
    if (!result.ok) applicantRejected += 1;
  });
  const byName = new Map();
  members.forEach((member) => {
    member.names.forEach((name) => {
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(member);
    });
  });
  let collisionChecks = 0;
  let collisionOk = 0;
  byName.forEach((group) => {
    const distinct = [];
    group.forEach((member) => {
      if (!distinct.some((item) => item.id === member.id) && member.phones.length) distinct.push(member);
    });
    if (distinct.length < 2) return;
    distinct.slice(0, 2).forEach((member) => {
      collisionChecks += 1;
      const verdict = verify(members, { name: member.displayName, phone: member.phones[0], email: "" });
      if (verdict.member && verdict.member.id === member.id) collisionOk += 1;
    });
  });
  return {
    members: members.length,
    phoneAttempts,
    verifiedPhone,
    selfMatches,
    publicLeaks,
    differentCity,
    hasLink,
    hasReason,
    emailAttempts,
    emailVerified,
    applicantAttempts,
    applicantRejected,
    collisionChecks,
    collisionOk
  };
}

module.exports = {
  BANNED,
  PUBLIC_KEYS,
  SAMPLE_MEMBERS,
  auditMembers,
  buildMembers,
  classify,
  extractLinks,
  handleIntroduction,
  loadRoom,
  normEmail,
  normName,
  normPhone,
  parseCsv,
  recommendFor,
  resetRoomCache,
  samePerson,
  sampleTrial,
  verify
};
