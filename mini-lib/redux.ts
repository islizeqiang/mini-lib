type VoidFunction = () => void;
type Dict<T> = Record<string | symbol, T>;
type State = Dict<unknown>;
interface Action extends Dict<unknown> {
  type: 'string';
}
type Reducer<S = unknown> = (state: S | undefined, action: Action) => State;
type Reducers = Record<string, Reducer>;
type Dispatch = (action: Action) => void;
interface MiddlewareAPI {
  dispatch: Dispatch;
  getState: () => State;
}
interface Store extends MiddlewareAPI {
  subscribe: (callback: VoidFunction) => void;
}
type Enhancer = (createStore: CreateStore) => (reducer: Reducer) => Store;
type CreateStore = (reducer: Reducer, enhancer?: Enhancer) => Store;
type Middleware = (store: MiddlewareAPI) => (next: Dispatch) => (action: Action) => void;
type ApplyMiddleware = (...middlewares: Middleware[]) => Enhancer;

// utils
const compose = (...funcs: Function[]) =>
  funcs.reduce(
    (a, b) =>
      (...args: unknown[]) =>
        a(b(...args)),
  );

//* 创建store
export const createStore: CreateStore = (reducer, enhancer) => {
  if (enhancer && typeof enhancer === 'function') {
    // 返回增强版store
    return enhancer(createStore)(reducer);
  }

  let state: State;
  const listeners: VoidFunction[] = [];

  const subscribe = (callback: VoidFunction) => {
    listeners.push(callback);
  };

  const dispatch: Dispatch = (action: Action) => {
    state = reducer(state, action);
    for (const listener of listeners) {
      listener();
    }
  };

  const getState = () => state;

  const store = {
    subscribe,
    dispatch,
    getState,
  };

  return store;
};

//* 结合reducers
export const combineReducers =
  (reducers: Reducers) =>
  (state: State = {}, action: Action) => {
    const nextState = {};
    for (const [key, reducer] of Object.entries(reducers)) {
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);
      nextState[key] = nextStateForKey;
    }
    return nextState;
  };

//* 添加中间件
export const applyMiddleware: ApplyMiddleware =
  (...middlewares) =>
  (create) =>
  (reducer) => {
    const store = create(reducer);
    const chain = middlewares.map((middleware) => middleware(store));
    // 增强dispatch
    return { ...store, dispatch: compose(...chain)(store.dispatch) };
  };
