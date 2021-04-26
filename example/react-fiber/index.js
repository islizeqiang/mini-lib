import React from '../../mini-lib/ReactFiber';

function Count2(props) {
  const [count, setCount] = React.useState(1);

  const onClickHandler = () => {
    setCount(count + 1);
    setCount(count + 1);
  };

  return (
    <div>
      <h3>Count: {count}</h3>
      {count < 5 ? (
        <div>
          <button onClick={onClickHandler}>Count+1</button>
          <button
            onClick={() => {
              props.setTitle('我变成哈哈了');
            }}
          >
            更新标题
          </button>
        </div>
      ) : (
        ''
      )}
    </div>
  );
}

function Count1() {
  const [count, setCount] = React.useState(1);
  const [count2, setCount2] = React.useState(1);

  const onClickHandler = () => {
    setCount(count + 1);
  };

  const onClickHandler2 = () => {
    setCount2(count2 + 1);
  };

  if (count2 > 6) {
    return <div>我变成22了</div>;
  }

  return (
    <div>
      <h3>Count1: {count}</h3>
      <button onClick={onClickHandler}>Count1+1</button>
      <h3>Count2: {count2}</h3>
      <button onClick={onClickHandler2}>Count2+1</button>
    </div>
  );
}

const Count3 = () => {
  const [count, setCount] = React.useState(1);
  const onClickHandler = () => {
    setCount(count + 1);
  };
  return (
    <div>
      <h3>Count: {count}</h3>
      <button onClick={onClickHandler}>Count+1</button>
    </div>
  );
};

class AppImplements extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      title: '组件2',
    };
  }

  setTitle = (e) => {
    this.setState({
      title: e,
    });
  };

  render() {
    return (
      <div>
        <h1 id="title">{this.props.title}</h1>
        <hr></hr>
        <section>
          <h2>组件1</h2>
          <Count1></Count1>
          <hr></hr>
          <h2>{this.state.title}</h2>
          <Count2 setTitle={this.setTitle}></Count2>
          <hr></hr>
        </section>
      </div>
    );
  }
}

const App = React.transfer(AppImplements);

React.render(<App title="测试" />, document.getElementById('root'));
