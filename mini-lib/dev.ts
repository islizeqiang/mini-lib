import chalk from 'chalk';
import { performance } from 'perf_hooks';
import { createFsFromVolume, Volume } from 'memfs';
import * as fs from 'fs';
import * as path from 'path';
import { createServer } from 'http';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

import { debounce, isWebSocket, concatStreams } from './utils';
import scriptBundler from './Webpack';

const open = require('open');
const WebSocket = require('faye-websocket');

const outputFileSystem = createFsFromVolume(new Volume());
const entryDir = process.argv[2];

const clientEntry = path.resolve(process.cwd(), `example/${entryDir}/index.js`);
const serverEntry = path.resolve(process.cwd(), `example/${entryDir}/server.js`);
const htmlFile = path.resolve(process.cwd(), `example/${entryDir}/index.html`);
const injectFile = path.resolve(__dirname, 'injected.html');
const iconFile = path.resolve(__dirname, 'favicon.ico');

const clientFile = '/client.js';
const HOST = '127.0.0.1';
const PORT = 7000;

const watchedFiles: string[] = [];
let firstSuccess = false;
let ws: WebSocket;
let serverProcess: ChildProcess | null = null;

const output = (file: string, data: string | Buffer) =>
  new Promise<void>((res, rej) => {
    outputFileSystem.writeFile(file, data, (error) => {
      if (error) {
        rej(error);
      } else {
        res();
      }
    });
  });

const compileHtml = () =>
  new Promise((res, rej) => {
    fs.readFile(htmlFile, (error, data) => {
      if (error) {
        rej(error);
      } else {
        watchFile([htmlFile], compileHtml);
        output('/index.html', data).then(res);
      }
    });
  });

interface CompileScriptOptions {
  entry: string;
  callback: Function;
  outputFile?: string;
  target?: string;
}

const compileScript = async (options: CompileScriptOptions) => {
  const { entry, callback, outputFile, target } = options;
  const result = await scriptBundler(entry, target);
  if (result !== null) {
    const { deps, data } = result;
    watchFile([...deps, entry], callback);
    if (outputFile) {
      await output(outputFile, data);
    }
    return data;
  }
  return '';
};

const compileClientScript = () => {
  const options = {
    entry: clientEntry,
    callback: compileClientScript,
    outputFile: clientFile,
  };
  return compileScript(options);
};

const compileServerScript = async () => {
  const options = {
    entry: serverEntry,
    callback: compileServerScript,
    target: 'node',
  };
  const data = await compileScript(options);
  void (function effect() {
    if (serverProcess !== null) {
      serverProcess.kill();
      serverProcess = null;
    }
    serverProcess = spawn('node', ['-e', data], {
      stdio: 'inherit',
    });
  })();
};

const compile = async (compileFunction?: Function) => {
  const startTime = performance.now();
  const compileTasks = [];
  if (compileFunction === undefined) {
    compileTasks.push(compileHtml(), compileClientScript(), compileServerScript());
  } else {
    compileTasks.push(compileFunction());
  }
  await Promise.all(compileTasks);
  console.log('');
  console.log(chalk.blue(new Date().toLocaleString('zh')));
  console.log(
    `Compile successfully in ${chalk.cyan.bold(
      `${((performance.now() - startTime) / 1000).toFixed(2)}s`,
    )}`,
  );
  if (!firstSuccess) {
    firstSuccess = true;
  } else {
    ws.send('reload');
  }
};

const debounceCompile = debounce(compile, 150);

function watchFile(files: string[], callback: Function) {
  const unwatchFiles = files.reduce((acc: string[], cur) => {
    if (!watchedFiles.includes(cur)) {
      acc.push(cur);
    }
    return acc;
  }, []);

  if (unwatchFiles.length !== 0) {
    watchedFiles.push(...unwatchFiles);
    for (const bundle of unwatchFiles) {
      fs.watch(bundle, (event) => {
        if (event === 'change') {
          debounceCompile.call(compile, callback);
        }
      });
    }
  }
}

const main = async () => {
  // console.clear();
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');

  const targetURL = `http://${HOST}:${PORT}`;
  console.log(`Starting server on ${chalk.green.bold(targetURL)}`);

  const server = createServer((req, res) => {
    switch (req.url) {
      case clientFile:
        res.setHeader('Content-Type', 'text/javascript');
        outputFileSystem.createReadStream(clientFile).pipe(res);
        break;
      case '/favicon.ico':
        res.setHeader('Content-Type', 'image/x-icon');
        fs.createReadStream(iconFile).pipe(res);
        break;
      default:
        res.setHeader('Content-Type', 'text/html');
        concatStreams([
          outputFileSystem.createReadStream('/index.html'),
          fs.createReadStream(injectFile),
        ]).pipe(res);
        break;
    }
  });

  server.listen(PORT, HOST);

  server.addListener('upgrade', (request, socket, head) => {
    if (isWebSocket(request)) {
      ws = new WebSocket(request, socket, head);
    }
  });

  await compile();
  await open(targetURL);
};

process.nextTick(main);
