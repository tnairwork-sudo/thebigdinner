// Prints counts only. Never prints names, phones, emails, or essays.
// MEMBERS_CSV_DIR=/absolute/path/to/csvs node lib/introduction/private-check.js

const { auditMembers, loadRoom, resetRoomCache } = require("./engine");

resetRoomCache();
const room = loadRoom();
const report = auditMembers(room.members, room.forms);
report.source = room.source;
process.stdout.write(`${JSON.stringify(report)}\n`);
if (report.selfMatches || report.publicLeaks) process.exit(1);
if (room.source === "private" && report.verifiedPhone < 1) process.exit(1);
