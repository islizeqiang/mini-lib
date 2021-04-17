'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        Object.defineProperty(o, k2, {
          enumerable: true,
          get: function () {
            return m[k];
          },
        });
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const fs = __importStar(require('fs-extra'));
const path = __importStar(require('path'));
const parser = __importStar(require('@babel/parser'));
const babel = __importStar(require('@babel/core'));
const traverse_1 = __importDefault(require('@babel/traverse'));
const resolve_1 = __importDefault(require('resolve'));
const resolveExtensions = ['.js', '.jsx', '.ts', '.tsx'];
const cwd = process.cwd();
process.env.NODE_ENV = 'development';
const generateCode = (ast, filename) =>
  new Promise((res, rej) => {
    babel.transformFromAst(
      ast,
      undefined,
      {
        ast: true,
        comments: false,
        filename,
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                node: '15',
              },
            },
          ],
          '@babel/preset-typescript',
        ],
        plugins: [
          [
            '@babel/plugin-transform-react-jsx',
            // {
            //   pragma: 'createElement',
            // },
          ],
          '@babel/plugin-transform-typescript',
        ],
        babelrc: false,
      },
      (error, result) => {
        if (error) {
          rej(error);
        }
        if (result) {
          res(result.code || '');
        }
        res('');
      },
    );
  });
const createModuleInfo = async (filePath, fileId) => {
  // 读取模块源代码
  const content = await fs.readFile(filePath, 'utf-8');
  // 对源代码进行 AST 产出
  const ast = parser.parse(content, {
    sourceType: 'unambiguous',
    allowImportExportEverywhere: true,
    plugins: ['typescript', 'classProperties', 'jsx', 'dynamicImport'],
  });
  // 相关模块依赖数组
  const deps = [];
  // 遍历模块 AST，将依赖推入 deps 数组中
  traverse_1.default(ast, {
    ImportDeclaration: ({ node }) => {
      deps.push(node.source.value);
    },
  });
  const id = `'${fileId || path.basename(filePath)}'`;
  // 编译为 ES5
  const code = await generateCode(ast, id);
  return {
    id,
    filePath,
    deps,
    code,
  };
};
const resolveFile = (name, basedir) =>
  new Promise((res, rej) => {
    resolve_1.default(name, { basedir, extensions: resolveExtensions }, (error, result) => {
      if (error) {
        rej(rej);
      } else {
        res(result);
      }
    });
  });
const flatDependencyGraph = async (graphItem, dependencyMap, graphItems) => {
  const { deps, filePath } = graphItem;
  if (deps && deps.length !== 0) {
    const basedir = path.dirname(filePath);
    // 循环对应模块的依赖项
    const getTask = async (dep) => {
      const depPath = await resolveFile(dep, basedir);
      if (!depPath) throw new Error('No file');
      const existedDep = dependencyMap.get(depPath);
      if (existedDep === undefined) {
        const fileId = depPath.replace(cwd, '.');
        dependencyMap.set(depPath, fileId);
        graphItem.map[dep] = fileId;
        const moduleInfo = await createModuleInfo(depPath, fileId);
        const depGraphItem = {
          ...moduleInfo,
          map: {},
        };
        await flatDependencyGraph(depGraphItem, dependencyMap, graphItems);
        graphItems.push(depGraphItem);
      } else {
        graphItem.map[dep] = existedDep;
      }
    };
    await Promise.all(deps.map((dep) => getTask(dep)));
  }
};
const analysisDependency = async (entry) => {
  // 获取模块信息
  const entryInfo = await createModuleInfo(entry);
  // TODO 目前仅支持单入口
  const rootGraphItem = {
    ...entryInfo,
    map: {},
  };
  const graphItems = [rootGraphItem];
  const dependencyMap = new Map();
  await flatDependencyGraph(rootGraphItem, dependencyMap, graphItems);
  return { dependencyMap, graphItems };
};
const pack = (graphItems) => {
  const modules = graphItems
    .map((module) => {
      return `${module.id}: {
          factory: function (exports, require) { ${module.code} },
          map: ${JSON.stringify(module.map)}
        }`;
    })
    .join();
  const iifeBundler = `(() => {
    const modules = { ${modules} };
    const cache = {};
    const _require = (moduleId) => {
      const __require = (requireDeclarationName) => {
        const localModule = map[requireDeclarationName];
        return localModule ? _require(localModule) : require(requireDeclarationName);
      };
      const cacheModule = cache[moduleId];
      if (cacheModule !== undefined) {
        return cacheModule.exports;
      }
      cache[moduleId] = {
        exports: {},
      };
      const module = cache[moduleId];
      const { factory, map } = modules[moduleId];
      factory.call(module.exports, module.exports, __require);
      return module.exports;
    };
    _require(${graphItems[0].id});
  })()
  `;
  return iifeBundler;
};
const main = async (entry) => {
  const { dependencyMap, graphItems } = await analysisDependency(entry);
  const data = pack(graphItems);
  return { deps: [...dependencyMap.keys()], data };
};
// void (async function test() {
//   const entryDir = path.join(process.cwd(), 'example', 'webpack-test');
//   const entry = path.join(entryDir, 'app.js');
//   const output = path.join(entryDir, `app.out.js`);
//   const { graphItems } = await analysisDependency(entry);
//   fs.outputFile(output, pack(graphItems));
// })();
exports.default = main;
