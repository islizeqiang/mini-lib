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

let workInProgressRoot: FiberNode | null = null;
let nextUnitOfWork: FiberNode | null = null;
let currentRoot: FiberNode;
let deletions: FiberNode[] = [];

let wipFiber: FiberNode;
let hookIndex: number = 0;

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
  const prevPropKeys = Object.keys(prevProps);
  const nextPropKeys = Object.keys(nextProps);
  const defaultPropKeys = ['children'];

  const removePropKeys = prevPropKeys.filter(
    (key) => ![...nextPropKeys, ...defaultPropKeys].includes(key),
  );

  for (const removePropKey of removePropKeys) {
    if (removePropKey.indexOf('on') === 0) {
      const listener = prevProps[removePropKey] as EventListener;
      DOM.removeEventListener(removePropKey.substr(2).toLowerCase(), listener, false);
    } else {
      DOM[removePropKey] = '';
    }
  }

  const addPropKeys = nextPropKeys.filter((key) => !defaultPropKeys.includes(key));
  for (const addPropKey of addPropKeys) {
    if (addPropKey.indexOf('on') === 0) {
      const listener = nextProps[addPropKey] as EventListener;
      DOM.addEventListener(addPropKey.substr(2).toLowerCase(), listener, false);
    } else {
      DOM[addPropKey] = nextProps[addPropKey];
    }
  }
};

const createDOM = (fiberNode: FiberNode): Node | null => {
  const { type, props } = fiberNode;
  let DOM: Node | null = null;

  if (type === 'TEXT') {
    DOM = document.createTextNode(props.nodeValue as string);
  } else if (typeof type === 'string') {
    DOM = document.createElement(type);
  }

  if (DOM !== null) {
    updateDOM(DOM, {}, props);
  }

  return DOM;
};

const commit = () => {
  const findParentFiber = (fiberNode?: FiberNode) => {
    if (fiberNode) {
      let parentFiber = fiberNode.return;
      while (parentFiber && !parentFiber.dom) {
        parentFiber = parentFiber.return;
      }
      return parentFiber;
    }
    return void 0;
  };

  const commitDeletion = (fiberNode: FiberNode, parent: Node) => {
    if (fiberNode.dom) {
      parent.removeChild(fiberNode.dom);
    } else if (fiberNode.child) {
      commitDeletion(fiberNode.child, parent);
    }
  };

  const commitImplement = (fiberNode?: FiberNode) => {
    if (fiberNode) {
      const parentFiber = findParentFiber(fiberNode);

      switch (fiberNode.effectTag) {
        case 'REPLACEMENT':
          if (parentFiber && parentFiber.dom && fiberNode.dom) {
            parentFiber.dom.appendChild(fiberNode.dom);
          }
          break;
        case 'DELETION':
          if (parentFiber && parentFiber.dom) {
            commitDeletion(fiberNode, parentFiber.dom);
          }
          break;
        case 'UPDATE':
          if (fiberNode.dom) {
            updateDOM(
              fiberNode.dom,
              fiberNode.alternate ? fiberNode.alternate.props : {},
              fiberNode.props,
            );
          }
          break;
        default:
          break;
      }

      commitImplement(fiberNode.child);
      commitImplement(fiberNode.sibling);
    }
  };

  for (const deletion of deletions) {
    const parentFiber = findParentFiber(deletion);
    if (parentFiber && parentFiber.dom) {
      commitDeletion(deletion, parentFiber.dom);
    }
  }

  if (workInProgressRoot !== null) {
    commitImplement(workInProgressRoot.child);

    currentRoot = workInProgressRoot;
  }

  workInProgressRoot = null;
};

const reconcileChildren = (fiberNode: FiberNode, elements: VirtualElement[] = []) => {
  let index = 0;
  let oldNode: FiberNode | undefined = void 0;
  let prevSibling: FiberNode | undefined = void 0;

  if (fiberNode.alternate && fiberNode.alternate.child) {
    oldNode = fiberNode.alternate.child;
  }

  while (index < elements.length || typeof oldNode !== 'undefined') {
    const element: VirtualElement | undefined = elements[index];
    let newFiber: FiberNode | undefined = void 0;

    const isSameType = Boolean(oldNode && element && oldNode.type === element.type);

    // 类型相同 更新props
    if (isSameType && oldNode) {
      newFiber = {
        type: oldNode.type,
        dom: oldNode.dom,
        alternate: oldNode,
        props: element.props,
        return: fiberNode,
        effectTag: 'UPDATE',
      };
    }
    // 类型不同 但存在新元素
    if (!isSameType && typeof element !== 'undefined') {
      newFiber = {
        type: element.type,
        dom: null,
        alternate: null,
        props: element.props,
        return: fiberNode,
        effectTag: 'REPLACEMENT',
      };
    }
    // 类型不同 但存在老元素
    if (!isSameType && oldNode) {
      oldNode.effectTag = 'DELETION';
      deletions.push(oldNode);
    }

    if (oldNode) {
      oldNode = oldNode.sibling;
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
  if (typeof fiberNode.type === 'function') {
    // 函数组件
    wipFiber = fiberNode;
    wipFiber.hooks = [];
    hookIndex = 0;

    reconcileChildren(fiberNode, [fiberNode.type(fiberNode.props)]);
  } else {
    // class组件
    if (!fiberNode.dom) {
      fiberNode.dom = createDOM(fiberNode);
    }
    if (typeof fiberNode.props === 'undefined') {
      fiberNode.props = {
        children: [],
      };
    }
    reconcileChildren(fiberNode, fiberNode.props.children);
  }

  if (fiberNode.child) {
    return fiberNode.child;
  }
  let nextFiberNode: FiberNode | null = fiberNode;
  while (nextFiberNode !== null) {
    if (nextFiberNode.sibling) {
      return nextFiberNode.sibling;
    }
    nextFiberNode = typeof nextFiberNode.return === 'undefined' ? null : nextFiberNode.return;
  }
  return null;
};

const workLoop: IdleCallback = (deadline) => {
  while (nextUnitOfWork && deadline.timeRemaining() > 1) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }

  if (!nextUnitOfWork && workInProgressRoot) {
    commit();
  }

  window.requestIdleCallback(workLoop);
};

const render = (element: VirtualElement, container: Node) => {
  const fiberNode = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };

  workInProgressRoot = fiberNode;
  nextUnitOfWork = fiberNode;
  deletions = [];
};

const useState = (initState: unknown): [unknown, (value: unknown) => void] => {
  let oldHook: undefined | HookContent;

  if (wipFiber.alternate && wipFiber.alternate.hooks) {
    oldHook = wipFiber.alternate.hooks[hookIndex];
  }

  const hook: HookContent = {
    state: oldHook ? oldHook.state : initState,
    queue: [],
  };

  for (const action of oldHook ? oldHook.queue : []) {
    hook.state = action;
  }

  if (typeof wipFiber.hooks === 'undefined') {
    wipFiber.hooks = [];
  }

  wipFiber.hooks.push(hook);

  hookIndex += 1;

  const setState = (value: unknown) => {
    hook.queue.push(value);

    workInProgressRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = workInProgressRoot;
    deletions = [];
  };

  return [hook.state, setState];
};

class Component {
  props: Dict<unknown>;
  state!: unknown;
  setState!: (value: unknown) => void;
  render!: () => VirtualElement;

  constructor(props: Dict<unknown>) {
    this.props = props;
  }
}

const transfer = (C: typeof Component): VirtualElementType => (props) => {
  const component = new C(props);
  const [state, setState] = useState(component.state);
  component.props = props;
  component.state = state;
  component.setState = setState;
  return component.render();
};

void (function main() {
  window.requestIdleCallback(workLoop);
})();

export default {
  createElement,
  render,
  useState,
  Component,
  transfer,
};
