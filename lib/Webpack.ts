import * as fs from 'fs-extra';
import * as path from 'path';
import * as parser from '@babel/parser';
import * as babel from '@babel/core';
import traverse from '@babel/traverse';
const resolve = require('resolve').sync;

let ID = 0;

interface ModuleInfo {
  id: number;
  filePath: string;
  deps: string[];
  code: string | null | undefined;
}

interface GraphItem extends ModuleInfo {
  map?: {
    [depPath: string]: ModuleInfo['id'];
  };
}

const createModuleInfo = (filePath: string): ModuleInfo => {
  // 读取模块源代码
  const content = fs.readFileSync(filePath, 'utf-8');
  // 对源代码进行 AST 产出
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'classProperties', 'jsx'],
  });
  // 相关模块依赖数组
  const deps: string[] = [];
  // 遍历模块 AST，将依赖推入 deps 数组中
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      deps.push(node.source.value);
    },
  });

  const id = ID++;
  // 编译为 ES5
  const { code } =
    babel.transformFromAstSync(ast, '', {
      ast: true,
      filename: 'index.js',
      presets: ['@babel/preset-env', '@babel/preset-typescript'],
      plugins: [
        [
          '@babel/plugin-transform-react-jsx',
          {
            pragma: 'createElement',
          },
        ],
        '@babel/plugin-transform-typescript',
      ],
      babelrc: false,
    }) || {};

  return {
    id,
    filePath,
    deps,
    code,
  };
};

function createDependencyGraph(entry: string) {
  // 获取模块信息
  const entryInfo = createModuleInfo(entry);
  // 项目依赖树 可能多入口
  const graphArr: GraphItem[] = [entryInfo];
  // 以入口模块为起点，遍历整个项目依赖的模块，并将每个模块信息维护到 graphArr 中
  for (const graph of graphArr) {
    graph.map = {};
    for (const depPath of graph.deps) {
      const basedir = path.dirname(graph.filePath);
      const moduleDepPath = resolve(depPath, { basedir, extensions: ['.js', '.ts'] });
      const moduleInfo = createModuleInfo(moduleDepPath);
      graphArr.push(moduleInfo);
      graph.map[depPath] = moduleInfo.id;
    }
  }

  return graphArr;
}

function pack(graph: GraphItem[]) {
  const moduleArgArr = graph.map((module) => {
    return `${module.id}: {
      factory: (exports, require) => {
    ${module.code}
  }, map: ${JSON.stringify(module.map)}
  }`;
  });
  const iifeBundler = `(function(modules){
    const require = id => {
    const {factory, map} = modules[id];
    const localRequire = requireDeclarationName => require(map[requireDeclarationName]);
    const module = {exports: {}};
    factory(module.exports, localRequire);
    return module.exports;
  }
  require(0);
  })({${moduleArgArr.join()}})
  `;
  return iifeBundler;
}

const type = process.argv[2];

const entry = path.join(__dirname, '../src', `${type}/app.js`);

const graph = createDependencyGraph(entry);

const data = pack(graph);

const output = path.join(process.cwd(), `dist/main_${type}.js`);

fs.outputFile(output, data);
