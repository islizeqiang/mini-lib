import '../../lib/react';
import '../../lib/react-dom';

import Router from './myReactRouter/react-router-dom/BrowserRouter';
import Route from './myReactRouter/react-router/Route';
import Switch from './myReactRouter/react-router/Switch';
import Link from './myReactRouter/react-router-dom/Link';

const Admin = () => {
  return (
    <>
      <h1>管理员页面</h1>
      <Link to="/">回首页</Link>
    </>
  );
};

const Home = () => {
  return (
    <>
      <h1>首页</h1>
      <ul>
        <li>
          <Link to="/admin">管理员</Link>
        </li>
      </ul>
    </>
  );
};

const App = () => {
  return (
    <Router>
      <Switch>
        <Route path="/admin" component={Admin} />
        <Route path="/" component={Home} />
      </Switch>
    </Router>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root'),
);
