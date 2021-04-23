'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const chalk_1 = __importDefault(require('chalk'));
const perf_hooks_1 = require('perf_hooks');
const memfs_1 = require('memfs');
const fs_1 = __importDefault(require('fs'));
const path_1 = __importDefault(require('path'));
const http_1 = require('http');
const child_process_1 = require('child_process');
const utils_1 = require('./utils');
const Webpack_1 = __importDefault(require('./Webpack'));
const open = require('open-browser');
const WebSocket = require('faye-websocket');
const outputFileSystem = memfs_1.createFsFromVolume(new memfs_1.Volume());
const entryDir = process.argv[2];
const clientEntry = path_1.default.resolve(process.cwd(), `example/${entryDir}/index.js`);
const serverEntry = path_1.default.resolve(process.cwd(), `example/${entryDir}/server.js`);
const htmlFile = path_1.default.resolve(process.cwd(), `example/${entryDir}/index.html`);
const injectFile = path_1.default.resolve(__dirname, 'injected.html');
const iconFile = path_1.default.resolve(__dirname, 'favicon.ico');
const clientFile = '/client.js';
const HOST = '127.0.0.1';
const PORT = 7000;
const watchedFiles = [];
let firstSuccess = false;
let ws;
let serverProcess = null;
const output = (file, data) =>
  new Promise((res, rej) => {
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
    fs_1.default.readFile(htmlFile, (error, data) => {
      if (error) {
        rej(error);
      } else {
        watchFile([htmlFile], compileHtml);
        output('/index.html', data).then(res);
      }
    });
  });
const compileScript = async (options) => {
  const { entry, callback, outputFile, target } = options;
  const result = await Webpack_1.default(entry, target);
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
const compileServerScript = () =>
  new Promise((res, rej) => {
    fs_1.default.access(serverEntry, (error) => {
      if (error === null) {
        const options = {
          entry: serverEntry,
          callback: compileServerScript,
          target: 'node',
        };
        compileScript(options)
          .then((data) => {
            if (serverProcess !== null) {
              serverProcess.kill();
              serverProcess = null;
            }
            serverProcess = child_process_1.spawn('node', ['-e', data], {
              stdio: 'inherit',
            });
            setTimeout(res, 100);
          })
          .catch((err) => {
            rej(err);
          });
      } else {
        res();
      }
    });
  });
const compile = async (compileFunctions) => {
  try {
    console.clear();
    console.log(chalk_1.default.blue(new Date().toLocaleString('zh')));
    const startTime = perf_hooks_1.performance.now();
    const compileTasks = [];
    if (compileFunctions === void 0) {
      compileTasks.push(compileHtml(), compileClientScript(), compileServerScript());
    } else {
      compileTasks.push(...compileFunctions.map((fn) => fn()));
    }
    await Promise.all(compileTasks);
    if (!firstSuccess) {
      firstSuccess = true;
    } else {
      ws.send('reload');
    }
    console.log();
    console.log(
      chalk_1.default.green.bold(
        `Reload Successfully in ${((perf_hooks_1.performance.now() - startTime) / 1000).toFixed(
          2,
        )}s`,
      ),
    );
  } catch (error) {
    const msg = error.stack || error.toString();
    console.log(chalk_1.default.red(`\n${msg.replace(/^/gm, '  ')}\n`));
  }
};
const debounceCompile = ((func, ms) => {
  let timeoutId;
  const callbackStack = new Set();
  return function (callback) {
    callbackStack.add(callback);
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.call(this, [...callbackStack]);
      callbackStack.clear();
    }, ms);
  };
})(compile, 150);
function watchFile(files, callback) {
  const unwatchFiles = files.reduce((acc, cur) => {
    if (!watchedFiles.includes(cur)) {
      acc.push(cur);
    }
    return acc;
  }, []);
  if (unwatchFiles.length !== 0) {
    watchedFiles.push(...unwatchFiles);
    for (const bundle of unwatchFiles) {
      fs_1.default.watch(bundle, (event) => {
        if (event === 'change') {
          debounceCompile.call(compile, callback);
        }
      });
    }
    watchedFiles.push(...unwatchFiles);
  }
}
const main = async () => {
  // console.clear();
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
  const targetURL = `http://${HOST}:${PORT}`;
  const server = http_1.createServer((req, res) => {
    switch (req.url) {
      case clientFile:
        res.setHeader('Content-Type', 'text/javascript');
        outputFileSystem.createReadStream(clientFile).pipe(res);
        break;
      case '/favicon.ico':
        res.setHeader('Content-Type', 'image/x-icon');
        fs_1.default.createReadStream(iconFile).pipe(res);
        break;
      default:
        res.setHeader('Content-Type', 'text/html');
        utils_1
          .concatStreams([
            outputFileSystem.createReadStream('/index.html'),
            fs_1.default.createReadStream(injectFile),
          ])
          .pipe(res);
        break;
    }
  });
  server.listen(PORT, HOST, () => {
    console.log(`Starting client on ${chalk_1.default.magenta(targetURL)}`);
  });
  server.addListener('upgrade', (request, socket, head) => {
    if (utils_1.isWebSocket(request)) {
      ws = new WebSocket(request, socket, head);
    }
  });
  await compile();
  await open(targetURL);
};
process.nextTick(main);
