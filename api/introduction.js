const { handleIntroduction } = require("../lib/introduction/engine");

module.exports = async function handler(req, res) {
  try {
    const result = await handleIntroduction(req);
    res.statusCode = result.status;
    Object.entries(result.headers).forEach(([key, value]) => res.setHeader(key, value));
    res.end(JSON.stringify(result.body));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ ok: false, error: "quiet" }));
  }
};
