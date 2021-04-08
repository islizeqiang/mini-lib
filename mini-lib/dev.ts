import bundler from './Webpack';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as http from 'http';
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

const output = (file: string, data: string | Buffer) => {
  outputFileSystem.writeFileSync(file, data);
  if (firstSuccess) {
    firstSuccess = false;
  } else {
    console.log('');
    console.log(`${new Date().toLocaleString('zh')} Compiled successfully`);
    console.log(`Server is running on http://127.0.0.1:${port}/`);
  }
};

const updateEntryHtml = async () => {
  const data = await getHtmlData();
  output('/index.html', data);
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
          update('bundle');
        }
      });
    }
  }
};

const compile = () => {
  const { deps, data } = bundler(entryFile);
  watchBundle([...deps, entryFile]);
  output('/main.js', data);
};

function update(type: string) {
  if (type === 'html') {
    updateEntryHtml();
  } else if (type === 'bundle') {
    compile();
  }
}

const watchHtml = () => {
  fs.watch(html, (event: 'rename' | 'change') => {
    if (event === 'change') {
      update('html');
    }
  });
};

void (() => {
  updateEntryHtml();
  compile();
  watchHtml();

  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end(outputFileSystem.readFileSync('/index.html'));
    } else if (req.url === '/main.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(outputFileSystem.readFileSync('/main.js'));
    } else if (req.url === '/favicon.ico') {
      res.setHeader('Content-Type', 'image/x-icon');
      res.end(icon);
    }
  });

  server.listen(port, '127.0.0.1');
})();
