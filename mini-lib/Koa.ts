import EventEmitter from 'events';
import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';

type Middleware = Function[];

interface KoaContext {
  app: Koa;
  req: IncomingMessage;
  res: ServerResponse;
  body?: unknown;
}

interface FnMiddleware {
  (context: KoaContext, next?: Function): Promise<unknown>;
}

interface Compose {
  (middleware: Middleware): FnMiddleware;
}

const compose: Compose = (middleware) => {
  if (!Array.isArray(middleware)) {
    throw new TypeError('Middleware stack must be an array!');
  }
  for (const fn of middleware) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be composed of functions!');
    }
  }
  return (context, next) => {
    let index = -1;
    return (function dispatch(i: number): Promise<unknown> {
      if (i <= index) return Promise.reject(new Error('next() called multiple times'));
      index = i;
      let fn = middleware[i];
      if (i === middleware.length) {
        if (next) {
          fn = next;
        } else {
          return Promise.resolve();
        }
      }
      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (error) {
        return Promise.reject(error);
      }
    })(0);
  };
};

class Koa extends EventEmitter {
  context: Record<string, unknown>;
  middleware: Middleware;

  constructor() {
    super();
    this.context = {};
    this.middleware = [];
  }

  public use = (fn: Function) => {
    if (typeof fn !== 'function') {
      throw new TypeError('middleware must be a function!');
    }
    this.middleware.push(fn);
    return this;
  };

  public listen = (port: number, listeningListener?: () => void) => {
    const server = createServer(this.callback);
    return server.listen(port, listeningListener);
  };

  private callback = (req: IncomingMessage, res: ServerResponse) => {
    const context = Object.create(this.context);
    context.app = this;
    context.req = req;
    context.res = res;
    return this.handleRequest(context, compose(this.middleware));
  };

  private handleRequest = (ctx: KoaContext, fnMiddleware: FnMiddleware) =>
    fnMiddleware(ctx)
      .then(() => {
        const { res } = ctx;
        const { body } = ctx;
        return res.end(body);
      })
      .catch((error) => {
        console.log('error: ', error);
      });
}

export default Koa;
