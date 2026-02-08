const express = require("express");
const fs = require("fs");
const path = require("path");
const { glob } = require("glob");

const router = express.Router();

const PLATFORMS = ["youtube", "instagram", "tiktok", "threads", "substack"];

async function listContentFolders(contentDir) {
  try {
    const entries = fs.readdirSync(contentDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name !== "archive" && !e.name.startsWith("."))
      .map((e) => {
        const folderPath = path.join(contentDir, e.name);
        const platforms = {};

        for (const platform of PLATFORMS) {
          const platformDir = path.join(folderPath, platform);
          if (fs.existsSync(platformDir)) {
            try {
              const files = fs.readdirSync(platformDir, { withFileTypes: true });
              platforms[platform] = files
                .filter((f) => f.isFile())
                .map((f) => f.name);
            } catch {
              platforms[platform] = [];
            }
          }
        }

        const stat = fs.statSync(folderPath);
        return {
          slug: e.name,
          platforms,
          platformCount: Object.keys(platforms).length,
          lastModified: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.slug.localeCompare(a.slug));
  } catch {
    return [];
  }
}

router.get("/", async (req, res) => {
  const { contentDir, demoMode, sampleDataDir } = req.app.locals;

  if (demoMode) {
    const sampleContentDir = path.join(sampleDataDir, "sample-content");
    if (fs.existsSync(sampleContentDir)) {
      const folders = await listContentFolders(sampleContentDir);
      return res.json(folders);
    }
  }

  const folders = await listContentFolders(contentDir);
  res.json(folders);
});

router.get("/:slug", async (req, res) => {
  const { contentDir, demoMode, sampleDataDir } = req.app.locals;
  const baseDir = demoMode
    ? path.join(sampleDataDir, "sample-content")
    : contentDir;
  const folderPath = path.join(baseDir, req.params.slug);

  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: "Content not found" });
  }

  const result = {};
  for (const platform of PLATFORMS) {
    const platformDir = path.join(folderPath, platform);
    if (fs.existsSync(platformDir)) {
      const files = await glob("**/*", {
        cwd: platformDir,
        nodir: true,
        absolute: false,
      });
      result[platform] = files;
    }
  }

  const sharedDir = path.join(folderPath, "shared-assets");
  if (fs.existsSync(sharedDir)) {
    const files = await glob("**/*", {
      cwd: sharedDir,
      nodir: true,
      absolute: false,
    });
    result["shared-assets"] = files;
  }

  res.json(result);
});

router.get("/:slug/:platform", async (req, res) => {
  const { contentDir, demoMode, sampleDataDir } = req.app.locals;
  const baseDir = demoMode
    ? path.join(sampleDataDir, "sample-content")
    : contentDir;
  const filePath = path.join(
    baseDir,
    req.params.slug,
    req.params.platform
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Platform content not found" });
  }

  const files = await glob("**/*", {
    cwd: filePath,
    nodir: true,
    absolute: true,
  });

  const contents = files.map((f) => {
    const relativePath = path.relative(filePath, f);
    try {
      const content = fs.readFileSync(f, "utf-8");
      const stat = fs.statSync(f);
      return {
        name: relativePath,
        content,
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
      };
    } catch {
      return { name: relativePath, content: null, error: "Could not read file" };
    }
  });

  res.json(contents);
});

module.exports = router;
