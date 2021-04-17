import * as fs from 'fs-extra';
import * as path from 'path';
import * as parser from '@babel/parser';
import * as babel from '@babel/core';
import traverse from '@babel/traverse';
import resolve from 'resolve';

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
const cwd = process.cwd();

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
    const basedir = path.dirname(filePath);

    // 循环对应模块的依赖项
    const getTask = async (dep: string) => {
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

const main = async (entry: string) => {
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

export default main;
