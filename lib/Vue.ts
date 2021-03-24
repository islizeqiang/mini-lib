type Dict<T> = Record<string | symbol, T>;

interface Config {
  el: string;
  data: Dict<unknown>;
  methods?: Record<string, VoidFunction>;
}

const effects = new Map();

let currentEffect: null | VoidFunction = null;

const applyEffect = (fn: VoidFunction) => {
  // 先赋值到currentEffect
  currentEffect = fn;
  // 执行 会执行到 proxy
  fn();
  currentEffect = null;
};

const reactive = (data: Dict<unknown>) => {
  // 都是同一个 data object
  const observed = new Proxy(data, {
    get(target, property) {
      // 如果有currentEffect
      if (currentEffect) {
        if (!effects.has(target)) {
          effects.set(target, new Map());
        }
        if (!effects.get(target).has(property)) {
          effects.get(target).set(property, new Array());
        }
        // 将回调存起来
        effects.get(target).get(property).push(currentEffect);
      }

      return target[property as string];
    },

    set(target, property, value) {
      target[property as string] = value;
      // 如果之前已经存储过 并且拥有过这个属性 则进行响应式
      if (effects.has(target) && effects.get(target).has(property)) {
        for (const effect of effects.get(target).get(property)) {
          // 执行每一个回调
          effect();
        }
      }
      return true;
    },
  });
  // 返回装饰后的对象
  return observed;
};

const isTextNode = (node: Node) => node.nodeType === Node.TEXT_NODE;

const isInputElementNode = (node: Node): node is HTMLInputElement =>
  node.nodeType === Node.ELEMENT_NODE;

class Vue {
  template: Element | null;
  data: Dict<unknown>;
  methods: Dict<() => void> = {};

  constructor(config: Config) {
    this.template = document.querySelector(config.el);
    this.data = reactive(config.data);

    if (config.methods) {
      for (const [name, value] of Object.entries(config.methods)) {
        this.methods[name] = () => {
          // 改变this指向到data
          value.apply(this.data);
        };
      }
    }

    this.traversal(this.template);
  }

  traversal(node: Element | ChildNode | null) {
    if (node !== null) {
      if (isTextNode(node)) {
        if (node.textContent && node.textContent.trim().match(/^{{([\s\S]+)}}$/)) {
          const name = RegExp.$1.trim();
          applyEffect(() => {
            node.textContent = String(this.data[name]);
          });
        }
      }

      if (isInputElementNode(node)) {
        for (const attribute of node.attributes) {
          if (attribute.name === 'v-model') {
            const name = attribute.value;
            applyEffect(() => {
              node.value = String(this.data[name]);
            });
            node.addEventListener('input', () => {
              this.data[name] = node.value;
            });
          }

          if (attribute.name.match(/^v-bind:([\s\S]+)$/)) {
            const attributeName = RegExp.$1;
            const name = attribute.value;
            applyEffect(() => {
              node.setAttribute(attributeName, String(this.data[name]));
            });
          }

          if (attribute.name.match(/^v-on:([\s\S]+)$/)) {
            const eventName = RegExp.$1;
            const fnname = attribute.value;
            node.addEventListener(eventName, this.methods[fnname]);
          }
        }
      }

      if (node.childNodes.length) {
        for (const child of node.childNodes) {
          this.traversal(child);
        }
      }
    }
  }
}

export default Vue;
