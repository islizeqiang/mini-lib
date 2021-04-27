import matchPath from './match-path';

const { React } = window;

const HistoryContext = React.createContext();
export const RouterContext = React.createContext();

export class Router extends React.Component {
  static computeRootMatch = (pathname) => ({
    path: '/',
    url: '/',
    params: {},
    isExact: pathname === '/',
  });

  constructor(props) {
    super(props);
    this.state = {
      // 设置默认值
      location: props.history.location,
    };
    this._isMounted = false;
    this._pendingLocation = null;

    this.unlisten = props.history.listen((location) => {
      if (this._isMounted) {
        this.setState({
          location,
        });
      } else {
        this._pendingLocation = location;
      }
    });
  }

  componentDidMount() {
    this._isMounted = true;
    if (this._pendingLocation !== null) {
      this.setState({
        location: this._pendingLocation,
      });
    }
  }

  componentWillUnmount() {
    if (typeof this.unlisten === 'function') {
      this.unlisten();
      this._isMounted = false;
      this._pendingLocation = null;
    }
  }

  render() {
    const { history, children } = this.props;
    const { location } = this.state;

    return (
      <RouterContext.Provider
        value={{
          history,
          location,
          match: Router.computeRootMatch(location.pathname),
        }}
      >
        <HistoryContext.Provider children={children} value={history} />
      </RouterContext.Provider>
    );
  }
}

export const Switch = ({ children }) => (
  <RouterContext.Consumer>
    {(context) => {
      const { location } = context;
      let element;
      let match = null;

      React.Children.forEach(children, (child) => {
        if (match === null && React.isValidElement(child)) {
          element = child;
          const { path } = element.props;
          match = matchPath(location.pathname, { ...child.props, path });
        }
      });

      return match !== null
        ? React.cloneElement(element, { location, computedMatch: match })
        : null;
    }}
  </RouterContext.Consumer>
);

export const Route = (props) => (
  <RouterContext.Consumer>
    {(context) => {
      const { computedMatch, component } = props;
      const { location } = context;
      const match = computedMatch !== null ? computedMatch : matchPath(location.pathname, props);
      const value = { ...context, location, match };
      return (
        <RouterContext.Provider value={value}>
          {value.match !== null ? React.createElement(component, value) : null}
        </RouterContext.Provider>
      );
    }}
  </RouterContext.Consumer>
);
