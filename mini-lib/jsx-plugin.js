module.exports = function (babel) {
  var t = babel.types;
  return {
    name: 'babel-plugin-jsx-plugin',
    visitor: {
      JSXElement(path) {
        var openingElement = path.node.openingElement;
        var tagName = openingElement.name.name;
        var args = [];
        args.push(t.stringLiteral(tagName));
        var attribs = t.nullLiteral();
        args.push(attribs);
        var reactIdentifier = t.identifier('React'); //object
        var createElementIdentifier = t.identifier('createElement1');
        var callee = t.memberExpression(reactIdentifier, createElementIdentifier);
        var callExpression = t.callExpression(callee, args);
        callExpression.arguments = callExpression.arguments.concat(path.node.children);
        path.replaceWith(callExpression, path.node);
      },
    },
  };
};
