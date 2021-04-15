(() => {
  const modules = {
    'app.js': {
      factory: function (exports, require) {
        'use strict';

        var _square = _interopRequireDefault(require('./square'));

        var _circle = _interopRequireDefault(require('./circle'));

        var _dep = _interopRequireDefault(require('./dep'));

        function _interopRequireDefault(obj) {
          return obj && obj.__esModule ? obj : { default: obj };
        }

        console.log('Area of square: ', (0, _square.default)(5) === _dep.default);
        console.log('Area of circle', (0, _circle.default)(5));
      },
      map: { './square': './square', './circle': './circle', './dep': './dep' },
    },
    './square': {
      factory: function (exports, require) {
        'use strict';

        Object.defineProperty(exports, '__esModule', {
          value: true,
        });
        exports.default = area;

        function area(side) {
          return side * side;
        }
      },
      map: {},
    },
    './circle': {
      factory: function (exports, require) {
        'use strict';

        Object.defineProperty(exports, '__esModule', {
          value: true,
        });
        exports.default = area;
        const PI = 3.141;

        function area(radius) {
          return PI * radius * radius;
        }
      },
      map: {},
    },
    './dep': {
      factory: function (exports, require) {
        'use strict';

        Object.defineProperty(exports, '__esModule', {
          value: true,
        });
        exports.default = void 0;

        var _square = _interopRequireDefault(require('../square'));

        function _interopRequireDefault(obj) {
          return obj && obj.__esModule ? obj : { default: obj };
        }

        var _default = (0, _square.default)(5);

        exports.default = _default;
      },
      map: { '../square': './square' },
    },
  };
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

  require('app.js');
})();
