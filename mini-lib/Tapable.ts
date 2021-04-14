/* eslint-disable no-new-func */
type HookArguments = string[];
type CallbackFunction = (...args: any[]) => unknown;
type HookCallback = CallbackFunction;

interface OnResult<Result> {
  (result: Result, next: () => string): string;
}

interface HookCodeOptions {
  arguments: HookArguments;
  onResult?: OnResult<any>;
}

class Hook {
  taps: HookCallback[];

  constructor() {
    this.taps = [];
  }

  tap = (name: string, fn: HookCallback) => {
    this.taps.push(fn);
  };
}

class HookCodeFactory {
  argumentString: string;
  onResult: OnResult<any> | undefined;

  constructor(options: HookCodeOptions) {
    this.argumentString = options.arguments.join(',');
    this.onResult = options.onResult;
  }

  create = (taps: HookCallback[]) => {
    const { onResult, argumentString } = this;
    let content = '';

    if (onResult) {
      const { length: totalLength } = taps;
      let i = 0;

      const next = () => {
        if (i === totalLength) return '';
        const index = i;
        i += 1;
        const result = `_result${index}`;
        return `const ${result} = taps[${index}](${argumentString});
        ${onResult(result, next)};`;
      };

      content = next();
    } else {
      content = taps.map((_, index) => `taps[${index}](${argumentString});`).join('\r\n');
    }

    const fn = new Function(
      argumentString,
      `"use strict";
      const taps = this.taps;
      ${content}
    `,
    );

    // console.log('fn: ', fn.toString());

    return fn;
  };
}

export class SyncHook extends Hook {
  compileFactory: HookCodeFactory;

  constructor(args: HookArguments = []) {
    super();
    this.compileFactory = new HookCodeFactory({
      arguments: args,
    });
  }

  call = (...args: unknown[]) => {
    const _call = this.compileFactory.create(this.taps);
    return _call.apply(this, args);
  };
}

export class SyncBailHook extends Hook {
  compileFactory: HookCodeFactory;

  constructor(args: HookArguments = []) {
    super();

    const onResult: OnResult<unknown> = (result, next) =>
      `if (${result} !== undefined) {
          return ${result}
        } else {
          ${next()}
        }`;

    this.compileFactory = new HookCodeFactory({
      arguments: args,
      onResult,
    });
  }

  call = (...args: unknown[]) => {
    const _call = this.compileFactory.create(this.taps);
    return _call.apply(this, args);
  };
}
