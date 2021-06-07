import squareArea from './square';
import circleArea from './circle';
import squareAreaVa from './dep';

console.log('Area of square: ', squareArea(5) === squareAreaVa);
console.log('Area of circle', circleArea(5));

function Test() {
  return (
    <div>
      <a>Hello~~~</a>
    </div>
  );
}
