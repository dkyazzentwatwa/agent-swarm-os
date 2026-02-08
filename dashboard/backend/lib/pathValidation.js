const fs = require('fs');
const path = require('path');

/**
 * Validates that a requested path is within the allowed workspace directory.
 * Prevents path traversal attacks and symlink escapes.
 *
 * @param {string} workspacePath - The root workspace directory (trusted)
 * @param {string} requestedPath - The user-provided path (untrusted)
 * @returns {string} The validated absolute path
 * @throws {Error} If path traversal or symlink escape is detected
 */
function validatePathInWorkspace(workspacePath, requestedPath) {
  // Normalize and resolve paths
  const workspaceNorm = path.resolve(workspacePath);
  const normalized = path.resolve(workspacePath, requestedPath);

  // Check if requested path is within workspace
  if (!normalized.startsWith(workspaceNorm + path.sep) && normalized !== workspaceNorm) {
    throw new Error('Path traversal detected: path is outside workspace');
  }

  // Check for symlink escapes by resolving real path
  try {
    const realPath = fs.realpathSync(normalized);
    if (!realPath.startsWith(workspaceNorm + path.sep) && realPath !== workspaceNorm) {
      throw new Error('Symlink escape detected: real path is outside workspace');
    }
    return realPath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, which is okay - return the normalized path
      return normalized;
    }
    throw error;
  }
}

/**
 * Validates multiple paths in a workspace.
 *
 * @param {string} workspacePath - The root workspace directory
 * @param {string[]} requestedPaths - Array of user-provided paths
 * @returns {string[]} Array of validated absolute paths
 * @throws {Error} If any path is invalid
 */
function validatePathsInWorkspace(workspacePath, requestedPaths) {
  return requestedPaths.map(p => validatePathInWorkspace(workspacePath, p));
}

/**
 * Safely joins paths and validates the result is within workspace.
 *
 * @param {string} workspacePath - The root workspace directory
 * @param {...string} segments - Path segments to join
 * @returns {string} The validated absolute path
 * @throws {Error} If resulting path is invalid
 */
function safeJoin(workspacePath, ...segments) {
  const joined = path.join(...segments);
  return validatePathInWorkspace(workspacePath, joined);
}

/**
 * Checks if a path contains suspicious patterns.
 *
 * @param {string} inputPath - Path to check
 * @returns {boolean} True if path looks suspicious
 */
function isSuspiciousPath(inputPath) {
  const suspicious = [
    /\.\./,           // Parent directory traversal
    /~\//,            // Home directory expansion
    /^\/etc\//,       // System config access
    /^\/proc\//,      // Process info access
    /^\/sys\//,       // System info access
    /^\/dev\//,       // Device access
    /\0/,             // Null byte injection
    /[\r\n]/,         // Newline injection
  ];

  return suspicious.some(pattern => pattern.test(inputPath));
}

/**
 * Express middleware to validate path parameters.
 *
 * @param {string} workspaceParam - Name of the workspace path parameter
 * @param {...string} pathParams - Names of path parameters to validate
 * @returns {Function} Express middleware
 */
function validatePathMiddleware(workspaceParam, ...pathParams) {
  return (req, res, next) => {
    try {
      const workspace = req.params[workspaceParam] || req.query[workspaceParam];
      if (!workspace) {
        return res.status(400).json({ error: 'Workspace path required' });
      }

      for (const param of pathParams) {
        const value = req.params[param] || req.query[param];
        if (value) {
          if (isSuspiciousPath(value)) {
            return res.status(400).json({
              error: 'Invalid path: suspicious pattern detected',
              param
            });
          }
          // Validate the path
          validatePathInWorkspace(workspace, value);
        }
      }

      next();
    } catch (error) {
      res.status(400).json({
        error: 'Path validation failed',
        message: error.message
      });
    }
  };
}

module.exports = {
  validatePathInWorkspace,
  validatePathsInWorkspace,
  safeJoin,
  isSuspiciousPath,
  validatePathMiddleware,
};
