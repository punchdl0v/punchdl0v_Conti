import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const tmpOutDir = path.resolve(rootDir, '.singlefile-tmp');
const publicDir = path.resolve(rootDir, 'public');
const outputHtmlPath = path.resolve(publicDir, 'storyboard-maker.html');

async function buildSingleHtml() {
  await build({
    root: rootDir,
    configFile: path.resolve(rootDir, 'vite.config.ts'),
    publicDir: false,
    logLevel: 'warn',
    build: {
      outDir: tmpOutDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 10_000_000,
      rollupOptions: {
        output: {
          format: 'iife',
          inlineDynamicImports: true,
        },
      },
    },
  });

  const assetsDir = path.resolve(tmpOutDir, 'assets');
  const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

  let cssCode = '';
  let jsCode = '';

  for (const file of assetFiles) {
    const fullPath = path.resolve(assetsDir, file);
    if (file.endsWith('.css')) {
      cssCode += fs.readFileSync(fullPath, 'utf8') + '\n';
    } else if (file.endsWith('.js')) {
      jsCode += fs.readFileSync(fullPath, 'utf8') + '\n';
    }
  }

  // Inline src/assets/images/*.jpg as base64 data URIs so offline file:// works completely
  const imagesDir = path.resolve(rootDir, 'src/assets/images');
  if (fs.existsSync(imagesDir)) {
    for (const imgFile of fs.readdirSync(imagesDir)) {
      const ext = path.extname(imgFile).toLowerCase();
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.svg'
              ? 'image/svg+xml'
              : 'image/jpeg';
      const b64 = fs.readFileSync(path.resolve(imagesDir, imgFile)).toString('base64');
      const relUrl = `/src/assets/images/${imgFile}`;
      jsCode = jsCode.split(relUrl).join(`data:${mime};base64,${b64}`);
    }
  }

  let html = fs.readFileSync(path.resolve(rootDir, 'index.html'), 'utf8');

  // Remove Vite dev entry script
  html = html.replace(/<script\s+type="module"\s+src="\/src\/main\.tsx"><\/script>/i, '');

  const safeCss = cssCode.replace(/<\/style/gi, '<\\/style');
  const safeJs = jsCode.replace(/<\/script/gi, '<\\/script');

  html = html.split('</head>').join(`  <style>\n${safeCss}\n  </style>\n  </head>`);
  html = html
    .split('</body>')
    .join(`  <!--EMBEDDED_PROJECT_DATA-->\n    <script>\n${safeJs}\n    </script>\n  </body>`);

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(outputHtmlPath, html, 'utf8');

  fs.rmSync(tmpOutDir, { recursive: true, force: true });

  const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`Generated single HTML file: ${outputHtmlPath} (${sizeKb} KB)`);
}

buildSingleHtml().catch((err) => {
  console.error(err);
  process.exit(1);
});
