const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = __dirname;
const projectRoot = path.join(root, 'project-management');
const releaseDirectories = fs.readdirSync(projectRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^v\d+\.\d+$/.test(entry.name))
  .map(entry => entry.name)
  .filter(name => fs.existsSync(path.join(projectRoot, name, 'release-metadata.json')))
  .sort((left, right) => right.localeCompare(left, 'zh-CN', { numeric: true }));

if (!releaseDirectories.length) {
  process.stderr.write('未找到项目管理版本元数据，请确认启动器位于完整发布目录根目录。\n');
  process.exit(1);
}

const versionDirectory = releaseDirectories[0];
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function openBrowser(url) {
  if (process.platform === 'win32') {
    const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  }
}

function safeTarget(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/^\/+/, '');
  const target = path.resolve(root, normalized);
  const allowedPrefix = `${path.resolve(root)}${path.sep}`;
  return target === path.resolve(root) || target.startsWith(allowedPrefix) ? target : null;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
  if (requestUrl.pathname === '/') {
    response.writeHead(302, { Location: `/project-management/${versionDirectory}/` });
    response.end();
    return;
  }

  let target = safeTarget(requestUrl.pathname);
  if (!target) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('页面不存在');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream',
  });
  fs.createReadStream(target).pipe(response);
});

let port = 8766;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && port < 8775) {
    port += 1;
    server.listen(port, '127.0.0.1');
    return;
  }
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
});
server.on('listening', () => {
  const url = `http://127.0.0.1:${port}/project-management/${versionDirectory}/`;
  process.stdout.write(`项目管理 ${versionDirectory} 已启动：${url}\n`);
  process.stdout.write('浏览器关闭后，可按 Ctrl+C 停止本地预览。\n');
  if (process.env.PROJECT_PREVIEW_NO_OPEN !== '1') openBrowser(url);
});
server.listen(port, '127.0.0.1');
