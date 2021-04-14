import { SyncHook, SyncBailHook } from '../../mini-lib/Tapable';

const testSyncHook = () => {
  // 实例化一个加速的hook
  const accelerate = new SyncHook(['newSpeed']);

  // 注册第一个回调，加速时记录下当前速度
  accelerate.tap('LoggerPlugin', (newSpeed) => {
    console.log('LoggerPlugin', `加速到${newSpeed}`);
  });

  // 再注册一个回调，用来检测是否超速
  accelerate.tap('OverspeedPlugin', (newSpeed) => {
    if (newSpeed > 120) {
      console.log('OverspeedPlugin', '您已超速！！');
    }
  });

  accelerate.tap('DamagePlugin', (newSpeed) => {
    if (newSpeed > 300) {
      console.log('DamagePlugin', '速度实在太快，车子快散架了。。。');
    }
  });

  // 触发一下加速事件，看看效果吧
  console.log('accelerate.call(500): ', accelerate.call(500));

  setTimeout(() => {
    accelerate.tap('DamagePlugin11', (newSpeed) => {
      console.log('newSpeed: ', newSpeed);
      if (newSpeed > 500) {
        console.log('1111', '速度实在太快，车子快散架了。。。');
      }
    });
    accelerate.call(600);
  }, 1000);
};

const testSyncBailHook = () => {
  const accelerate = new SyncBailHook(['newSpeed']);

  accelerate.tap('LoggerPlugin', (newSpeed) => console.log('LoggerPlugin', `加速到${newSpeed}`));

  // 再注册一个回调，用来检测是否超速
  // 如果超速就返回一个错误
  accelerate.tap('OverspeedPlugin', (newSpeed) => {
    if (newSpeed > 550) {
      console.log('OverspeedPlugin', '您已超速！！');
      return new Error('您已超速！！');
    }
  });

  // 由于上一个回调返回了一个不为undefined的值
  // 这个回调不会再运行了
  accelerate.tap('DamagePlugin', (newSpeed) => {
    if (newSpeed > 300) {
      console.log('DamagePlugin', '速度实在太快，车子快散架了。。。');
    }
  });

  console.log('accelerate.call(500): ', accelerate.call(500));

  setTimeout(() => {
    accelerate.tap('DamagePlugin11', (newSpeed) => {
      if (newSpeed > 500) {
        console.log('我是1秒后', '速度实在太快，车子快散架了。。。');
      }
    });

    console.log('accelerate.call(600): ', accelerate.call(600));
  }, 1000);
};

// testSyncHook();
testSyncBailHook();
