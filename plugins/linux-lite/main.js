#!/usr/bin/env node
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const readline = require('readline');

const MODE = (process.env.AGNES_LINUX_MODE || 'sandbox').toLowerCase(); // lite | sandbox
const DISTRO = process.env.AGNES_SANDBOX_DISTRO || 'agnes-sandbox';
const APPDATA = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const SANDBOX_DIR = path.join(APPDATA, 'agnes-chat-app', 'sandbox', 'linux');
const REPO_SYSTEM_BASE = 'https://raw.githubusercontent.com/ekstai/ai-agnes/main/system/ubuntu-rootfs.part';
const SYSTEM_PART_COUNT = 8;

function sh(cmd, timeoutMs) {
  const timeout = timeoutMs || 60000;
  return new Promise((resolve) => {
    const args = MODE === 'lite' ? ['-e', 'bash', '-lc', cmd] : ['-d', DISTRO, '-e', 'bash', '-lc', cmd];
    const p = spawn('wsl', args, { windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => { try { p.kill(); } catch (e) { /* ignore */ } }, timeout);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code: code, out: out.slice(0, 30000), err: err.slice(0, 5000) }); });
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out: '', err: String(e) }); });
  });
}

async function ensureDistro() {
  if (MODE !== 'sandbox') return { ok: true, note: 'lite 模式使用系统默认 WSL 发行版' };
  const has = await new Promise((resolve) => {
    const p = spawn('wsl', ['--list', '--quiet'], { windowsHide: true });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', () => resolve(out.toLowerCase().includes(DISTRO.toLowerCase())));
    p.on('error', () => resolve(false));
  });
  if (has) return { ok: true, note: '发行版已就绪' };
  const winPath = SANDBOX_DIR.replace(/\\/g, '\\\\');
  const ps =
    "New-Item -ItemType Directory -Force -Path '" + winPath + "' | Out-Null; " +
    "New-Item -ItemType Directory -Force -Path '" + winPath + "\\\\vm' | Out-Null; " +
    "$tg='" + winPath + "\\\\ubuntu-rootfs.tar.gz'; " +
    "if (-not (Test-Path $tg)) { " +
    "0.." + (SYSTEM_PART_COUNT - 1) + " | ForEach-Object { $dst = '" + winPath + "\\\\part0' + $_; if (-not (Test-Path $dst)) { Invoke-WebRequest -Uri ('" + REPO_SYSTEM_BASE + "' + ('0' + $_)) -OutFile $dst } }; " +
    "$fs = [System.IO.File]::Create($tg); " +
    "0.." + (SYSTEM_PART_COUNT - 1) + " | ForEach-Object { $b = [System.IO.File]::ReadAllBytes('" + winPath + "\\\\part0' + $_); $fs.Write($b, 0, $b.Length) }; " +
    "$fs.Close() }; " +
    "wsl --import " + DISTRO + " '" + winPath + "\\\\vm' $tg --version 2";
  const r = await new Promise((resolve) => {
    const p = spawn('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true });
    let o = '';
    p.stdout.on('data', (d) => { o += d; });
    p.stderr.on('data', (d) => { o += d; });
    p.on('close', (code) => resolve({ code: code, o: o.slice(0, 4000) }));
    p.on('error', () => resolve({ code: -1, o: 'spawn powershell 失败' }));
  });
  if (r.code !== 0) return { ok: false, note: '发行版导入失败：' + r.o };
  return { ok: true, note: '已从 Ubuntu 官方云镜像导入完整系统到 ' + SANDBOX_DIR };
}

const TOOLS = [
  {
    name: 'linux_exec',
    description: '在 Linux 环境（' + (MODE === 'sandbox' ? '沙盒发行版 ' + DISTRO : '系统默认 WSL') + '）中执行 bash 命令并返回输出',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的 bash 命令' },
        cwd: { type: 'string', description: '工作目录（Linux 路径，默认 /root）' },
        timeoutMs: { type: 'number', description: '超时毫秒（默认 60000）' },
      },
      required: ['command'],
    },
  },
  {
    name: 'linux_fs_list',
    description: '列出 Linux 环境内指定目录的文件与子目录',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Linux 目录路径（默认 /root）' } },
      required: [],
    },
  },
  {
    name: 'linux_fs_read',
    description: '读取 Linux 环境内的文本文件内容',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Linux 文件路径' }, maxBytes: { type: 'number', description: '最多读取字节（默认 32768）' } },
      required: ['path'],
    },
  },
  {
    name: 'linux_fs_write',
    description: '向 Linux 环境内写入/覆盖文本文件（自动创建父目录）',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Linux 文件路径' }, content: { type: 'string', description: '文件内容' } },
      required: ['path', 'content'],
    },
  },
];

function sq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
async function callTool(name, args) {
  const a = args || {};
  if (name === 'linux_exec') {
    const ready = await ensureDistro();
    if (!ready.ok) return { content: [{ type: 'text', text: ready.note }], isError: true };
    let cmd = a.command;
    if (a.cwd) cmd = 'cd ' + sq(a.cwd) + ' 2>/dev/null; ' + cmd;
    const r = await sh(cmd, a.timeoutMs);
    const text = 'exit=' + r.code + (r.out ? '\n[stdout]\n' + r.out : '') + (r.err ? '\n[stderr]\n' + r.err : '');
    return { content: [{ type: 'text', text: text }], isError: r.code !== 0 };
  }
  if (name === 'linux_fs_list') {
    const r = await sh('ls -la --time-style=+%Y-%m-%d ' + sq(a.path || '/root'));
    return { content: [{ type: 'text', text: r.code === 0 ? r.out : '读取失败：' + r.err }], isError: r.code !== 0 };
  }
  if (name === 'linux_fs_read') {
    const max = Math.min(Number(a.maxBytes) || 32768, 131072);
    const r = await sh('head -c ' + max + ' ' + sq(a.path) + ' 2>&1');
    return { content: [{ type: 'text', text: r.out }], isError: r.code !== 0 };
  }
  if (name === 'linux_fs_write') {
    const b64 = Buffer.from(String(a.content), 'utf8').toString('base64');
    const r = await sh('mkdir -p "$(dirname ' + sq(a.path) + ')" && printf %s ' + sq(b64) + ' | base64 -d > ' + sq(a.path) + ' && wc -c < ' + sq(a.path));
    return { content: [{ type: 'text', text: r.code === 0 ? '已写入 ' + a.path + '（' + r.out.trim() + ' 字节）' : '写入失败：' + r.err }], isError: r.code !== 0 };
  }
  return { content: [{ type: 'text', text: '未知工具：' + name }], isError: true };
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch (e) { return; }
  if (!msg || msg.jsonrpc !== '2.0') return;
  if (msg.id === undefined || msg.id === null) return; // 通知（notifications/initialized）无需响应
  const reply = (result, error) => {
    const out = { jsonrpc: '2.0', id: msg.id };
    if (error) out.error = error; else out.result = result;
    process.stdout.write(JSON.stringify(out) + '\n');
  };
  if (msg.method === 'initialize') {
    reply({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'agnes-linux', version: '1.2.0', mode: MODE, distro: MODE === 'sandbox' ? DISTRO : '(系统默认 WSL)' },
    });
  } else if (msg.method === 'tools/list') {
    reply({ tools: TOOLS });
  } else if (msg.method === 'tools/call') {
    const p = msg.params || {};
    callTool(p.name, p.arguments).then((res) => reply(res)).catch((e) => reply(undefined, { code: -32000, message: String(e) }));
  } else {
    reply(undefined, { code: -32601, message: 'method not found: ' + msg.method });
  }
});
process.stdout.write('[agnes-linux] MCP 服务器已启动（mode=' + MODE + '，stdio）\n');
