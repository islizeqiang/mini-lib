/* eslint-disable guard-for-in */
const RENDER_TO_DOM = Symbol('render to dom');

type Dict<T> = Record<string | symbol, T>;

interface ComponentClass {
  new (props?: Dict<unknown>, context?: any): Component;
}

interface Attributes extends Dict<unknown> {
  key?: string | number | null;
}

type ReactNode = ElementWrapper | TextWrapper;

const deepClone = (obj: Dict<unknown>, hash = new WeakMap()) => {
  // 如果是Date 特殊处理
  if (obj instanceof Date) return new Date(obj);
  // 如果是RegExp 特殊处理
  if (obj instanceof RegExp) return new RegExp(obj);
  // 如果hash中含有 则直接返回
  if (hash.has(obj)) return hash.get(obj);
  // 获取所有的key value
  const allDesc = Object.getOwnPropertyDescriptors(obj);
  // 仅浅复制了一份
  const cloneObj = Object.create(Object.getPrototypeOf(obj), allDesc);
  // 存到hash中一份 解决循环引用问题
  hash.set(obj, cloneObj);
  // 深克隆一份
  for (const key of Reflect.ownKeys(obj)) {
    const value = obj[key as string];
    if (value instanceof Object) {
      // 仅处理Object类型
      cloneObj[key] = deepClone(value as Dict<unknown>, hash);
    } else {
      cloneObj[key] = value;
    }
  }

  return cloneObj;
};

const replaceContent = (range: Range, node: Node) => {
  range.insertNode(node);
  range.setStartAfter(node);
  range.deleteContents();

  range.setStartBefore(node);
  range.setEndAfter(node);
};

const isTextWrapper = (node: ReactNode): node is TextWrapper => node.type === '#text';

const isElementWrapper = (node: ReactNode): node is ElementWrapper => node.type !== '#text';

export class Component {
  props: Dict<unknown>;
  children: ReactNode[];
  _range: null | Range;
  type: string;

  _root!: null;
  state!: Dict<unknown>;
  render!: () => ReactNode;
  _vdom!: ReactNode;

  constructor(type?: string) {
    this.type = type || '';
    this.props = Object.create(null);
    this.children = [];
    this._root = null;
    this._range = null;
  }

  setAttribute(name: string, value: unknown) {
    this.props[name] = value;
  }

  appendChild(child: ReactNode) {
    this.children.push(child);
  }

  get vdom() {
    return this.render().vdom;
  }

  [RENDER_TO_DOM](range: Range) {
    this._range = range;
    this._vdom = this.vdom;
    this._vdom[RENDER_TO_DOM](range);
  }

  setState(newState: Dict<unknown>) {
    if (this.state === null || typeof this.state !== 'object') {
      this.state = newState;
      // this.rerender();
      return;
    }

    this.state = { ...this.state, ...deepClone(newState) };

    this.update();
  }

  update() {
    const isSameNode = (oldNode: ReactNode, newNode: ReactNode) => {
      if (oldNode.type !== newNode.type) {
        return false;
      }

      for (const name in newNode.props) {
        if (newNode.props[name] !== oldNode.props[name]) {
          return false;
        }
      }

      if (Object.keys(oldNode.props).length > Object.keys(newNode.props).length) {
        return false;
      }

      if (isTextWrapper(newNode) && isTextWrapper(oldNode)) {
        if (newNode.content !== oldNode.content) {
          return false;
        }
      }

      return true;
    };

    const update = (oldNode: ReactNode, newNode: ReactNode) => {
      if (!isSameNode(oldNode, newNode)) {
        if (oldNode._range !== null) {
          newNode[RENDER_TO_DOM](oldNode._range);
        }
        return;
      }

      newNode._range = oldNode._range;

      if (isElementWrapper(newNode) && isElementWrapper(oldNode)) {
        const newChildren = newNode.vchildren;
        const oldChildren = oldNode.vchildren;

        if (!newChildren || !newChildren.length) {
          return;
        }

        let tailRange = oldChildren[oldChildren.length - 1]._range;

        for (let i = 0; i < newChildren.length; i += 1) {
          const newChild = newChildren[i];
          const oldChild = oldChildren[i];

          if (i < oldChildren.length) {
            update(oldChild, newChild);
          } else if (tailRange !== null) {
            const range = document.createRange();
            range.setStart(tailRange.endContainer, tailRange.endOffset);
            range.setEnd(tailRange.endContainer, tailRange.endOffset);
            newChild[RENDER_TO_DOM](range);
            tailRange = range;
            // TODO
          }
        }
      }
    };

    const { vdom } = this;
    update(this._vdom, vdom);
    this._vdom = vdom;
  }
}

class ElementWrapper extends Component {
  type: string;

  vchildren!: ReactNode[];

  constructor(type: string) {
    super(type);
    this.type = type;
  }

  get vdom() {
    this.vchildren = this.children.map((child) => child.vdom);
    return this;
  }

  [RENDER_TO_DOM](range: Range) {
    this._range = range;

    const root = document.createElement(this.type);

    for (const name in this.props) {
      const value = this.props[name];
      if (name.match(/^on([\s\S]+)$/)) {
        const eventName = RegExp.$1.replace(/^[\s\S]/, (c) => c.toLowerCase());
        root.addEventListener(eventName as keyof HTMLElementEventMap, value as VoidFunction);
      } else if (name === 'className') {
        root.setAttribute('class', value as string);
      } else {
        root.setAttribute(name, value as string);
      }
    }

    if (!this.vchildren) {
      this.vchildren = this.children.map((child) => child.vdom);
    }

    for (const child of this.vchildren) {
      const childRange = document.createRange();
      childRange.setStart(root, root.childNodes.length);
      childRange.setEnd(root, root.childNodes.length);
      child[RENDER_TO_DOM](childRange);
    }

    replaceContent(range, root);
  }
}

class TextWrapper extends Component {
  content: string;

  constructor(content: string) {
    super(content);
    this.type = '#text';
    this.content = content;
  }

  get vdom() {
    return this;
  }

  [RENDER_TO_DOM](range: Range) {
    this._range = range;
    const root = document.createTextNode(this.content);
    replaceContent(range, root);
  }
}

export function createElement(
  type: ComponentClass | string,
  attributes: Attributes,
  ...children: ReactNode[]
) {
  let e: Component;

  if (typeof type === 'string') {
    e = new ElementWrapper(type);
  } else {
    // eslint-disable-next-line new-cap
    e = new type();
  }

  for (const p in attributes) {
    e.setAttribute(p, attributes[p]);
  }

  void (function insertChildren(childs) {
    for (let child of childs) {
      if (typeof child === 'object' && child instanceof Array) {
        insertChildren(child);
      } else {
        if (typeof child === 'string') {
          child = new TextWrapper(child);
        } else if (child === null) {
          // eslint-disable-next-line no-continue
          continue;
        }
        e.appendChild(child);
      }
    }
  })(children);

  return e;
}

export const render = (component: ComponentClass, parentElement: HTMLElement) => {
  const range = document.createRange();
  range.setStart(parentElement, 0);
  range.setEnd(parentElement, parentElement.childNodes.length);
  range.deleteContents();
  component[RENDER_TO_DOM](range);
};
