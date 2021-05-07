import React from '../../mini-lib/React/ReactFiber';
// import React from '../../mini-lib/React/ReactRange';

const getApp1 = () => {
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

  class App extends React.Component {
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

  return App;
};

const getApp2 = () => {
  function calculateWinner(squares) {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (let i = 0; i < lines.length; i += 1) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  }

  class Square extends React.Component {
    render() {
      return (
        <button onClick={this.props.onClick} className="square">
          {this.props.value}
        </button>
      );
    }
  }

  class Board extends React.Component {
    renderSquare(i) {
      return (
        <Square
          value={this.props.squares[i]}
          onClick={() => {
            this.props.onClick(i);
          }}
        />
      );
    }

    render() {
      return (
        <div>
          <div className="board-row">
            {this.renderSquare(0)}
            {this.renderSquare(1)}
            {this.renderSquare(2)}
          </div>
          <div className="board-row">
            {this.renderSquare(3)}
            {this.renderSquare(4)}
            {this.renderSquare(5)}
          </div>
          <div className="board-row">
            {this.renderSquare(6)}
            {this.renderSquare(7)}
            {this.renderSquare(8)}
          </div>
        </div>
      );
    }
  }

  class App extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        history: [
          {
            squares: Array(9).fill(null),
          },
        ],
        stepNumber: 0,
        xIsNext: true,
      };
    }

    handleClick(i) {
      const history = this.state.history.slice(0, this.state.stepNumber + 1);
      const current = history[history.length - 1];
      const squares = current.squares.slice();
      if (calculateWinner(squares) || squares[i]) {
        return;
      }

      squares[i] = this.state.xIsNext ? 'X' : 'O';
      this.setState({
        history: history.concat([
          {
            squares,
          },
        ]),
        stepNumber: history.length,
        xIsNext: !this.state.xIsNext,
      });
    }

    jumpTo(step) {
      this.setState({
        stepNumber: step,
        xIsNext: step % 2 === 0,
      });
    }

    render() {
      const { history } = this.state;
      const current = history[this.state.stepNumber];
      const winner = calculateWinner(current.squares);

      const moves = history.map((step, move) => {
        const desc = move ? `Go to move #${move}` : 'Go to game start';
        return (
          <li key={move}>
            <button onClick={() => this.jumpTo(move)}>{desc}</button>
          </li>
        );
      });

      let status;
      if (winner) {
        status = `Winner: ${winner}`;
      } else {
        status = `Next player: ${this.state.xIsNext ? 'X' : 'O'}`;
      }

      return (
        <div className="game">
          <div className="game-board">
            <Board
              squares={current.squares}
              onClick={(i) => {
                this.handleClick(i);
              }}
            />
          </div>
          <div className="game-info">
            <div>{status}</div>
            <ol>{moves}</ol>
          </div>
        </div>
      );
    }
  }

  return App;
};

const getApp3 = () => {
  const Home1 = () => {
    const [time, setTime] = React.useState(1);

    const set = () => {
      setTime(2);
      setTime(3);

      setTimeout(() => {
        console.log('time-timeout-1次: ', time);
        setTime(4);
        console.log('time-timeout-2次: ', time);
      }, 1000);
    };

    console.log('time-render: ', time);

    return (
      <>
        <button onClick={set}>点我</button>
        <div>{time}</div>
      </>
    );
  };

  class Home extends React.Component {
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
      }, 1000);
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
  return Home;
};

const App = getApp2();

React.render(<App title="测试" />, document.getElementById('root'));
