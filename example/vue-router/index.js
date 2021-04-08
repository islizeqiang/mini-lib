import '../../lib/vue';
import VueRouter from '../../mini-lib/VueRouter';

const { Vue } = window;

const HelloWorld = {
  data() {
    return {
      hello: 'hello-world!',
    };
  },
  template: '<div>{{ hello }}</div>',
};

const HelloTest = {
  data() {
    return {
      hello: 'hello-test!',
    };
  },
  template: '<div>{{ hello }}</div>',
};

Vue.use(VueRouter);

const routes = [
  { path: '/index', component: HelloWorld },
  { path: '/test', component: HelloTest },
];

const router = new VueRouter({
  routes,
  mode: 'hash',
});

const app = new Vue({
  router,
  el: '#app',
});
