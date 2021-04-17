import chalk from 'chalk';
import { performance } from 'perf_hooks';
import { createFsFromVolume, Volume } from 'memfs';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { debounce, isWebSocket, concatStreams } from './utils';
import scriptBundler from './Webpack';
import { nodeTarget } from './builtins';

const open = require('open');
const WebSocket = require('faye-websocket');

const outputFileSystem = createFsFromVolume(new Volume());
const entryDir = process.argv[2];

const entryFile = path.resolve(process.cwd(), `example/${entryDir}/index.js`);
const entryServerFile = path.resolve(process.cwd(), `example/${entryDir}/server.js`);
const htmlFile = path.resolve(process.cwd(), `example/${entryDir}/index.html`);
const injectFile = path.resolve(__dirname, 'injected.html');
const iconFile = path.resolve(__dirname, 'favicon.ico');

const HOST = '127.0.0.1';
const PORT = 7000;

const watchedFiles: string[] = [];
let firstSuccess = false;
let ws: WebSocket;

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
        watchFile([htmlFile]);
        output('/index.html', data).then(res);
      }
    });
  });

const compileScript = async () => {
  const { deps, data } = await scriptBundler(entryFile);
  watchFile([...deps, entryFile]);
  await output('/main.js', data);
};

const compile = async (fileExtension?: string) => {
  const startTime = performance.now();
  if (fileExtension === undefined) {
    await Promise.all([compileHtml(), compileScript()]);
  } else if (fileExtension === '.html') {
    await compileHtml();
  } else {
    await compileScript();
  }
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

const debounceCompile = debounce(compile, 100);

function watchFile(files: string[]) {
  const unwatchFiles = files.reduce((acc: string[], cur) => {
    if (!watchedFiles.includes(cur)) {
      acc.push(cur);
    }
    return acc;
  }, []);

  if (unwatchFiles.length !== 0) {
    watchedFiles.push(...unwatchFiles);
    for (const bundle of unwatchFiles) {
      fs.watch(bundle, (event, filename) => {
        if (event === 'change') {
          debounceCompile.call(compile, path.extname(filename));
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

  const server = http.createServer((req, res) => {
    switch (req.url) {
      case '/main.js':
        res.setHeader('Content-Type', 'text/javascript');
        outputFileSystem.createReadStream('/main.js').pipe(res);
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
