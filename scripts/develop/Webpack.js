'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const path_1 = __importDefault(require('path'));
const fs_extra_1 = __importDefault(require('fs-extra'));
const traverse_1 = __importDefault(require('@babel/traverse'));
const parser_1 = require('@babel/parser');
const core_1 = require('@babel/core');
const resolve_1 = __importDefault(require('resolve'));
const builtins_1 = require('./builtins');
const resolveExtensions = ['.js', '.jsx', '.ts', '.tsx'];
const cwd = process.cwd().split(path_1.default.sep).join('/');
let moduleTarget = 'broswer';
process.env.NODE_ENV = 'development';
const generateCode = (ast, filename) =>
  new Promise((res, rej) => {
    core_1.transformFromAst(
      ast,
      void 0,
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
  const content = await fs_extra_1.default.readFile(filePath, 'utf-8');
  // 对源代码进行 AST 产出
  const AST = parser_1.parse(content, {
    sourceType: 'unambiguous',
    allowImportExportEverywhere: true,
    plugins: ['typescript', 'classProperties', 'jsx', 'dynamicImport'],
  });
  // 相关模块依赖数组
  const deps = [];
  // 遍历模块 AST，将依赖推入 deps 数组中
  traverse_1.default(AST, {
    ImportDeclaration: ({ node }) => {
      deps.push(node.source.value);
    },
  });
  const id = `'${fileId || path_1.default.basename(filePath)}'`;
  // 编译为 ES5
  const code = await generateCode(AST, id);
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
    // 循环对应模块的依赖项
    const getTask = async (dep) => {
      if (moduleTarget === 'node') {
        if (builtins_1.nodeTarget.includes(dep)) {
          return;
        }
      }
      const basedir = path_1.default.dirname(filePath);
      const file = await resolveFile(dep, basedir);
      if (!file) throw new Error('No file');
      // 进行格式化统一
      const depPath = file.split(path_1.default.sep).join('/');
      const existedDep = dependencyMap.get(depPath);
      if (existedDep === void 0) {
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
  const exist = await fs_extra_1.default.stat(entry);
  if (!exist) return null;
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
    .map(
      (graphItem) => `${graphItem.id}: {
            factory: function (exports, require) { ${graphItem.code} },
            map: ${JSON.stringify(graphItem.map)},
          }
        `,
    )
    .join(',');
  const iifeBundler = `(() => {
    const modules = { ${modules} };
    const moduleCache = {};
    const _require = (moduleId) => {
      const cachedModule = moduleCache[moduleId];
      if (cachedModule !== void 0) {
        return cachedModule.exports;
      }
      const { factory, map } = modules[moduleId];
      const __require = (declarationName) =>
        Boolean(map[declarationName]) ? _require(map[declarationName]) : require(declarationName);
      const module = {
        exports: {},
      };
      moduleCache[moduleId] = module;
      factory.call(module.exports, module.exports, __require);
      return module.exports;
    };
    _require(${graphItems[0].id});
  })()
  `;
  return iifeBundler;
};
const main = async (entry, target) => {
  if (target !== void 0) {
    moduleTarget = target;
  }
  const analysisResult = await analysisDependency(entry);
  if (analysisResult !== null) {
    const { dependencyMap, graphItems } = analysisResult;
    const data = pack(graphItems);
    return { deps: [...dependencyMap.keys()], data };
  }
  return null;
};
// void (async function test() {
//   const entryDir = path.join(process.cwd(), 'example', 'webpack-test');
//   const entry = path.join(entryDir, 'app.js');
//   const output = path.join(entryDir, `app.out.js`);
//   const { graphItems } = await analysisDependency(entry);
//   fs.outputFile(output, pack(graphItems));
// })();
exports.default = main;
