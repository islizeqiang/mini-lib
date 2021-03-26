import bundler from './Webpack';
import * as path from 'path';
import * as fs from 'fs-extra';
// import * as http from 'http';
import { createFsFromVolume, Volume } from 'memfs';
// @ts-ignore
const express = require('express');

const outputFileSystem = createFsFromVolume(new Volume());

const type = process.argv[2];
const entryFile = path.resolve(process.cwd(), `src/${type}/index.js`);
const html = path.resolve(process.cwd(), `src/${type}/index.html`);

const watchedBundle: string[] = [];

const getHtmlData = async () => {
  const htmlData = await fs.readFile(html);
  console.log('htmlData: ', htmlData);
  return htmlData;
};

const compile = () => {
  const { deps, data } = bundler(entryFile);
  watchBundle(deps);
  outputFileSystem.writeFileSync('/main.js', data);
};

const updateEntryHtml = async () => {
  const htmlData = await getHtmlData();
  outputFileSystem.writeFileSync('/index.html', htmlData);
};

const update = (type: string) => {
  if (type === 'html') {
    updateEntryHtml();
  } else if (type === 'bundle') {
    compile();
  }
};

const watchHtml = () => {
  fs.watch(html, (event: 'rename' | 'change') => {
    if (event === 'change') {
      update('html');
    }
  });
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

void (() => {
  updateEntryHtml();
  compile();
  watchHtml();

  const app = express();

  // app.get('/', (req, res) => {
  //   res.setHeader('Content-Type', 'text/html');
  //   res.send(outputFileSystem.readFileSync('/index.html'));
  // });

  // app.get('/main.js', (req, res) => {
  //   res.setHeader('Content-Type', 'text/javascript');
  //   res.send(outputFileSystem.readFileSync('/main.js'));
  // });

  // app.listen(7000);
})();
