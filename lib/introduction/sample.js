// FICTIONAL SAMPLE ROOM
// Invented so a public preview can show one match without the real guest list.
// Emails use example.com. Phones are 90000000xx.
// None of these people have been to The Big Dinner.

const SAMPLE_MEMBERS = [
  {
    id: "sample-ada",
    displayName: "Ada Marlowe",
    names: ["ada marlowe"],
    phones: ["9000000001"],
    emails: ["ada.marlowe@example.com"],
    cities: ["Bombay"],
    months: ["March 2026"],
    editionKeys: ["March 2026||Bombay"],
    occupation: "Architect of small public libraries",
    principle: "A room should lower the voice, not raise it.",
    conversation: "A night watchman said emptiness can be a form of care.",
    proud: "Kept a reading room open through a difficult year.",
    linkedin: "https://www.linkedin.com/in/ada-marlowe-example",
    instagram: ""
  },
  {
    id: "sample-rohan",
    displayName: "Rohan Vale",
    names: ["rohan vale"],
    phones: ["9000000002"],
    emails: ["rohan.vale@example.com"],
    cities: ["Delhi"],
    months: ["January 2026"],
    editionKeys: ["January 2026||Delhi"],
    occupation: "Climate scientist studying slow rivers",
    principle: "The long view is a kind of honesty.",
    conversation: "A farmer described a river that changed its mind.",
    proud: "A decade of measurements nobody had bothered to keep.",
    linkedin: "https://www.linkedin.com/in/rohan-vale-example",
    instagram: ""
  },
  {
    id: "sample-meera",
    displayName: "Meera Qureshi",
    names: ["meera qureshi"],
    phones: ["9000000003"],
    emails: ["meera.qureshi@example.com"],
    cities: ["Hyderabad"],
    months: ["November 2026"],
    editionKeys: ["November 2026||Hyderabad"],
    occupation: "Criminal defence counsel",
    principle: "Doubt is a form of respect.",
    conversation: "A client asked who gets to be believed.",
    proud: "A quiet acquittal after a long hearing.",
    linkedin: "",
    instagram: "https://instagram.com/meeraqureshi.example"
  },
  {
    id: "sample-julian",
    displayName: "Julian Peck",
    names: ["julian peck"],
    phones: ["9000000004"],
    emails: ["julian.peck@example.com"],
    cities: ["London"],
    months: ["May 2026"],
    editionKeys: ["May 2026||London"],
    occupation: "Composer for small ensembles",
    principle: "Listening is a discipline, not a mood.",
    conversation: "A violinist refused to rush the silence before the note.",
    proud: "A quartet that trusted the quiet bars.",
    linkedin: "https://www.linkedin.com/in/julian-peck-example",
    instagram: ""
  },
  {
    id: "sample-leela",
    displayName: "Leela Voss",
    names: ["leela voss"],
    phones: ["9000000005"],
    emails: ["leela.voss@example.com"],
    cities: ["Delhi"],
    months: ["August 2026"],
    editionKeys: ["August 2026||Delhi"],
    occupation: "Paediatric surgeon",
    principle: "Steady hands begin with a steady account of the truth.",
    conversation: "A nurse stopped a rushed decision with one quiet question.",
    proud: "A child sent home with a clear explanation.",
    linkedin: "https://www.linkedin.com/in/leela-voss-example",
    instagram: ""
  },
  {
    id: "sample-kabir",
    displayName: "Kabir Sen",
    names: ["kabir sen"],
    phones: ["9000000006"],
    emails: ["kabir.sen@example.com"],
    cities: ["Bombay"],
    months: ["March 2026"],
    editionKeys: ["March 2026||Bombay"],
    occupation: "Film editor",
    principle: "What you leave out is also a choice.",
    conversation: "A projectionist talked about the dark between reels.",
    proud: "A cut that let the audience arrive on their own.",
    linkedin: "https://www.linkedin.com/in/kabir-sen-example",
    instagram: ""
  },
  {
    id: "sample-naomi",
    displayName: "Naomi Idris",
    names: ["naomi idris"],
    phones: ["9000000007"],
    emails: ["naomi.idris@example.com"],
    cities: ["London"],
    months: ["September 2026"],
    editionKeys: ["September 2026||London"],
    occupation: "Designs routes for cargo ships",
    principle: "Distance is a design, not an accident.",
    conversation: "A harbour pilot explained why the slow path saves the ship.",
    proud: "A route that arrived intact in bad weather.",
    linkedin: "https://www.linkedin.com/in/naomi-idris-example",
    instagram: ""
  },
  {
    id: "sample-farid",
    displayName: "Farid Holst",
    names: ["farid holst"],
    phones: ["9000000008"],
    emails: ["farid.holst@example.com"],
    cities: ["Hyderabad"],
    months: ["February 2026"],
    editionKeys: ["February 2026||Hyderabad"],
    occupation: "Ceramicist",
    principle: "Beauty is what remains after use.",
    conversation: "A potter said the crack is part of the record.",
    proud: "A bowl still in daily use ten years on.",
    linkedin: "",
    instagram: "https://instagram.com/faridholst.example"
  },
  {
    id: "sample-samir-capital",
    displayName: "Samir Cole",
    names: ["samir cole"],
    phones: ["9000000009"],
    emails: ["samir.cole.delhi@example.com"],
    cities: ["Delhi"],
    months: ["July 2026"],
    editionKeys: ["July 2026||Delhi"],
    occupation: "Looks after family capital",
    principle: "Money is a tool, and tools should stay in the hand.",
    conversation: "An older partner said liquidity is not the same as freedom.",
    proud: "A family fund that outlasted a noisy year.",
    linkedin: "https://www.linkedin.com/in/samir-cole-delhi-example",
    instagram: ""
  },
  {
    id: "sample-samir-poet",
    displayName: "Samir Cole",
    names: ["samir cole"],
    phones: ["9000000010"],
    emails: ["samir.cole.bombay@example.com"],
    cities: ["Bombay"],
    months: ["April 2026"],
    editionKeys: ["April 2026||Bombay"],
    occupation: "Poet and teacher",
    principle: "A line should be exact, and then it should be kind.",
    conversation: "A student asked whether clarity is a form of courage.",
    proud: "A class that left with one true sentence.",
    linkedin: "",
    instagram: "https://instagram.com/samircole.example"
  }
];

function sampleTrial() {
  const ada = SAMPLE_MEMBERS[0];
  return {
    name: ada.displayName,
    email: ada.emails[0],
    phone: ""
  };
}

module.exports = { SAMPLE_MEMBERS, sampleTrial };
