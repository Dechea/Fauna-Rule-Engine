const babel = require("@babel/parser");
const { logicalOperatorMap } = require("./constants");

// object
const fql_simple = `user.all.firstWhere(u => u.id == "ckadqdbhk00go0148zzxh4bbq"  && u.name.contains("abc"))`;
const fql_and = `user.all.firstWhere(u => u.id == "ckadqdbhk00go0148zzxh4bbq" && u.name.contains("abc")).nationality`;
const fql_or = `user.all.firstWhere(u => u.id == "ckadqdbhk00go0148zzxh4bbq" || u.name.contains("abc")).nationality`;
const fql_and_var = `user.all.firstWhere(u => u.id == $id && u.name.contains($name)).nationality`;
const fql_or_var = `user.all.firstWhere(u => u.id == $id || u.name.contains($name)).nationality`;
const fql_complex = `posts.all.firstWhere(p => p.id == $id && p.name == $name && p.something == "bla")`
const fql_complex_2 = `posts.all.firstWhere(p => p.id == $id || ( p.name == $name && p.something == "bla") )`
const fql_number = `posts.all.firstWhere(p => p.income > 2000  && p.year == 2022)`;

// fact
// const fql_complex_3 = `posts.all.firstWhere(p => p.id == $id || ( p.name == $name && ( p.something == "bla" && p.income > 2000 ) ) ).nationality`
const fql_complex_3 = `posts.all.firstWhere(p => p.id == $id || ( p.name == $name && ( p.something == "bla" || ( p.income > 2000 && p.year == 2022 ) ) ) ).nationality == "DE"`
const fql_fact_variable = '(postsId,postsName) => postsByIdAndName(postsId,postsName).income'

// condition
// const fact = new Map([[object, fact]]);
const fql_boolean = '() => postsByIdAndName().job == true'
const fql_condition_greater_than = '(postsId,postsName) => postsByIdAndName(postsId,postsName).income > 2000'


const convertMemberExpressionToString = (expression) => {
  const { object, property } = expression;
  let result = '';
  const { type } = object;
  switch (type) {
    case "MemberExpression":
      result += convertMemberExpressionToString(object);
      break;
    case "Identifier":
      result += object.name;
      break;
  }
  return property.name === 'all'
    ? result
    : property.name === 'firstWhere' ? `${result}(where:` : `${result}(${property.name}:`;
}

const checkLogicalExpression = (argument) => {
  const left = getExpression(argument.left);
  const right = getExpression(argument.right);

  const operator = argument.operator || argument.operand;
  const mappedOperand = logicalOperatorMap[operator]

  if (operator === '||') {
    const splitMappedOperands = mappedOperand.split('{')
    return `${left} ${splitMappedOperands[0]} { ${right} ${splitMappedOperands[1]}`;
  } else {
    return `${left} ${mappedOperand} ${right}`;
  }
}

const convertArgsToString = (argument) => {
  const { type } = argument;
  let result = '';

  switch(type) {
    case "LogicalExpression":
      result += checkLogicalExpression(argument);
      break;

    case "BinaryExpression":
      result += getExpression(argument);
      break;
  }

  return result;
}

const parseOperand = (operand) => {
  const { type } = operand;
  let result = '';
  switch(type) {
    case "Literal":
      result += operand.raw;
      break;
    
    case "StringLiteral":
      result += operand.extra.raw;
      break;

    case "NumericLiteral":
      result += operand.extra.raw;
      break;

    case "MemberExpression":
      result += operand.property.name;
      break;

    case 'Identifier':
      result += operand.name;
      break;

    case "CallExpression":
      // const value = operand.arguments[0].raw || operand.arguments[0].extra.raw;
      const node = operand.arguments[0];
      const value = checkCallExpression(node);
      result += `${operand.callee.object.property.name}.${operand.callee.property.name}(${value})`
      break;
  }
  return result;
}

const getExpression = (argument) => {
  const { type } = argument;
  let result = '';

  switch(type){
    case "BinaryExpression":
      const leftOperand = parseOperand(argument.left);
      const rightOperand = parseOperand(argument.right);
      const { operator } = argument;
      if(operator === '==') {
        result += `${leftOperand} : ${rightOperand}`;
      } else {
        result += `${leftOperand} ${operator} ${rightOperand}`;
      }
      break;

    case 'LogicalExpression':
      result += convertArgsToString(argument)
      break;

    case "Literal":
      result += argument.raw;
      break;

    case "StringLiteral":
      result += argument.extra.raw;
      break;

    case "MemberExpression":
      result += argument.property.name;
      break;
    case "CallExpression":
      const node = argument.arguments[0];
      const value = checkCallExpression(node);
      // const value = argument.arguments[0].raw || argument.arguments[0].extra.raw;
      result += `${argument.callee.object.property.name}_${argument.callee.property.name} : ${value}`
      break;
  }
  return result;
}

const checkCallExpression = (callExpression) => {
  const { name, type, value, raw, extra } = callExpression;

  if(type !== 'Identifier') {
    return value || raw || extra.raw;
  } else {
    return name;
  }

}

const convertCallExpressionToString = (expression) => {
  const { callee, arguments } = expression;
  const { type } = callee;
  let result = '';
  switch (type) {
    case "MemberExpression":
      result += convertMemberExpressionToString(callee);
      break;
    case "CallExpression":
      result += convertCallExpressionToString(callee);
      break;
  }
  return `${result} { ${convertArgsToString(arguments[0].body)}} )`;
}

const convertObjectToString = (object) => {
  const { type } = object;

  switch (type) {
    case "CallExpression":
      return convertCallExpressionToString(object);
  }
}

const convertFqlToGraphql = (fqlString) => {
  const parsedFQL = babel.parse(fqlString);
  const { expression } = parsedFQL.program.body[0]

  const { type } = expression;
  if (type === 'MemberExpression') {
    const { object, property } = expression;
    const baseString = convertObjectToString(object);
    return `query MyQuery { ${baseString} { ${property.name} }}`

  } else if (type === 'CallExpression') {
    const baseString = convertCallExpressionToString(expression);

    if (typeof property === 'undefined') {
      return `query MyQuery { ${baseString} }`
    } else {
      return `query MyQuery { ${baseString} { ${property.name} }}`;
    }

  }
}

const logger = (input) => {
  console.log('INPUT: ' + input);
  console.log('OUTPUT: ' + convertFqlToGraphql(input));
  console.log('\n')
}

//
// logger(fql_simple);
//
// logger(fql_and);
//
// logger(fql_or);
//
// logger(fql_and_var);
//
// logger(fql_or_var);

// logger(fql_complex);

logger(fql_number);

// logger(fql_complex_2);
//
// logger(fql_complex_3);
//
// logger(fql_boolean);
//
// logger(fql_fact_variable);
//
// logger(fql_condition_greater_than);
