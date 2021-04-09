import { Router, RouterContext } from './react-router';
import createBrowserHistory from './history';

export { Switch } from './react-router';
export { Route } from './react-router';

// react-router是核心库 BrowerRouter是web端的实现
export const BrowserRouter = (props) => {
  // children 是 Router内包含的child 包含Switch等
  const history = createBrowserHistory(props);
  return <Router history={history} children={props.children} />;
};

const LinkAnchor = ({ navigate, ...rest }) => {
  const props = {
    ...rest,
    onClick: (event) => {
      event.preventDefault();
      navigate();
    },
  };
  return <a {...props} />;
};

export const Link = ({ Component = LinkAnchor, to, ...rest }) => (
  <RouterContext.Consumer>
    {(context) => {
      const { history } = context;
      const props = {
        ...rest,
        href: to,
        navigate() {
          history.push(to);
        },
      };
      return <Component {...props} />;
    }}
  </RouterContext.Consumer>
);
