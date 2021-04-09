import '../../lib/react';
import '../../lib/react-dom';

import {
  BrowserRouter as Router,
  Link,
  Switch,
  Route,
} from '../../mini-lib/ReactRouter/react-router-dom';

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
      <Link to="/admin">管理员</Link>
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
