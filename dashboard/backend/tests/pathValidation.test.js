const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { validatePathInWorkspace, isSuspiciousPath, safeJoin } = require('../lib/pathValidation');

describe('Path Validation Security Tests', () => {
  let testWorkspace;

  beforeEach(() => {
    testWorkspace = path.join(os.tmpdir(), 'test-workspace-' + Date.now());
    fs.mkdirSync(testWorkspace, { recursive: true });
  });

  describe('validatePathInWorkspace', () => {
    it('should allow paths within workspace', () => {
      const safePath = 'artifacts/summary/summary.md';
      const result = validatePathInWorkspace(testWorkspace, safePath);
      assert.ok(result.startsWith(testWorkspace));
    });

    it('should reject path traversal with ..', () => {
      const maliciousPath = '../../etc/passwd';
      assert.throws(() => {
        validatePathInWorkspace(testWorkspace, maliciousPath);
      }, /Path traversal detected/);
    });

    it('should reject absolute paths outside workspace', () => {
      const maliciousPath = '/etc/passwd';
      assert.throws(() => {
        validatePathInWorkspace(testWorkspace, maliciousPath);
      }, /Path traversal detected/);
    });

    it('should handle nested paths correctly', () => {
      const nestedPath = 'artifacts/module-1/output.json';
      const result = validatePathInWorkspace(testWorkspace, nestedPath);
      assert.ok(result.includes('artifacts'));
      assert.ok(result.includes('module-1'));
    });

    it('should reject paths that escape via multiple segments', () => {
      const maliciousPath = 'artifacts/../../etc/passwd';
      assert.throws(() => {
        validatePathInWorkspace(testWorkspace, maliciousPath);
      }, /Path traversal detected/);
    });
  });

  describe('isSuspiciousPath', () => {
    it('should detect parent directory traversal', () => {
      assert.strictEqual(isSuspiciousPath('../secret'), true);
      assert.strictEqual(isSuspiciousPath('../../etc/passwd'), true);
    });

    it('should detect system directory access', () => {
      assert.strictEqual(isSuspiciousPath('/etc/passwd'), true);
      assert.strictEqual(isSuspiciousPath('/proc/self/environ'), true);
      assert.strictEqual(isSuspiciousPath('/sys/class'), true);
      assert.strictEqual(isSuspiciousPath('/dev/null'), true);
    });

    it('should detect home directory expansion', () => {
      assert.strictEqual(isSuspiciousPath('~/secret'), true);
    });

    it('should detect null byte injection', () => {
      assert.strictEqual(isSuspiciousPath('file.txt\0.jpg'), true);
    });

    it('should detect newline injection', () => {
      assert.strictEqual(isSuspiciousPath('file.txt\nmalicious'), true);
      assert.strictEqual(isSuspiciousPath('file.txt\rmalicious'), true);
    });

    it('should allow safe paths', () => {
      assert.strictEqual(isSuspiciousPath('artifacts/summary.md'), false);
      assert.strictEqual(isSuspiciousPath('workspace.json'), false);
      assert.strictEqual(isSuspiciousPath('agents/analyst.md'), false);
    });
  });

  describe('safeJoin', () => {
    it('should join paths safely', () => {
      const result = safeJoin(testWorkspace, 'artifacts', 'summary.md');
      assert.ok(result.startsWith(testWorkspace));
      assert.ok(result.includes('artifacts'));
    });

    it('should reject joined paths that escape', () => {
      assert.throws(() => {
        safeJoin(testWorkspace, '../..', 'etc', 'passwd');
      }, /Path traversal detected/);
    });
  });

  describe('Real-world attack vectors', () => {
    const attackVectors = [
      '../../etc/passwd',
      '../../../etc/shadow',
      '/etc/passwd',
      '~/../../etc/passwd',
      'artifacts/../../../../../../etc/passwd',
      './../secret',
      '..\\..\\windows\\system32',
      'file.txt\0.jpg',
      'file\nmalicious',
      '/proc/self/environ',
      '/sys/class/net',
      '/dev/random',
    ];

    attackVectors.forEach(vector => {
      it(`should reject attack vector: ${vector}`, () => {
        assert.ok(
          isSuspiciousPath(vector) ||
          (() => {
            try {
              validatePathInWorkspace(testWorkspace, vector);
              return false;
            } catch {
              return true;
            }
          })(),
          `Failed to reject: ${vector}`
        );
      });
    });
  });
});
