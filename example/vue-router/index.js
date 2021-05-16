import '../../lib/vue';
import VueRouter from '../../mini-lib/VueRouter';

const { Vue } = window;

const HelloWorld = {
  data() {
    return {
      hello: 'Index!',
    };
  },
  template: '<div><h1>{{ hello }}</h1><router-link to="/test">Test</router-link></div>',
};

const HelloTest = {
  template: '<div><h1>{{ hello1 }}</h1><router-link to="/index">Index</router-link></div>',

  data() {
    return {
      hello: 'Test!',
    };
  },
  mounted() {
    setTimeout(() => {
      this.hello = 'Test@@@!';
    }, 5000);
  },
  computed: {
    hello1() {
      return `${this.hello}哈哈哈`;
    },
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
