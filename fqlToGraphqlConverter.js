const babel = require('@babel/parser');
const {
  operatorMap,
  logicalOperatorMap,
} = require('./constants');
const {
  getObjKeyByValue,
  capitalizeFirstLetter,
} = require('./helper');

const convertMemberExpressionToString = (expression) => {
  const {object, property} = expression;
  let result = '';
  const {type} = object;
  switch (type) {
    case 'MemberExpression':
      result += convertMemberExpressionToString(object);
      break;
    case 'Identifier':
      result += object.name;
      break;
  }
  if (property.name === 'all') {
    return result;
  } else if (property.name === 'firstWhere') {
    return `${result}(where:`;
  } else {
    return `${result}(${property.name}:`;
  }
};

const checkLogicalExpression = (argument) => {
  const left = getExpression(argument.left);
  const right = getExpression(argument.right);

  const operator = argument.operator || argument.operand;
  const mappedOperand = logicalOperatorMap[operator];

  if (operator === '||') {
    const splitMappedOperands = mappedOperand.split('{');
    return `${left} ${splitMappedOperands[0]} { ${right} ${splitMappedOperands[1]}`;
  } else {
    return `${left} ${mappedOperand} ${right}`;
  }
};

const convertArgsToString = (argument) => {
  const {type} = argument;
  let result = '';

  switch (type) {
    case 'LogicalExpression':
      result += checkLogicalExpression(argument);
      break;

    case 'BinaryExpression':
      result += getExpression(argument);
      break;
  }

  return result;
};

const parseOperand = (operand) => {
  const {type} = operand;
  let result = '';
  switch (type) {
    case 'Literal':
      result += operand.raw;
      break;

    case 'StringLiteral':
      result += operand.extra.raw;
      break;

    case 'NumericLiteral':
      result += operand.extra.raw;
      break;

    case 'MemberExpression':
      result += operand.property.name;
      break;

    case 'Identifier':
      result += operand.name;
      break;

    case 'CallExpression':
      // const value = operand.arguments[0].raw || operand.arguments[0].extra.raw;
      const node = operand.arguments[0];
      const value = checkCallExpression(node);
      result += `${operand.callee.object.property.name}.${operand.callee.property.name}(${value})`;
      break;
  }
  return result;
};

const getExpression = (argument) => {
  const {type} = argument;
  let result = '';

  switch (type) {
    case 'BinaryExpression':
      const leftOperand = parseOperand(argument.left);
      let rightOperand = parseOperand(argument.right);
      // In case of variables
      // Remove the dynamic part from it
      // Add $ to mark as variable
      if (rightOperand.includes(capitalizeFirstLetter(leftOperand))) {
        rightOperand = `$${leftOperand}`;
      }

      const {operator} = argument;
      if (operator === '==') {
        result += `${leftOperand} : ${rightOperand}`;
      } else {
        result += `${leftOperand} ${operator} ${rightOperand}`;
      }
      break;

    case 'LogicalExpression':
      result += convertArgsToString(argument);
      break;

    case 'Literal':
      result += argument.raw;
      break;

    case 'StringLiteral':
      result += argument.extra.raw;
      break;

    case 'MemberExpression':
      result += argument.property.name;
      break;
    case 'CallExpression':
      const node = argument.arguments[0];
      const value = checkCallExpression(node);
      result += `${argument.callee.object.property.name}_${argument.callee.property.name} : ${value}`;
      break;
  }
  return result;
};

const checkCallExpression = (callExpression) => {
  const {name, type, value, raw, extra} = callExpression;

  if (type !== 'Identifier') {
    return value || raw || extra.raw;
  }

  return name;
};

const convertCallExpressionToString = (expression) => {
  // Necessary for jest
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode#changes_in_strict_mode
  const {callee, arguments: args} = expression;
  const {type} = callee;

  let result = '';
  switch (type) {
    case 'MemberExpression':
      result += convertMemberExpressionToString(callee);
      break;
    case 'CallExpression':
      result += convertCallExpressionToString(callee);
      break;
  }

  return `${result} { ${convertArgsToString(args[0].body)}} )`;
};

const convertObjectToString = (object) => {
  const {type} = object;

  switch (type) {
    case 'CallExpression':
      return convertCallExpressionToString(object);
  }
};

const convertBinaryExpressionToString = (object) => {
  let result = '';
  let baseString = '';
  let leftString = '';
  let rightString = '';

  const operands = [];
  operands.push(object.left);
  operands.push(object.right);

  let targetType = '';
  let operator = object.operator;

  operands.forEach((operand, index) => {
    const {type} = operand;
    const {object, property} = operand;

    switch (type) {
      case 'MemberExpression':
        baseString = convertObjectToString(object);
        result = `${baseString} { ${property.name}`;
        break;

      case 'CallExpression':
        baseString = convertCallExpressionToString(operand);
        if (typeof property === 'undefined') {
          result = `${baseString}`;
        } else {
          result = `${baseString} { ${property.name}`;
        }
        break;

      case 'StringLiteral':
        targetType = 'String';
        baseString = operand.value;
        result = baseString;
        break;

      case 'BooleanLiteral':
        targetType = 'Boolean';
        baseString = operand.value;
        result = baseString;
        break;

      case 'NumericLiteral':
        targetType = 'Number';
        baseString = operand.value;
        result = baseString;
        break;
    }

    if (index === 0) {
      leftString = result;
    } else {
      rightString = result;
    }
  });

  return {leftString, rightString, operator, targetType};
};

const convertFqlToGraphql = (fqlString) => {
  const parsedFQL = babel.parse(fqlString);
  const {expression} = parsedFQL.program.body[0];

  const queryStartPart = 'query MyQuery {';
  const queryEndPart = '}}';

  let baseString;

  const {type} = expression;
  const {object, property} = expression;

  switch (type) {
    case 'MemberExpression':
      baseString = convertObjectToString(object);
      return {
        type: 'Fact',
        name: property.name,
        value: `${queryStartPart} ${baseString} { ${property.name} ${queryEndPart}`,
      };

    case 'CallExpression':
      baseString = convertCallExpressionToString(expression);
      if (typeof property === 'undefined') {
        return baseString;
      } else {
        return {
          name: property.name,
          query: `${queryStartPart} ${baseString} { ${name} ${queryEndPart}`,
        };
      }

    case 'BinaryExpression':
      const {leftString, rightString, operator, targetType} = convertBinaryExpressionToString(expression);
      const leftParts = leftString.split('{');
      const sourceName = leftParts[leftParts.length - 1].replace(' ', '');

      return {
        type: 'Condition',
        source: {
          type: 'Fact',
          name: sourceName,
          value: `${queryStartPart} ${leftString} ${queryEndPart}`,
        },
        comparator: getObjKeyByValue(operatorMap, operator),
        target: {
          type: targetType,
          value: rightString,
        },
      };
  }
};

module.exports = {
  convertFqlToGraphql,
};
