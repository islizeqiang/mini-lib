import bundler from './Webpack';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as http from 'http';
import { performance } from 'perf_hooks';
import chalk from 'chalk';
import { createFsFromVolume, Volume } from 'memfs';

const outputFileSystem = createFsFromVolume(new Volume());
const entryDir = process.argv[2];
const entryFile = path.resolve(process.cwd(), `example/${entryDir}/index.js`);
const html = path.resolve(process.cwd(), `example/${entryDir}/index.html`);
const icon = fs.readFileSync(path.resolve(process.cwd(), 'favicon.ico'));

const watchedBundle: string[] = [];
let firstSuccess = true;
const port = 7000;

const getHtmlData = async () => {
  const htmlText = await fs.readFile(html);
  const scriptText = Buffer.from('<script src="main.js"></script>');
  return Buffer.concat([htmlText, scriptText]);
};

const output = (file: string, data: string | Buffer, startTime: number) => {
  outputFileSystem.writeFileSync(file, data);
  if (firstSuccess) {
    firstSuccess = false;
  } else {
    console.log('');
    console.log(chalk.blue(new Date().toLocaleString('zh')));
    console.log(
      `Compiled successfully in ${chalk.cyan.bold(
        `${((performance.now() - startTime) / 1000).toFixed(2)}s`,
      )}`,
    );
    console.log(`Server is running on ${chalk.green.bold(`http://127.0.0.1:${port}/`)}`);
  }
};

const watchBundle = (deps: string[]) => {
  const unwatchBundle = deps.reduce((acc: string[], cur) => {
    if (!watchedBundle.includes(cur)) {
      acc.push(cur);
    }
    return acc;
  }, []);

  if (unwatchBundle.length !== 0) {
    watchedBundle.push(...deps);
    for (const bundle of unwatchBundle) {
      fs.watch(bundle, (event: 'rename' | 'change') => {
        if (event === 'change') {
          compile();
        }
      });
    }
  }
};

async function compile() {
  const startTime = performance.now();
  const { deps, data } = await bundler(entryFile);
  watchBundle([...deps, entryFile]);
  output('/main.js', data, startTime);
}

const updateEntryHtml = async () => {
  const startTime = performance.now();
  const data = await getHtmlData();
  output('/index.html', data, startTime);
};

const watchHtml = () => {
  fs.watch(html, (event: 'rename' | 'change') => {
    if (event === 'change') {
      updateEntryHtml();
    }
  });
};

void (async () => {
  updateEntryHtml();
  watchHtml();
  await compile();

  const server = http.createServer((req, res) => {
    switch (req.url) {
      case '/main.js':
        res.setHeader('Content-Type', 'text/javascript');
        res.end(outputFileSystem.readFileSync('/main.js'));
        break;
      case '/favicon.ico':
        res.setHeader('Content-Type', 'image/x-icon');
        res.end(icon);
        break;
      default:
        res.setHeader('Content-Type', 'text/html');
        res.end(outputFileSystem.readFileSync('/index.html'));
    }
  });

  server.listen(port, '127.0.0.1');
})();
