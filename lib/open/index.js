'use strict';
const path = require('path');
const { spawn, execSync } = require('child_process');

const open = (target, opts) => {
  const isWsl = require('../is-wsl');

  if (typeof target !== 'string') {
    return Promise.reject(new Error('Expected a `target`'));
  }

  opts = Object.assign({ wait: true }, opts);

  let cmd;
  let appArgs = [];
  let args = [];
  const cpOpts = {};

  if (Array.isArray(opts.app)) {
    appArgs = opts.app.slice(1);
    opts.app = opts.app[0];
  }

  if (process.platform === 'darwin') {
    cmd = 'open';

    if (opts.wait) {
      args.push('-W');
    }

    if (opts.app) {
      args.push('-a', opts.app);
    }
  } else if (process.platform === 'win32' || isWsl) {
    cmd = 'cmd' + (isWsl ? '.exe' : '');
    args.push('/c', 'start', '""', '/b');
    target = target.replace(/&/g, '^&');

    if (opts.wait) {
      args.push('/wait');
    }

    if (opts.app) {
      args.push(opts.app);
    }

    if (appArgs.length > 0) {
      args = args.concat(appArgs);
    }
  } else {
    if (opts.app) {
      cmd = opts.app;
    } else {
      const useSystemXdgOpen = process.versions.electron || process.platform === 'android';
      cmd = useSystemXdgOpen ? 'xdg-open' : path.join(__dirname, 'xdg-open');
    }

    if (appArgs.length > 0) {
      args = args.concat(appArgs);
    }

    if (!opts.wait) {
      // `xdg-open` will block the process unless
      // stdio is ignored and it's detached from the parent
      // even if it's unref'd
      cpOpts.stdio = 'ignore';
      cpOpts.detached = true;
    }
  }

  args.push(target);

  if (process.platform === 'darwin' && appArgs.length > 0) {
    args.push('--args');
    args = args.concat(appArgs);
  }

  const cp = spawn(cmd, args, cpOpts);

  if (opts.wait) {
    return new Promise((resolve, reject) => {
      cp.once('error', reject);

      cp.once('close', (code) => {
        if (code > 0) {
          reject(new Error('Exited with code ' + code));
          return;
        }

        resolve(cp);
      });
    });
  }

  cp.unref();

  return Promise.resolve(cp);
};

const normalizeURLToMatch = (target) => {
  try {
    const URL = typeof global.URL === 'undefined' ? require('url').URL : global.URL;
    const url = new URL(target);
    return url.origin;
  } catch {
    return target;
  }
};

const main = (url, opts = {}, args = []) => {
  const OSX_CHROME = 'google chrome';
  const browser = 'google chrome';

  const shouldTryOpenChromiumWithAppleScript =
    process.platform === 'darwin' && (typeof browser !== 'string' || browser === OSX_CHROME);

  if (shouldTryOpenChromiumWithAppleScript) {
    const supportedChromiumBrowsers = [
      'Google Chrome',
      'Google Chrome Canary',
      'Microsoft Edge',
      'Brave Browser',
      'Vivaldi',
      'Chromium',
    ];
    for (const chromiumBrowser of supportedChromiumBrowsers) {
      try {
        execSync('ps cax | grep "' + chromiumBrowser + '"');
        execSync(
          'osascript openChrome.applescript "' + encodeURI(url) + '" "' + chromiumBrowser + '"',
          {
            cwd: __dirname,
            stdio: 'ignore',
          },
        );

        return Promise.resolve(true);
      } catch (error) {
        console.error(error);
      }
    }
  }
  if (process.platform === 'darwin' && browser === 'open') {
    browser = undefined;
  }

  if (typeof browser === 'string' && args.length > 0) {
    browser = [browser].concat(args);
  }

  const options = { app: browser, url: true, wait: false, ...opts };
  return open(url, options);
};

module.exports = main;
