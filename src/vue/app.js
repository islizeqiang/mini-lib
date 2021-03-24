import Vue from '../../lib/Vue';

const app = new Vue({
  el: '#app',
  data: {
    message: 'Hello Vue!',
  },
});

const app2 = new Vue({
  el: '#app-2',
  data: {
    message: `页面加载于 ${new Date().toLocaleString('zh')}`,
  },
});

const app5 = new Vue({
  el: '#app-5',
  data: {
    message: 'Hello Vue.js!',
  },
  methods: {
    reverseMessage() {
      this.message = this.message.split('').reverse().join('');
    },
  },
});

const app6 = new Vue({
  el: '#app-6',
  data: {
    message: 'Hello Vue!',
  },
});
