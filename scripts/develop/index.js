'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        Object.defineProperty(o, k2, {
          enumerable: true,
          get: function () {
            return m[k];
          },
        });
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const chalk_1 = __importDefault(require('chalk'));
const perf_hooks_1 = require('perf_hooks');
const memfs_1 = require('memfs');
const fs = __importStar(require('fs'));
const path = __importStar(require('path'));
const http = __importStar(require('http'));
const utils_1 = require('./utils');
const Webpack_1 = __importDefault(require('./Webpack'));
const open = require('open');
const WebSocket = require('faye-websocket');
const outputFileSystem = memfs_1.createFsFromVolume(new memfs_1.Volume());
const entryDir = process.argv[2];
const entryFile = path.resolve(process.cwd(), `example/${entryDir}/index.js`);
const htmlFile = path.resolve(process.cwd(), `example/${entryDir}/index.html`);
const injectFile = path.resolve(__dirname, 'injected.html');
const iconFile = path.resolve(__dirname, 'favicon.ico');
const HOST = '127.0.0.1';
const PORT = 7000;
const watchedFiles = [];
let firstSuccess = false;
let ws;
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
  const { deps, data } = await Webpack_1.default(entryFile);
  watchFile([...deps, entryFile]);
  await output('/main.js', data);
};
const compile = async (fileExtension) => {
  const startTime = perf_hooks_1.performance.now();
  if (fileExtension === undefined) {
    await Promise.all([compileHtml(), compileScript()]);
  } else if (fileExtension === '.html') {
    await compileHtml();
  } else {
    await compileScript();
  }
  console.log('');
  console.log(chalk_1.default.blue(new Date().toLocaleString('zh')));
  console.log(
    `Compile successfully in ${chalk_1.default.cyan.bold(
      `${((perf_hooks_1.performance.now() - startTime) / 1000).toFixed(2)}s`,
    )}`,
  );
  if (!firstSuccess) {
    firstSuccess = true;
  } else {
    ws.send('reload');
  }
};
const debounceCompile = utils_1.debounce(compile, 100);
function watchFile(files) {
  const unwatchFiles = files.reduce((acc, cur) => {
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
  await compile();
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
        utils_1
          .concatStreams([
            outputFileSystem.createReadStream('/index.html'),
            fs.createReadStream(injectFile),
          ])
          .pipe(res);
        break;
    }
  });
  server.listen(PORT, HOST);
  server.addListener('upgrade', (request, socket, head) => {
    if (utils_1.isWebSocket(request)) {
      ws = new WebSocket(request, socket, head);
    }
  });
  await open(`${HOST}:${PORT}`);
  console.log(`Server is running on ${chalk_1.default.green.bold(`http://${HOST}:${PORT}`)}`);
};
process.nextTick(main);
