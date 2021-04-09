interface HandlerParames {
  pathname: string;
}

interface Handler {
  (arg0: HandlerParames): void;
}

const createEvents = () => {
  const handlers = new Set<Handler>();

  return {
    push(fn: Handler) {
      handlers.add(fn);
      return () => handlers.delete(fn);
    },
    call(arg: HandlerParames) {
      for (const handler of handlers.values()) {
        handler(arg);
      }
    },
  };
};

const createBrowserHistory = () => {
  const listeners = createEvents();

  window.addEventListener('popstate', () => {
    listeners.call({
      pathname: window.location.pathname,
    });
  });

  return {
    listen(listener: Handler) {
      return listeners.push(listener);
    },
    push(pathname: string) {
      // 保持统一
      window.history.pushState(null, '', pathname);
      listeners.call({
        pathname,
      });
    },
    // 默认值
    location: {
      pathname: window.location.pathname,
    },
  };
};

export default createBrowserHistory;
