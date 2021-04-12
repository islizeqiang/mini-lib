import { createStore, combineReducers, applyMiddleware } from '../../mini-lib/redux';

// milk reducer
const milkState = {
  milk: 0,
};

const milkReducer = (state = milkState, action) => {
  const { milk = 0 } = state;
  switch (action.type) {
    case 'PUT_MILK':
      return { ...state, milk: milk + action.count };
    case 'TAKE_MILK':
      return { ...state, milk: milk - action.count };
    default:
      return state;
  }
};

// milk reducer
const riceState = {
  rice: 0,
};

const riceReducer = (state = riceState, action) => {
  const { rice = 0 } = state;
  switch (action.type) {
    case 'PUT_RICE':
      return { ...state, rice: rice + action.count };
    case 'TAKE_RICE':
      return { ...state, rice: rice - action.count };
    default:
      return state;
  }
};

const logger = (store) => (next) => (action) => {
  console.group('action', action.type);
  console.info('state', store.getState());
  const result = next(action);
  console.info('next state', store.getState());
  console.groupEnd();
  return result;
};

const logger2 = (store) => (next) => (action) => {
  console.log('logger2');
  const result = next(action);
  return result;
};

const reducer = combineReducers({ milkReducer, riceReducer });

const enhancer = applyMiddleware(logger, logger2);

const store = createStore(
  reducer,
  // { milkState: initMilkState, riceState: { ...initRiceState, rice: 1110 } },
  enhancer,
);

store.subscribe(() => console.log('subscribe', store.getState()));

// 派发
store.dispatch({ type: 'PUT_MILK', count: 1 }); // milk: 1
store.dispatch({ type: 'PUT_MILK', count: 1 }); // milk: 2
store.dispatch({ type: 'TAKE_MILK', count: 1 }); // milk: 1

store.dispatch({ type: 'PUT_RICE', count: 1 }); // rice: 1
store.dispatch({ type: 'PUT_RICE', count: 1 }); // rice: 2
store.dispatch({ type: 'TAKE_RICE', count: 1 });
