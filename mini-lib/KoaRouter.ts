import { compose } from './Koa';
import type { KoaContext } from './Koa';
import { pathToRegexp } from '../lib/path-to-regexp';

interface MethodImplement {
  (path: string, middleware: Function): Router;
}

interface MatchedRoute {
  path: Layer[];
  pathAndMethod: Layer[];
  route: boolean;
}

class Layer {
  public methods: string[];
  public stack: Function[];
  private regexp: RegExp;

  constructor(path: string, methods: string[], middleware: Function) {
    this.methods = methods.map((method) => method.toUpperCase());
    this.stack = Array.isArray(middleware) ? middleware : [middleware];
    this.regexp = pathToRegexp(path);
  }

  public match = (path: string) => this.regexp.test(path);
}

class Router {
  private stack: Layer[];

  constructor() {
    this.stack = [];
  }

  private register = (path: string, methods: string[], middleware: Function) => {
    const route = new Layer(path, methods, middleware);
    this.stack.push(route);
    return this;
  };

  private match = (path: string | undefined, method: string | undefined) => {
    const matched: MatchedRoute = {
      path: [],
      pathAndMethod: [],
      route: false,
    };
    for (const layer of this.stack) {
      if (path !== void 0 && layer.match(path)) {
        matched.path.push(layer);
        if (method !== void 0 && layer.methods.includes(method)) {
          matched.pathAndMethod.push(layer);
          matched.route = true;
        }
      }
    }
    return matched;
  };

  public allowedMethods = () => {
    return async (ctx: KoaContext, next: Function) => {
      await next();
      const {
        request: { method },
      } = ctx;
      const registerMethods = [...new Set(this.stack.map((layer) => layer.methods).flat())];
      if (method === 'OPTIONS') {
        ctx.body = '';
        ctx.response.statusCode = 200;
        ctx.response.setHeader('Allow', registerMethods.join(', '));
      }
    };
  };

  public routes = () => {
    return (ctx: KoaContext, next: Function) => {
      const {
        request: { url, method },
      } = ctx;
      const matched = this.match(url, method);
      if (!matched.route) return next();
      const layerChain = matched.pathAndMethod.map((layer) => layer.stack).flat();
      return compose(layerChain)(ctx, next);
    };
  };

  public get: MethodImplement = (path, middleware) => this.register(path, ['get'], middleware);
  public post: MethodImplement = (path, middleware) => this.register(path, ['post'], middleware);
}

export default Router;
