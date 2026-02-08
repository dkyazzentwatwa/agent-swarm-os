const fs = require("fs");
const path = require("path");

function readCoffeeRoom(teamsDir, since = null) {
  const filePath = path.join(teamsDir, "coffee-room.jsonl");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (since) {
      const sinceDate = new Date(since);
      return lines.filter((msg) => new Date(msg.timestamp) > sinceDate);
    }

    return lines;
  } catch {
    return [];
  }
}

function readSampleCoffeeRoom(sampleDataDir) {
  const filePath = path.join(sampleDataDir, "sample-coffee-room.jsonl");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = { readCoffeeRoom, readSampleCoffeeRoom };
