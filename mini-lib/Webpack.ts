import path from 'path';
import fs from 'fs-extra';

import traverse from '@babel/traverse';
import { parse as babelParse } from '@babel/parser';
import { transformFromAst } from '@babel/core';
import resolve from 'resolve';

import { nodeTarget } from './builtins';

import type babel from '@babel/core';

interface ModuleInfo {
  id: string;
  filePath: string;
  deps: string[];
  code: string;
}
interface GraphItem extends ModuleInfo {
  map: Record<string, ModuleInfo['id']>;
}
type DependencyMap = Map<string, string>;

const resolveExtensions = ['.js', '.jsx', '.ts', '.tsx'];
const cwd = process.cwd().split(path.sep).join('/');
let moduleTarget: string = 'broswer';
process.env.NODE_ENV = 'development';

const generateCode = (ast: babel.types.File, filename: string): Promise<string> =>
  new Promise((res, rej) => {
    transformFromAst(
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

const createModuleInfo = async (filePath: string, fileId?: string): Promise<ModuleInfo> => {
  // 读取模块源代码
  const content = await fs.readFile(filePath, 'utf-8');
  // 对源代码进行 AST 产出
  const ast = babelParse(content, {
    sourceType: 'unambiguous',
    allowImportExportEverywhere: true,
    plugins: ['typescript', 'classProperties', 'jsx', 'dynamicImport'],
  });
  // 相关模块依赖数组
  const deps: string[] = [];
  // 遍历模块 AST，将依赖推入 deps 数组中
  traverse(ast, {
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

const resolveFile = (name: string, basedir: string): Promise<string | undefined> =>
  new Promise((res, rej) => {
    resolve(name, { basedir, extensions: resolveExtensions }, (error, result) => {
      if (error) {
        rej(rej);
      } else {
        res(result);
      }
    });
  });

const flatDependencyGraph = async (
  graphItem: GraphItem,
  dependencyMap: DependencyMap,
  graphItems: GraphItem[],
) => {
  const { deps, filePath } = graphItem;

  if (deps && deps.length !== 0) {
    // 循环对应模块的依赖项
    const getTask = async (dep: string) => {
      if (moduleTarget === 'node') {
        if (nodeTarget.includes(dep)) {
          return;
        }
      }
      const basedir = path.dirname(filePath);
      const file = await resolveFile(dep, basedir);
      if (!file) throw new Error('No file');
      // 进行格式化统一
      const depPath = file.split(path.sep).join('/');

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

const analysisDependency = async (entry: string) => {
  const exist = await fs.stat(entry);
  if (!exist) return null;
  // 获取模块信息
  const entryInfo = await createModuleInfo(entry);
  // TODO 目前仅支持单入口
  const rootGraphItem = {
    ...entryInfo,
    map: {},
  };
  const graphItems: GraphItem[] = [rootGraphItem];
  const dependencyMap: DependencyMap = new Map();

  await flatDependencyGraph(rootGraphItem, dependencyMap, graphItems);

  return { dependencyMap, graphItems };
};

const pack = (graphItems: GraphItem[]) => {
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

const main = async (entry: string, target?: string) => {
  if (target !== undefined) {
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

export default main;
