import { resolve, parse, extname } from 'path';
import { stat, createReadStream } from 'fs';
import type { KoaContext } from './Koa';
import type { Stats } from 'fs';

interface Options {
  defer?: boolean;
  maxAge?: number;
  immutable?: boolean;
}

interface ExpandOptions {
  root: string;
  index: string;
}

const getStats = (path: string) =>
  new Promise<Stats>((res, rej) => {
    stat(path, (err, data) => {
      if (err) {
        rej(err);
      } else {
        res(data);
      }
    });
  });

const send = async (
  ctx: KoaContext,
  path: string | undefined,
  opts: Options & ExpandOptions,
): Promise<boolean> => {
  if (path === void 0) return false;
  const { root, index, maxAge = 0, immutable = false } = opts;

  let requestPath: string;
  try {
    requestPath = decodeURIComponent(path.substr(parse(path).root.length));
  } catch (err) {
    throw new Error('failed to decode');
  }

  const trailingSlash = path[path.length - 1] === '/';
  if (trailingSlash && index) {
    requestPath += index;
  }
  requestPath = resolve(root, requestPath);

  const stats = await getStats(requestPath);

  const { response } = ctx;

  response.setHeader('Content-length', stats.size);

  if (typeof ctx.response.getHeader('Last-Modified') === 'undefined') {
    response.setHeader('Last-Modified', stats.mtime.toUTCString());
  }
  if (typeof ctx.response.getHeader('Cache-Control') === 'undefined') {
    const directives = [`max-age=${Math.round(maxAge / 1000)}`];
    if (immutable) {
      directives.push('immutable');
    }
    response.setHeader('Cache-Control', directives.join(','));
  }
  if (typeof ctx.response.getHeader('Content-Type') === 'undefined') {
    response.setHeader('Content-Type', extname(requestPath));
  }

  response.statusCode = 200;
  ctx.body = createReadStream(requestPath);

  return true;
};

const serve = (root: string, options: Options) => {
  const opts: Options & ExpandOptions = Object.assign(Object.create(null), options);
  opts.root = resolve(root);
  opts.index = opts.index || 'index.html';
  opts.defer = Boolean(opts.defer);

  if (!opts.defer) {
    return async (ctx: KoaContext, next: Function) => {
      let done = false;
      const {
        request: { url, method },
      } = ctx;
      if (method === 'HEAD' || method === 'GET') {
        done = Boolean(await send(ctx, url, opts));
      }
      if (!done) {
        await next();
      }
    };
  }

  return async (ctx: KoaContext, next: Function) => {
    await next();
    const {
      request: { url, method },
      body,
      response,
    } = ctx;
    if (method !== 'HEAD' && method !== 'GET') return;
    if (body !== null || response.statusCode !== 404) return;
    try {
      await send(ctx, url, opts);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }
  };
};

export default serve;
