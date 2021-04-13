import * as fs from 'fs-extra';
import * as path from 'path';
import * as parser from '@babel/parser';
import * as babel from '@babel/core';
import traverse from '@babel/traverse';

const resolve = require('resolve').sync;

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

process.env.NODE_ENV = 'development';

const generateCode = (ast: babel.types.File, filename: string): Promise<string> =>
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
                esmodules: true,
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
  const ast = parser.parse(content, {
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

const flatDependencyGraph = async (
  graphItem: GraphItem,
  dependencyMap: DependencyMap,
  graphItems: GraphItem[],
) => {
  const { deps, filePath } = graphItem;
  if (deps && deps.length !== 0) {
    const basedir = path.dirname(filePath);

    // 循环对应模块的依赖项
    const getTask = async (dep: string) => {
      const depPath = String(resolve(dep, { basedir, extensions: ['.js', '.jsx', '.ts', '.tsx'] }));
      const existedDep = dependencyMap.get(depPath);
      if (existedDep === undefined) {
        dependencyMap.set(depPath, dep);
        graphItem.map[dep] = dep;
        const moduleInfo = await createModuleInfo(depPath, dep);

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
          factory: function (exports, require) { ${module.code}},
          map: ${JSON.stringify(module.map)}
        }`;
    })
    .join();
  const iifeBundler = `(() => {
    const modules = { ${modules} };
    const cache = {};
    const require = (moduleId) => {
      const localRequire = (requireDeclarationName) => require(map[requireDeclarationName]);

      const cacheModule = cache[moduleId];
      if (cacheModule !== undefined) {
        return cacheModule.exports;
      }
      cache[moduleId] = {
        exports: {},
      };
      const module = cache[moduleId];

      const { factory, map } = modules[moduleId];
      factory.call(module.exports, module.exports, localRequire);

      return module.exports;
    };

    require(${graphItems[0].id});
  })()
  `;
  return iifeBundler;
};

const main = async (entry: string) => {
  const { dependencyMap, graphItems } = await analysisDependency(entry);
  const data = pack(graphItems);
  return { deps: [...dependencyMap.keys()], data };
};

// const entryDir = path.join(process.cwd(), 'example', 'webpack-test');
// const entry = path.join(entryDir, 'app.js');
// const output = path.join(entryDir, `app.out.js`);
// const { graphItems } = analysisDependency(entry);

// fs.outputFile(output, pack(graphItems));

export default main;
