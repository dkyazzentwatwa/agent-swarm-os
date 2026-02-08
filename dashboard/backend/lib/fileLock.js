const fs = require('fs').promises;
const path = require('path');

/**
 * File locking system to prevent race conditions
 *
 * Uses in-memory locks with timeout protection.
 * For production with multiple processes, consider using a distributed lock
 * service like Redis or a file-based lock mechanism.
 *
 * Usage:
 *   await fileLock.withLock(filePath, async () => {
 *     // Critical section - read/write file
 *   });
 */
class FileLock {
  constructor() {
    // Map of normalized file paths to lock metadata
    this.locks = new Map();

    // Lock timeout in milliseconds (default: 30 seconds)
    this.lockTimeout = 30000;

    // Cleanup interval (check for stale locks every 5 seconds)
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleLocks();
    }, 5000);
  }

  /**
   * Acquire a lock for a file
   * Waits if the file is already locked
   *
   * @param {string} filePath - Path to the file to lock
   * @param {number} timeout - Maximum time to wait for lock (ms)
   * @returns {Promise<void>}
   */
  async acquire(filePath, timeout = 10000) {
    const normalized = path.resolve(filePath);
    const startTime = Date.now();

    while (this.locks.has(normalized)) {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for lock on ${filePath}`);
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Acquire the lock
    this.locks.set(normalized, {
      acquiredAt: Date.now(),
      filePath: normalized,
    });
  }

  /**
   * Release a lock for a file
   *
   * @param {string} filePath - Path to the file to unlock
   */
  release(filePath) {
    const normalized = path.resolve(filePath);
    this.locks.delete(normalized);
  }

  /**
   * Execute a function with a file lock
   * Automatically releases the lock when done
   *
   * @param {string} filePath - Path to the file to lock
   * @param {Function} fn - Function to execute while holding the lock
   * @returns {Promise<*>} Result of the function
   */
  async withLock(filePath, fn) {
    await this.acquire(filePath);

    try {
      return await fn();
    } finally {
      this.release(filePath);
    }
  }

  /**
   * Clean up stale locks that have exceeded the timeout
   * This prevents deadlocks if a process crashes while holding a lock
   */
  cleanupStaleLocks() {
    const now = Date.now();

    for (const [filePath, lock] of this.locks.entries()) {
      if (now - lock.acquiredAt > this.lockTimeout) {
        console.warn(`Cleaning up stale lock for ${filePath}`);
        this.locks.delete(filePath);
      }
    }
  }

  /**
   * Get lock status for debugging
   *
   * @returns {Object} Current locks and their status
   */
  getStatus() {
    const now = Date.now();
    const locks = [];

    for (const [filePath, lock] of this.locks.entries()) {
      locks.push({
        filePath,
        heldFor: now - lock.acquiredAt,
        acquiredAt: new Date(lock.acquiredAt).toISOString(),
      });
    }

    return {
      totalLocks: this.locks.size,
      locks,
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.locks.clear();
  }
}

// Singleton instance
const fileLock = new FileLock();

/**
 * Safe JSON file read with locking
 *
 * @param {string} filePath - Path to JSON file
 * @param {*} defaultValue - Default value if file doesn't exist
 * @returns {Promise<*>} Parsed JSON data
 */
async function safeReadJSON(filePath, defaultValue = null) {
  return fileLock.withLock(filePath, async () => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  });
}

/**
 * Safe JSON file write with locking and atomic write
 * Uses atomic write pattern (write to temp file, then rename)
 *
 * @param {string} filePath - Path to JSON file
 * @param {*} data - Data to write (will be JSON stringified)
 * @param {Object} options - Write options
 * @returns {Promise<void>}
 */
async function safeWriteJSON(filePath, data, options = {}) {
  const { spaces = 2, backup = false } = options;

  return fileLock.withLock(filePath, async () => {
    const dir = path.dirname(filePath);
    const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp`);

    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write to temporary file
      const content = JSON.stringify(data, null, spaces);
      await fs.writeFile(tempPath, content, 'utf-8');

      // Create backup if requested
      if (backup) {
        try {
          const backupPath = `${filePath}.backup`;
          await fs.copyFile(filePath, backupPath);
        } catch (error) {
          // Ignore backup errors (file might not exist yet)
          if (error.code !== 'ENOENT') {
            console.warn(`Failed to create backup of ${filePath}:`, error);
          }
        }
      }

      // Atomic rename (overwrites destination)
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  });
}

/**
 * Safe JSON file update with locking
 * Reads current data, applies update function, writes back
 *
 * @param {string} filePath - Path to JSON file
 * @param {Function} updateFn - Function that receives current data and returns updated data
 * @param {*} defaultValue - Default value if file doesn't exist
 * @returns {Promise<*>} Updated data
 */
async function safeUpdateJSON(filePath, updateFn, defaultValue = null) {
  return fileLock.withLock(filePath, async () => {
    // Read current data directly (without re-acquiring lock)
    let current;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      current = JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        current = defaultValue;
      } else {
        throw error;
      }
    }

    // Apply update
    const updated = await updateFn(current);

    // Write back directly (without re-acquiring lock)
    const dir = path.dirname(filePath);
    const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp`);

    try {
      await fs.mkdir(dir, { recursive: true });
      const content = JSON.stringify(updated, null, 2);
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }

    return updated;
  });
}

// Cleanup on process exit
process.on('exit', () => {
  fileLock.destroy();
});

process.on('SIGINT', () => {
  fileLock.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  fileLock.destroy();
  process.exit(0);
});

module.exports = {
  fileLock,
  safeReadJSON,
  safeWriteJSON,
  safeUpdateJSON,
};
