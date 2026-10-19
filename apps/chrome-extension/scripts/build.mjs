/**
 * Zero-dependency Chrome Extension MV3 Builder using TypeScript Compiler API
 * Outputs ready-to-load extension assets into apps/chrome-extension/dist
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.resolve(__dirname, '..');
const srcDir = path.join(extRoot, 'src');
const distDir = path.join(extRoot, 'dist');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function transpileFile(relPath) {
  const fullSourcePath = path.join(srcDir, relPath);
  const rawCode = fs.readFileSync(fullSourcePath, 'utf-8');
  const transpiled = ts.transpileModule(rawCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      removeComments: false,
    },
  });

  // Rewrite extensionless relative imports to .js for native browser ES module loading
  const codeWithJsImports = transpiled.outputText.replace(
    /from\s+['"](\.[^'"]+)['"]/g,
    (match, importPath) => {
      if (importPath.endsWith('.js')) return match;
      return `from '${importPath}.js'`;
    }
  );

  const outRelPath = relPath.replace(/\.ts$/, '.js');
  const fullOutPath = path.join(distDir, 'src', outRelPath);
  ensureDir(path.dirname(fullOutPath));
  fs.writeFileSync(fullOutPath, codeWithJsImports, 'utf-8');
}

function buildExtension() {
  fs.rmSync(distDir, { recursive: true, force: true });
  ensureDir(distDir);

  // 1. Copy manifest.json
  fs.copyFileSync(
    path.join(extRoot, 'public', 'manifest.json'),
    path.join(distDir, 'manifest.json')
  );

  // 2. Copy popup HTML
  ensureDir(path.join(distDir, 'src', 'popup'));
  fs.copyFileSync(
    path.join(srcDir, 'popup', 'index.html'),
    path.join(distDir, 'src', 'popup', 'index.html')
  );

  // 3. Transpile TypeScript modules
  const tsFiles = [
    'utils/pii-masker.ts',
    'utils/dom-parser.ts',
    'utils/action-controller.ts',
    'utils/vault-db.ts',
    'background/index.ts',
    'content/index.ts',
    'popup/index.ts',
  ];

  for (const file of tsFiles) {
    transpileFile(file);
  }

  console.log('[ConsentGuard Build] Chrome Extension MV3 bundle generated at apps/chrome-extension/dist');
}

buildExtension();
