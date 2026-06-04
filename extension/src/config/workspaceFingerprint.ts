import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export const DEPENDENCY_MANIFEST_BASENAMES = new Set([
  "pyproject.toml",
  "requirements.txt",
  "requirements-dev.txt",
  "requirements-test.txt",
  "requirements.in",
  "poetry.lock",
  "Pipfile",
  "Pipfile.lock",
  "uv.lock",
  "pyenv.lock",
  ".python-version",
]);

export type FingerprintCache = {
  combined?: { key: string; fingerprint: string };
  dependency?: { key: string; fingerprint: string };
};

export function isDependencyManifestUri(uri: vscode.Uri): boolean {
  if (uri.scheme !== "file") {
    return false;
  }

  const normalized = uri.fsPath.replace(/\\/g, "/");
  const base = path.basename(normalized);
  if (DEPENDENCY_MANIFEST_BASENAMES.has(base)) {
    return true;
  }

  return /\/requirements\/.+\.(txt|in)$/i.test(normalized);
}

export function buildInterpreterCacheFingerprint(
  pythonPath: string,
  cache: FingerprintCache,
): string {
  const dependencyFingerprint = getWorkspaceDependencyFingerprint(cache);
  const key = `${pythonPath}:${dependencyFingerprint}`;
  if (cache.combined?.key === key) {
    return cache.combined.fingerprint;
  }

  const fingerprint = crypto
    .createHash("sha256")
    .update(key)
    .digest("hex")
    .slice(0, 16);
  cache.combined = { key, fingerprint };
  return fingerprint;
}

function getWorkspaceDependencyFingerprint(cache: FingerprintCache): string {
  const files = collectDependencyManifestFiles();
  if (files.length === 0) {
    return "no-manifests";
  }

  const snapshot = files
    .map((file) => {
      try {
        const stat = fs.statSync(file);
        return `${file}:${stat.size}:${Math.trunc(stat.mtimeMs)}`;
      } catch {
        return `${file}:missing`;
      }
    })
    .join("|");

  if (cache.dependency?.key === snapshot) {
    return cache.dependency.fingerprint;
  }

  const hash = crypto.createHash("sha256");
  for (const file of files) {
    try {
      hash.update(vscode.workspace.asRelativePath(file));
      hash.update("\0");
      hash.update(fs.readFileSync(file));
      hash.update("\0");
    } catch {
      // Best-effort fingerprinting for transient filesystem errors.
    }
  }

  const fingerprint = hash.digest("hex").slice(0, 16);
  cache.dependency = { key: snapshot, fingerprint };
  return fingerprint;
}

function collectDependencyManifestFiles(): string[] {
  const files = new Set<string>();
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const root = folder.uri.fsPath;
    for (const name of DEPENDENCY_MANIFEST_BASENAMES) {
      const candidate = path.join(root, name);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        files.add(candidate);
      }
    }

    const requirementsDir = path.join(root, "requirements");
    if (!fs.existsSync(requirementsDir)) {
      continue;
    }

    try {
      const entries = fs.readdirSync(requirementsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }
        if (!/\.(txt|in)$/i.test(entry.name)) {
          continue;
        }
        files.add(path.join(requirementsDir, entry.name));
      }
    } catch {
      // Best-effort requirements directory scan.
    }
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}
