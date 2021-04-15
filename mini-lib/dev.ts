import chalk from 'chalk';
import { performance } from 'perf_hooks';
import { createFsFromVolume, Volume } from 'memfs';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as http from 'http';
import scriptBundler from './Webpack';

const outputFileSystem = createFsFromVolume(new Volume());
const entryDir = process.argv[2];
const entryFile = path.resolve(process.cwd(), `example/${entryDir}/index.js`);
const html = path.resolve(process.cwd(), `example/${entryDir}/index.html`);
const scriptText = Buffer.from('<script src="main.js"></script>');
const port = 7000;

const watchedFiles: string[] = [];

const debounce = <T extends Function, V extends unknown[]>(func: T, ms: number) => {
  let timeoutId: NodeJS.Timeout;
  return function (this: T, ...args: V) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), ms);
  };
};

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

const compileHtml = async () => {
  const htmlText = await fs.readFile(html);
  const data = Buffer.concat([htmlText, scriptText]);
  watchFile([html]);
  await output('/index.html', data);
};

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

void (async () => {
  await compile();

  const server = http.createServer((req, res) => {
    switch (req.url) {
      case '/main.js':
        res.setHeader('Content-Type', 'text/javascript');
        outputFileSystem.createReadStream('/main.js').pipe(res);
        break;
      case '/favicon.ico':
        res.setHeader('Content-Type', 'image/x-icon');
        fs.createReadStream(path.resolve(process.cwd(), 'favicon.ico')).pipe(res);
        break;
      default:
        res.setHeader('Content-Type', 'text/html');
        outputFileSystem.createReadStream('/index.html').pipe(res);
        break;
    }
  });

  server.listen(port, '127.0.0.1');
  console.log(`Server is running on ${chalk.green.bold(`http://127.0.0.1:${port}/`)}`);
})();
