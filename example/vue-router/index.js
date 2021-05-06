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
  template: '<div>{{ hello }}</div>',

  data() {
    return {
      hello: 'hello-test!',
    };
  },
  mounted() {
    setTimeout(() => {
      this.hello = 222;
    }, 5000);
  },
};

Vue.use(VueRouter);

const routes = [
  { path: '/', component: HelloTest },
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
