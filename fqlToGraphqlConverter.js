const babel = require("@babel/parser");
const { operatorMap, logicalOperatorMap } = require("./constants");
const { getMapKeyByValue, getObjKeyByValue, deCapitalizeFirstLetter, isEmpty, getFirstOrAll} = require("./helper");

const functionCall = '() =>';

// // object
// const fql_simple = `user.all.firstWhere(u => u.id == "ckadqdbhk00go0148zzxh4bbq"  && u.name.contains("abc"))`;
// const fql_and = `user.all.firstWhere(u => u.id == "ckadqdbhk00go0148zzxh4bbq" && u.name.contains("abc")).nationality`;
// const fql_or = `user.all.firstWhere(u => u.id == "ckadqdbhk00go0148zzxh4bbq" || u.name.contains("abc")).nationality`;
// const fql_and_var = `user.all.firstWhere(u => u.id == $id && u.name.contains($name)).nationality`;
// const fql_or_var = `user.all.firstWhere(u => u.id == $id || u.name.contains($name)).nationality`;
// const fql_complex = `posts.all.firstWhere(p => p.id == $id && p.name == $name && p.something == "bla")`
// const fql_complex_2 = `posts.all.firstWhere(p => p.id == $id || ( p.name == $name && p.something == "bla") )`
// const fql_number = `posts.all.firstWhere(p => p.income > 2000  && p.year == 2022)`;
//
// // fact
// // const fql_complex_3 = `posts.all.firstWhere(p => p.id == $id || ( p.name == $name && ( p.something == "bla" && p.income > 2000 ) ) ).nationality`
// const fql_complex_3 = `posts.all.firstWhere(p => p.id == $id || ( p.name == $name && ( p.something == "bla" || ( p.income > 2000 && p.year == 2022 ) ) ) ).nationality == "DE"`
// const fql_fact = `posts.all.firstWhere(p => p.id == $id &&  p.name == $name).nationality == "DE"`
// const fql_fact_variable = '(postsId,postsName) => postsByIdAndName(postsId,postsName).income'
//
// // condition
// // const fact = new Map([[object, fact]]);
// const fql_condition_boolean = 'posts.all.firstWhere(p => p.id == $id &&  p.name == $name).job == true'
// const fql_condition_greater_than = 'posts.all.firstWhere(p => p.id == $id &&  p.name == $name).income > 2000'

const objectMap = new Map([[
  'authorById', '() => author.all.firstWhere(a => a.id == "ckadqdbhk00go0148zzxh4bbq")'
],[
  'postsByIdAndName', '(postsId,postsName) => posts.all.firstWhere(p => p.id == $id && p.name == $name)'
],[
  'userById', '(userId) => user.all.firstWhere(u => u.id == id)'
]]);
const factMap = new Map([[
  'factAuthorNationality', '() => authorById().nationality'
],[
  'factPostsIncome', '(postsId,postsName) => postsByIdAndName(postsId,postsName).income'
],[
  'factPostsJob', '(postsId,postsName) => postsByIdAndName(postsId,postsName).job'
],[
  'factUserIncome', '(userId) => userById(userId).income'
],[
  'factUserJob', '(userId) => userById(userId).job'
  ]]);
const conditionMap = new Map([[
  'conditionAuthorNationalityEqFrance', '() => factAuthorNationality() == "France"'
// ],[
//   'conditionPostsIncomeGt2000', '(postsId,postsName) => factPostsIncome(postsId,postsName) > 2000'
// ],[
//   'conditionPostsHasJob', '(postsId,postsName) => factPostsJob(postsId,postsName) == true'
// ],[
//   'conditionUserIncomeGt2000', '(userId) => factUserIncome(userId) > 2000'
// ],[
//   'conditionUserHasJob', '(userId) => factUserJob(userId) == true'
]]);
const ruleMap = new Map([[
  'RuleIsEligibleForCredit', '(postsId,postsName,userId) => (conditionAuthorNationalityEqFrance() && (conditionPostsIncomeGt2000(postsId,postsName) || (conditionPostsHasJob(postsId,postsName) || (conditionUserIncomeGt2000(userId) && conditionUserHasJob(userId)))))'
]])

const convertMemberExpressionToString = (expression) => {
  const { object, property } = expression;
  let result = "";
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
  let result = "";
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
  let result = "";

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
  let result = "";
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

const convertBinaryExpressionToString = (object) => {
  let result = "";
  let baseString = "";
  let leftString = "";
  let rightString = "";

  const operands = [];
  operands.push(object.left);
  operands.push(object.right);

  let targetType = '';
  let operator = object.operator;

  operands.forEach((operand, index) => {
    const { type } = operand;

    const { object, property } = operand;

    switch (type) {
      case 'MemberExpression':
        baseString = convertObjectToString(object);
        result =`${baseString} { ${property.name}`;
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
        targetType = "String";
        baseString = operand.value;
        result = baseString;
        break;

      case 'BooleanLiteral':
        targetType = "Boolean";
        baseString = operand.value;
        result = baseString;
        break;

      case 'NumericLiteral':
        targetType = "Number";
        baseString = operand.value;
        result = baseString;
        break;
    }
    if (index === 0) {
      leftString = result;
    } else {
      rightString = result
    }

  })

  return {leftString, rightString, operator, targetType};
}

const convertFqlToGraphql = (fqlString) => {
  const parsedFQL = babel.parse(fqlString);
  const { expression } = parsedFQL.program.body[0]

  const queryStartPart = "query MyQuery {";
  const queryEndPart = "}}";

  let baseString;

  const { type } = expression;
  const { object, property } = expression;

  switch (type) {
    case 'MemberExpression':
      baseString = convertObjectToString(object);
      return {
        type: "Fact",
        name: property.name,
        value: `${queryStartPart} ${baseString} { ${property.name} ${queryEndPart}`
      };

    case 'CallExpression':
      baseString = convertCallExpressionToString(expression);
      if (typeof property === 'undefined') {
        // return `${queryStartPart} ${baseString} }`;
        return baseString;
      } else {
        return {
          name: property.name ,
          query: `${queryStartPart} ${baseString} { ${name} ${queryEndPart}`
        };
      }

    case 'BinaryExpression':
      const { leftString, rightString, operator, targetType } = convertBinaryExpressionToString(expression);
      const leftParts = leftString.split('{');
      const sourceName = leftParts[leftParts.length - 1].replace(' ', '');

      return {
        type: "Condition",
        source: {
          type: "Fact",
          name: sourceName,
          value: `${queryStartPart} ${leftString} ${queryEndPart}`,
        },
        comparator: getObjKeyByValue(operatorMap, operator),
        target: {
          type: targetType,
          value:  rightString
        }
      };
  }
}

const logger = (input) => {
  console.log('INPUT: ' + input);
  console.log('OUTPUT:');
  console.log(convertFqlToGraphql(input));
  console.log('\n')
}

// console.log(objectMap)
// console.log(factMap)
// console.log(conditionMap)

// use input maps:
// search in fact map for object name
// replace object name with object value
// search in condition map for fact name
// replace fact name with newly created fact value
// create JSON

const createJSON = (objectMap, factMap, conditionMap, ruleMap) => {

  let resultJSON = {};
  let updatedObjectMap = new Map();
  let updatedFactMap = new Map();
  let updatedConditionMap = new Map();

  objectMap.forEach((objectValue, objectKey) => {
    const objectName = objectKey;

    let functionVariables = '()';
    let functionCallToReplace;

    if (objectValue.includes(functionCall)) {
      functionCallToReplace = functionCall;
    } else {
      functionVariables = objectValue.split(' => ')[0];
      functionCallToReplace = `${functionVariables} => `;
    }

    const objectQuery = objectValue.replace(functionCallToReplace, '');
    const updatedObjectQuery = convertFqlToGraphql(objectQuery);

    updatedObjectMap.set(objectName, updatedObjectQuery);

    factMap.forEach((factValue, factKey) => {
      if (factValue.includes(objectName)) {
        const factName = factKey;
        let factQuery = factValue.replace(functionCallToReplace, '');

        factQuery = factQuery.replace(`${objectName}${functionVariables}`, `${objectQuery}`)
        const updatedFactQuery = convertFqlToGraphql(factQuery);

        updatedFactMap.set(factName, updatedFactQuery);
        // has to delete entry after completing transform operation
        factMap.delete(factName);

        conditionMap?.forEach((conditionValue, conditionKey) => {
          if (conditionValue.includes(factName)) {
            const conditionName = conditionKey;
            let conditionQuery = conditionValue.replace(functionCallToReplace, '');

            conditionQuery = conditionQuery.replace(`${factName}${functionVariables}`, `${factQuery}`)
            conditionQuery = conditionQuery.replace(' ', '');
            const updatedConditionQuery = convertFqlToGraphql(conditionQuery);

            updatedConditionMap.set(conditionName, updatedConditionQuery);
            // has to delete entry after completing transform operation
            conditionMap.delete(conditionName);
          }
        });
      }
    });

    // has to delete entry after completing transform operation
    // so no duplicates will be present in the transformed map
    objectMap.delete(objectName);
  });

  // After all parts of the JSON are created
  // Merge them to return the full JSON
  ruleMap?.forEach((ruleValue, ruleKey) => {

    const ruleName = deCapitalizeFirstLetter(ruleKey.replace('Rule', ''));
    let splittedString = ruleValue.split(' (');

    // remove vars from rule string
    splittedString.shift();

    const bracketsAmount = splittedString.length;
    let lastValue = splittedString[splittedString.length - 1];
    lastValue = lastValue.substring(0, lastValue.length - bracketsAmount)
    splittedString[splittedString.length - 1] = lastValue;

    let tempLastKey = '';
    let tempLastIndex = 0;

    for (let i = 0; i < splittedString.length; i++){
      const ruleEntry = splittedString[i];
      const conditionSearchParam = ruleEntry.substring(0, ruleEntry.indexOf('('))
      let entry = {};

      if (i === 0) {
        // At top level the json will be created
        // only one all/any can be placed
        if (ruleEntry.includes('&&')) {
          resultJSON = {
            name: ruleName,
            type: 'Rule',
            all: [
              updatedConditionMap.get(conditionSearchParam),
            ]
          };
          tempLastKey = 'all';
        } else {
          resultJSON = {
            name: ruleName,
            type: 'Rule',
            any: [
              updatedConditionMap.get(conditionSearchParam),
            ]
          };
          tempLastKey = 'any';
        }
      } else if(i === splittedString.length - 1) {
        // In the last element we've two conditions
        if (ruleEntry.includes('&&')) {
          const temp = ruleEntry.split(' && ');
          entry = {
            all: [
              updatedConditionMap.get(temp[0].substring(0, temp[0].indexOf('('))),
              updatedConditionMap.get(temp[1].substring(0, temp[1].indexOf('(')))
            ]
          };
        } else {
          const temp = ruleEntry.split('||');
          entry = {
            any: [
              updatedConditionMap.get(temp[0].substring(0, ruleEntry.indexOf('('))),
              updatedConditionMap.get(temp[1].substring(0, ruleEntry.indexOf('(')))
            ]
          };
        }
        // Get current position in object
        // Add the created entries
        tempLastKey.split('.').reduce((o,i)=> o[i], resultJSON).push(entry);
      } else {
        if (ruleEntry.includes('&&')) {
          entry = {
            all: [
              updatedConditionMap.get(conditionSearchParam),
            ]
          };
        } else {
          entry = {
            any: [
              updatedConditionMap.get(conditionSearchParam),
            ]
          };
        }

        // Get current position in object
        // Add the created entries
        // Updated the index
        tempLastKey.split('.').reduce((o,i)=> o[i], resultJSON).push(entry);
        tempLastIndex = tempLastKey.split('.').reduce((o,i)=> o[i], resultJSON).length - 1;
        tempLastKey += `.${tempLastIndex}.${Object.keys(entry)}`
      }
    }
  })

  if (isEmpty(resultJSON)) {
    if (updatedConditionMap.size > 0) {
      resultJSON = getFirstOrAll(updatedConditionMap);
    } else if (updatedFactMap.size > 0) {
      resultJSON = getFirstOrAll(updatedFactMap);
    }
  }

  return resultJSON;
}

console.log('INPUT:')
console.log(objectMap)
console.log(factMap)
console.log(conditionMap)
console.log(ruleMap)
console.log('-----------------')
console.log('OUTPUT:')
console.log(createJSON(objectMap, factMap, conditionMap, ruleMap));


// logger(fql_simple);

// logger(fql_and);

// logger(fql_or);

// logger(fql_and_var);

// logger(fql_or_var);

// logger(fql_complex);

// logger(fql_number);

// logger(fql_fact);

// logger(fql_condition_boolean);

// logger(fql_condition_greater_than);

// logger(fql_complex_2);

//logger(fql_complex_3);



// logger(fql_condition_greater_than);
