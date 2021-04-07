import bundler from './Webpack';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as http from 'http';
import { createFsFromVolume, Volume } from 'memfs';

const outputFileSystem = createFsFromVolume(new Volume());

const entryDir = process.argv[2];
const entryFile = path.resolve(process.cwd(), `${entryDir}/index.js`);
const html = path.resolve(process.cwd(), `${entryDir}/index.html`);
const watchedBundle: string[] = [];
let firstSuccess = true;

const getHtmlData = async () => {
  const htmlData = await fs.readFile(html);
  return htmlData;
};

const output = (file: string, data: string | Buffer) => {
  outputFileSystem.writeFileSync(file, data);
  if (firstSuccess) {
    firstSuccess = false;
  } else {
    console.clear();
    console.log(`${new Date().toLocaleString('zh')} Compiled successfully`);
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
  watchBundle(deps);
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
  const port = 7000;

  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end(outputFileSystem.readFileSync('/index.html'));
    } else if (req.url === '/main.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(outputFileSystem.readFileSync('/main.js'));
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Server is running on http://127.0.0.1:${port}/`);
  });
})();
