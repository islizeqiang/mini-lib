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

class Home2 extends React.Component {
  constructor() {
    super();
    this.state = {
      time: 1,
    };
  }
  setTime = (e) => {
    this.setState({
      time: e,
    });
  };

  set = () => {
    this.setTime(2);
    this.setTime(3);

    setTimeout(() => {
      console.log('time-timeout-1次: ', this.state.time);
      this.setTime(4);
      console.log('time-timeout-2次: ', this.state.time);
    });
  };

  render() {
    console.log('time-render: ', this.state.time);

    return (
      <>
        <button onClick={this.set}>点我</button>
        <div>{this.state.time}</div>
      </>
    );
  }
}

const Home1 = () => {
  const [time, setTime] = React.useState(1);

  const set = () => {
    setTime(2);
    setTime(3);

    setTimeout(() => {
      console.log('time-timeout-1次: ', time);
      setTime(4);
      console.log('time-timeout-2次: ', time);
    });
  };

  console.log('time-render: ', time);

  return (
    <>
      <button onClick={set}>点我</button>
      <div>{time}</div>
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
