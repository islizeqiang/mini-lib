class History {
  current: string;

  constructor() {
    this.current = '';
  }
}

class VueRouter {
  mode: 'history' | 'hash';
  history: History;
  routesMap: any;

  constructor(options: any) {
    this.mode = options.mode || 'hash';
    this.history = new History();
    this.routesMap = options.routes.reduce((acc: any, cur: any) => {
      const { path, component } = cur;
      if (component) {
        acc[path] = component;
      }
      return acc;
    }, {});

    this.init();
  }

  static installed = false;

  static install(vue: any) {
    if (VueRouter.installed) return;
    VueRouter.installed = true;

    vue.mixin({
      beforeCreate() {
        if (this.$options && this.$options.router) {
          this._routerRoot = this;
          this._router = this.$options.router;
          vue.util.defineReactive(this, 'current', this._router.history);
        } else {
          this._routerRoot = this.$parent._routerRoot;
        }

        Object.defineProperty(this, '$router', {
          get() {
            return this._routerRoot._router;
          },
        });
      },
    });

    vue.component('router-view', {
      render(h: any) {
        const {
          history: { current },
          routesMap,
        } = this._self._routerRoot._router;
        return h(routesMap[current]);
      },
    });
  }

  // 加载事件监听
  init() {
    if (this.mode === 'hash') {
      if (!window.location.hash) {
        window.location.hash = '#/';
      }
      window.addEventListener('load', () => {
        this.history.current = window.location.hash.slice(1);
      });
      window.addEventListener('hashchange', () => {
        this.history.current = window.location.hash.slice(1);
      });
    } else if (this.mode === 'history') {
      if (!window.location.pathname) {
        window.location.pathname = '/';
      }
      window.addEventListener('load', () => {
        this.history.current = window.location.pathname;
      });
      window.addEventListener('popstate', () => {
        this.history.current = window.location.pathname;
      });
    }
  }
}

export default VueRouter;
