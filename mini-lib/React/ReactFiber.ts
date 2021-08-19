interface IdleCallback {
  (deadline: { readonly didTimeout: boolean; timeRemaining: () => number }): void;
}
declare global {
  interface Window {
    requestIdleCallback: (
      callback: IdleCallback,
      opts?: {
        timeout: number;
      },
    ) => number;
    cancelIdleCallback: (handle: number) => void;
  }
}
type Dict<T> = Record<string, T>;
interface HookContent {
  state: unknown;
  queue: unknown[];
}
type VirtualElementType = ((props: Dict<unknown>) => VirtualElement) | string;
interface VirtualElementProps {
  children?: VirtualElement[];
  [propName: string]: unknown;
}
interface VirtualElement {
  type: VirtualElementType;
  props: VirtualElementProps;
}
interface FiberNode {
  props: VirtualElementProps;
  alternate: FiberNode | null;
  type?: VirtualElementType;
  return?: FiberNode;
  dom?: Node | null;
  effectTag?: string;
  sibling?: FiberNode;
  hooks?: HookContent[];
  child?: FiberNode;
}

let wipRoot: FiberNode | null = null;
let nextUnitOfWork: FiberNode | null = null;
let currentRoot: FiberNode | null = null;
let deletions: FiberNode[] = [];
let wipFiber: FiberNode;
let hookIndex: number = 0;

const Fragment = Symbol.for('react.fragment');

const isDef = <T>(param: unknown): param is T => param !== void 0 && param !== null;

// eslint-disable-next-line @typescript-eslint/ban-types
const isObject = (obj: unknown): obj is Object =>
  obj instanceof Object && obj.constructor === Object;

void ((global: Window) => {
  const id = 1;
  const fps = 1000 / 60;
  let frameDeadline: number;
  let penddingCallback: IdleCallback;
  const channel = new MessageChannel();
  const timeRemaining = () => frameDeadline - window.performance.now();
  const deadline = {
    didTimeout: false,
    timeRemaining,
  };

  channel.port2.onmessage = () => {
    if (typeof penddingCallback === 'function') {
      penddingCallback(deadline);
    }
  };

  global.requestIdleCallback = (callback: IdleCallback) => {
    global.requestAnimationFrame((frameTime) => {
      frameDeadline = frameTime + fps;
      penddingCallback = callback;
      channel.port1.postMessage(null);
    });

    return id;
  };
})(window);

const createTextElement = (text: string): VirtualElement => ({
  type: 'TEXT',
  props: {
    nodeValue: text,
  },
});

const createElement = (
  type: VirtualElementType,
  props: Record<string, unknown> | null = {},
  ...child: (unknown | VirtualElement)[]
): VirtualElement => {
  const isVirtualElement = (e: unknown): e is VirtualElement => typeof e === 'object';
  const children = child.map((c) => (isVirtualElement(c) ? c : createTextElement(String(c))));

  return {
    type,
    props: {
      ...props,
      children,
    },
  };
};

const updateDOM = (DOM: Node, prevProps: VirtualElementProps, nextProps: VirtualElementProps) => {
  const defaultPropKeys = 'children';

  for (const [removePropKey, removePropValue] of Object.entries(prevProps)) {
    if (removePropKey.startsWith('on')) {
      DOM.removeEventListener(
        removePropKey.substr(2).toLowerCase(),
        removePropValue as EventListener,
      );
    } else if (removePropKey !== defaultPropKeys) {
      DOM[removePropKey] = '';
    }
  }

  for (const [addPropKey, addPropValue] of Object.entries(nextProps)) {
    if (addPropKey.startsWith('on')) {
      DOM.addEventListener(addPropKey.substr(2).toLowerCase(), addPropValue as EventListener);
    } else if (addPropKey !== defaultPropKeys) {
      DOM[addPropKey] = addPropValue;
    }
  }
};

const createDOM = (fiberNode: FiberNode): Node | null => {
  const { type, props } = fiberNode;
  let DOM: Node | null = null;

  if (type === 'TEXT') {
    DOM = document.createTextNode('');
  } else if (typeof type === 'string') {
    DOM = document.createElement(type);
  }

  if (DOM !== null) {
    updateDOM(DOM, {}, props);
  }

  return DOM;
};

const commitRoot = () => {
  const findParentFiber = (fiberNode?: FiberNode) => {
    if (fiberNode) {
      let parentFiber = fiberNode.return;
      while (parentFiber && !parentFiber.dom) {
        parentFiber = parentFiber.return;
      }
      return parentFiber;
    }
    return null;
  };

  const commitDeletion = (parentDOM: FiberNode['dom'], DOM: Node) => {
    if (isDef<Node>(parentDOM)) {
      parentDOM.removeChild(DOM);
    }
  };

  const commitReplacement = (parentDOM: FiberNode['dom'], DOM: Node) => {
    if (isDef<Node>(parentDOM)) {
      parentDOM.appendChild(DOM);
    }
  };

  const commitWork = (fiberNode?: FiberNode) => {
    if (fiberNode) {
      if (fiberNode.dom) {
        const parentFiber = findParentFiber(fiberNode);
        const parentDOM = parentFiber?.dom;

        switch (fiberNode.effectTag) {
          case 'REPLACEMENT':
            commitReplacement(parentDOM, fiberNode.dom);
            break;
          case 'UPDATE':
            updateDOM(
              fiberNode.dom,
              fiberNode.alternate ? fiberNode.alternate.props : {},
              fiberNode.props,
            );
            break;
          default:
            break;
        }
      }

      commitWork(fiberNode.child);
      commitWork(fiberNode.sibling);
    }
  };

  for (const deletion of deletions) {
    if (deletion.dom) {
      const parentFiber = findParentFiber(deletion);
      commitDeletion(parentFiber?.dom, deletion.dom);
    }
  }

  if (wipRoot !== null) {
    commitWork(wipRoot.child);
    currentRoot = wipRoot;
  }

  wipRoot = null;
};

const reconcileChildren = (fiberNode: FiberNode, elements: VirtualElement[] = []) => {
  let index = 0;
  let oldFiberNode: FiberNode | undefined = void 0;
  let prevSibling: FiberNode | undefined = void 0;
  const virtualElements = elements.flat(Infinity);

  if (fiberNode.alternate && fiberNode.alternate.child) {
    oldFiberNode = fiberNode.alternate.child;
  }

  while (index < virtualElements.length || typeof oldFiberNode !== 'undefined') {
    const virtualElement = virtualElements[index];
    let newFiber: FiberNode | undefined = void 0;

    const isSameType = Boolean(
      oldFiberNode && virtualElement && oldFiberNode.type === virtualElement.type,
    );

    // 类型相同 更新props
    if (isSameType && oldFiberNode) {
      newFiber = {
        type: oldFiberNode.type,
        dom: oldFiberNode.dom,
        alternate: oldFiberNode,
        props: virtualElement.props,
        return: fiberNode,
        effectTag: 'UPDATE',
      };
    }
    // 类型不同 但存在新元素
    if (!isSameType && Boolean(virtualElement)) {
      newFiber = {
        type: virtualElement.type,
        dom: null,
        alternate: null,
        props: virtualElement.props,
        return: fiberNode,
        effectTag: 'REPLACEMENT',
      };
    }
    // 类型不同 但存在老元素
    if (!isSameType && oldFiberNode) {
      deletions.push(oldFiberNode);
    }

    if (oldFiberNode) {
      oldFiberNode = oldFiberNode.sibling;
    }

    if (index === 0) {
      fiberNode.child = newFiber;
    } else if (typeof prevSibling !== 'undefined') {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index += 1;
  }
};

const performUnitOfWork = (fiberNode: FiberNode): FiberNode | null => {
  const { type } = fiberNode;
  switch (typeof type) {
    case 'function':
      wipFiber = fiberNode;
      wipFiber.hooks = [];
      hookIndex = 0;
      if (typeof Object.getPrototypeOf(type).REACT_COMPONENT !== 'undefined') {
        const C = (type as unknown) as typeof Component;
        const component = new C(fiberNode.props);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [state, setState] = useState(component.state);
        component.props = fiberNode.props;
        component.state = state;
        component.setState = setState;
        const children = component.render();
        reconcileChildren(fiberNode, [children]);
      } else {
        reconcileChildren(fiberNode, [type(fiberNode.props)]);
      }
      break;
    case 'number':
    case 'string':
      if (!fiberNode.dom) {
        fiberNode.dom = createDOM(fiberNode);
      }
      reconcileChildren(fiberNode, fiberNode.props.children);
      break;
    case 'symbol':
      if (type === Fragment) {
        reconcileChildren(fiberNode, fiberNode.props.children);
      }
      break;
    default:
      if (typeof fiberNode.props !== 'undefined') {
        reconcileChildren(fiberNode, fiberNode.props.children);
      }
      break;
  }

  if (fiberNode.child) {
    return fiberNode.child;
  }
  let nextFiberNode: FiberNode | undefined = fiberNode;
  while (typeof nextFiberNode !== 'undefined') {
    if (nextFiberNode.sibling) {
      return nextFiberNode.sibling;
    }
    nextFiberNode = nextFiberNode.return;
  }
  return null;
};

const workLoop: IdleCallback = (deadline) => {
  while (nextUnitOfWork && deadline.timeRemaining() > 1) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  window.requestIdleCallback(workLoop);
};

const render = (element: VirtualElement, container: Node) => {
  currentRoot = null;
  wipRoot = {
    type: 'div',
    dom: container,
    props: {
      children: [{ ...element }],
    },
    alternate: currentRoot,
  };
  nextUnitOfWork = wipRoot;
  deletions = [];
};

class Component {
  props: Dict<unknown>;
  state!: unknown;
  setState!: (value: unknown) => void;
  render!: () => VirtualElement;

  constructor(props: Dict<unknown>) {
    this.props = props;
  }

  static REACT_COMPONENT = true;
}

function useState(initState: unknown): [unknown, (value: unknown) => void] {
  let oldHook: undefined | HookContent;

  if (wipFiber.alternate && wipFiber.alternate.hooks) {
    // 找到之前的 hook
    oldHook = wipFiber.alternate.hooks[hookIndex];
  }

  const hook: HookContent = oldHook || {
    state: initState,
    queue: [],
  };

  const queueLength = hook.queue.length;
  for (const _ of [...Array(queueLength)]) {
    let newState = hook.queue.shift();
    if (isObject(hook.state) && isObject(newState)) {
      newState = { ...hook.state, ...newState };
    }
    hook.state = newState;
  }

  if (typeof wipFiber.hooks === 'undefined') {
    wipFiber.hooks = [];
  }

  wipFiber.hooks.push(hook);

  hookIndex += 1;

  const setState = (value: unknown) => {
    hook.queue.push(value);
    if (currentRoot) {
      wipRoot = {
        type: currentRoot.type,
        dom: currentRoot.dom,
        props: currentRoot.props,
        alternate: currentRoot,
      };
      nextUnitOfWork = wipRoot;
      deletions = [];
      currentRoot = null;
    }
  };

  return [hook.state, setState];
}

void (function main() {
  window.requestIdleCallback(workLoop);
})();

export default {
  createElement,
  render,
  useState,
  Component,
  Fragment,
};
