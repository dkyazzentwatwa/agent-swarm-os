const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { fileLock, safeReadJSON, safeWriteJSON, safeUpdateJSON } = require('../lib/fileLock');

describe('FileLock', () => {
  let testDir;
  let testFile;

  before(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filelock-test-'));
    testFile = path.join(testDir, 'test.json');
  });

  after(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Basic Locking', () => {
    it('should acquire and release locks', async () => {
      await fileLock.acquire(testFile);
      assert.ok(fileLock.locks.has(path.resolve(testFile)));

      fileLock.release(testFile);
      assert.ok(!fileLock.locks.has(path.resolve(testFile)));
    });

    it('should wait for lock to be released', async () => {
      const results = [];

      // Acquire lock
      await fileLock.acquire(testFile);

      // Try to acquire same lock in parallel
      const promise1 = (async () => {
        await fileLock.acquire(testFile, 1000);
        results.push('second');
        fileLock.release(testFile);
      })();

      // Release first lock after 100ms
      setTimeout(() => {
        results.push('first');
        fileLock.release(testFile);
      }, 100);

      await promise1;

      assert.deepStrictEqual(results, ['first', 'second']);
    });

    it('should timeout if lock is held too long', async () => {
      await fileLock.acquire(testFile);

      await assert.rejects(
        async () => {
          await fileLock.acquire(testFile, 100);
        },
        /Timeout waiting for lock/
      );

      fileLock.release(testFile);
    });
  });

  describe('withLock', () => {
    it('should execute function with lock', async () => {
      let executed = false;

      await fileLock.withLock(testFile, async () => {
        executed = true;
        assert.ok(fileLock.locks.has(path.resolve(testFile)));
      });

      assert.ok(executed);
      assert.ok(!fileLock.locks.has(path.resolve(testFile)));
    });

    it('should release lock even if function throws', async () => {
      await assert.rejects(
        async () => {
          await fileLock.withLock(testFile, async () => {
            throw new Error('Test error');
          });
        },
        /Test error/
      );

      assert.ok(!fileLock.locks.has(path.resolve(testFile)));
    });

    it('should return function result', async () => {
      const result = await fileLock.withLock(testFile, async () => {
        return { success: true };
      });

      assert.deepStrictEqual(result, { success: true });
    });
  });

  describe('safeReadJSON', () => {
    it('should read JSON file', async () => {
      const data = { test: 'value' };
      await fs.writeFile(testFile, JSON.stringify(data), 'utf-8');

      const result = await safeReadJSON(testFile);
      assert.deepStrictEqual(result, data);
    });

    it('should return default value if file does not exist', async () => {
      const nonExistent = path.join(testDir, 'nonexistent.json');
      const result = await safeReadJSON(nonExistent, { default: true });

      assert.deepStrictEqual(result, { default: true });
    });

    it('should throw on invalid JSON', async () => {
      await fs.writeFile(testFile, 'invalid json', 'utf-8');

      await assert.rejects(
        async () => {
          await safeReadJSON(testFile);
        },
        /JSON/
      );
    });
  });

  describe('safeWriteJSON', () => {
    it('should write JSON file', async () => {
      const data = { test: 'value', nested: { key: 123 } };
      await safeWriteJSON(testFile, data);

      const content = await fs.readFile(testFile, 'utf-8');
      const parsed = JSON.parse(content);

      assert.deepStrictEqual(parsed, data);
    });

    it('should create directory if it does not exist', async () => {
      const nestedDir = path.join(testDir, 'nested', 'deep');
      const nestedFile = path.join(nestedDir, 'test.json');

      await safeWriteJSON(nestedFile, { nested: true });

      const content = await fs.readFile(nestedFile, 'utf-8');
      const parsed = JSON.parse(content);

      assert.deepStrictEqual(parsed, { nested: true });
    });

    it('should use atomic write pattern', async () => {
      const data = { version: 1 };
      await safeWriteJSON(testFile, data);

      // Verify temp file is not left behind
      const dir = path.dirname(testFile);
      const files = await fs.readdir(dir);
      const tempFiles = files.filter(f => f.startsWith('.') && f.endsWith('.tmp'));

      assert.strictEqual(tempFiles.length, 0);
    });

    it('should create backup if requested', async () => {
      const initial = { version: 1 };
      await safeWriteJSON(testFile, initial);

      const updated = { version: 2 };
      await safeWriteJSON(testFile, updated, { backup: true });

      // Check backup exists
      const backupPath = `${testFile}.backup`;
      const backupContent = await fs.readFile(backupPath, 'utf-8');
      const backupData = JSON.parse(backupContent);

      assert.deepStrictEqual(backupData, initial);
    });
  });

  describe('safeUpdateJSON', () => {
    it('should read, update, and write atomically', async () => {
      const initial = { counter: 0 };
      await safeWriteJSON(testFile, initial);

      const updated = await safeUpdateJSON(testFile, (data) => {
        return { counter: data.counter + 1 };
      });

      assert.strictEqual(updated.counter, 1);

      const content = await fs.readFile(testFile, 'utf-8');
      const parsed = JSON.parse(content);
      assert.strictEqual(parsed.counter, 1);
    });

    it('should use default value if file does not exist', async () => {
      const nonExistent = path.join(testDir, 'new-file.json');

      const result = await safeUpdateJSON(
        nonExistent,
        (data) => {
          return { ...data, updated: true };
        },
        { default: true }
      );

      assert.deepStrictEqual(result, { default: true, updated: true });
    });

    it('should prevent race conditions', async () => {
      const initial = { counter: 0 };
      await safeWriteJSON(testFile, initial);

      // Simulate concurrent updates
      const updates = Array.from({ length: 10 }, (_, i) =>
        safeUpdateJSON(testFile, (data) => {
          return { counter: data.counter + 1 };
        })
      );

      await Promise.all(updates);

      const content = await fs.readFile(testFile, 'utf-8');
      const parsed = JSON.parse(content);

      // Should have incremented 10 times without race conditions
      assert.strictEqual(parsed.counter, 10);
    });
  });

  describe('Lock Status', () => {
    it('should report lock status', async () => {
      await fileLock.acquire(testFile);

      const status = fileLock.getStatus();

      assert.strictEqual(status.totalLocks, 1);
      assert.strictEqual(status.locks.length, 1);
      assert.ok(status.locks[0].filePath.endsWith('test.json'));
      assert.ok(typeof status.locks[0].heldFor === 'number');

      fileLock.release(testFile);
    });
  });
});
