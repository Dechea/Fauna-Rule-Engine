const flatten = require('flat');

const { operatorMap } = require("./constants");
const { convertGraphQLToFQL } = require("./graphqlToFQLConverter");
const { capitalizeFirstLetter, removeQuotes, checkBool, getByValue, isNumeric } = require("./helper");

let objectMap = new Map();
const factMap = new Map();
const conditionMap = new Map();
const existingVariablesMap = new Map();

const topLevel = new Map();

const functionCall = ' => ';

const requestBody = {
  "type": "Rule",
  "name": "isEligibleForCredit",
  "all": [
    {
      "type": "Condition",
      "name": "isNationalityFrance",
      "source": {
        "type": "Fact",
        "name": "nationality",
        "value": 'query User {author(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {nationality}}'
      },
      "comparator": "eq",
      "target": {
        "type": "String",
        "value": "France"
      }
    },
    {
      "any": [
        {
          "type": "Condition",
          "name": "isIncomeHigherThan2000",
          "source": {
            "type": "Fact",
            "name": "income",
            "value": 'query User {posts(where: {id: $id, name: $name}) {income}}'
          },
          "comparator": "gt",
          "target": {
            "type": "Number",
            "value": 2000
          }
        },
        {
          "type": "Condition",
          "name": "hasJob",
          "source": {
            "type": "Fact",
            "name": "job",
            "value": 'query User {posts(where: {id: "ckadqdbhk00go0148zzxh4bbq", name: "Micha"}) {job}}'
          },
          "comparator": "eq",
          "target": {
            "type": "Boolean",
            "value": true
          }
        },
        {
          "all": [
            {
              "type": "Condition",
              "name": "isIncomeHigherThan2000",
              "source": {
                "type": "Fact",
                "name": "income",
                "value": 'query User {user(where: {id: "ckadqdbhk00go0148zzxh4bbq"}) {income}}'
              },
              "comparator": "gt",
              "target": {
                "type": "Number",
                "value": 2000
              }
            },
            {
              "type": "Condition",
              "name": "hasJob",
              "source": {
                "type": "Fact",
                "name": "job",
                "value": 'query User {user(where: {id: $id}) {job}}'
              },
              "comparator": "eq",
              "target": {
                "type": "Boolean",
                "value": true
              }
            }
          ]
        }
      ]
    }
  ]
}

const getQueries = (data, queries) => {
  if (!data)
    return;

  for (let index = 0; index < data.length; index++) {
    const { all, any } = data[index];
    if (all)
      getQueries(all, queries);
    else if (any)
      getQueries(any, queries);
    else {
      const { source, target } = data[index];
      if (source?.type?.toLowerCase() === 'fact')
        queries.push(source.value);
      if (target?.type?.toLowerCase() === 'fact')
        queries.push(target.value);
    }
  }
}

const getCorrectOperator = (operator) => {
  return operatorMap[operator.toLowerCase()] || operator;
}

const getTargetString = (operatorString, target) => {
  const { type, value } = target;

  if (type.toLowerCase() === 'fact')
    return operatorString === '=='
      ? `${convertGraphQLToFQL(value)}`
      : `(${convertGraphQLToFQL(value)})`;
  else if (type.toLowerCase() === 'string')
    return operatorString === '==' ? `"${value}"` : `("${value}")`

  return value;
}

const buildRule = (obj) => {

  if (typeof obj !== "object" || obj === null) {
    return 0;
  }

  const flat = flatten(obj);

  // console.log(flat)

  const map = new Map(Object.entries(flat));
  createObjectMap(map)

  // console.log(topLevel)

  const ruleName = `${flat.type}${capitalizeFirstLetter(flat.name)}`
  const ruleValue = createRule(topLevel)
  const ruleMap = new Map([[ruleName, ruleValue]]);

  console.log(objectMap);
  console.log(factMap);
  console.log(conditionMap);
  console.log(ruleMap);

  objectMap.forEach((value, key) =>{
    console.log(createFunction(key, value))
  })
  factMap.forEach((value, key) =>{
    console.log(createFunction(key, value))
  })
  ruleMap.forEach((value, key) =>{
    console.log(createFunction(key, value))
  })

}

const createRule = (inputMap) => {
  const openBracket = '(';
  const closeBracket = ')';
  const [firstKey] = inputMap.keys();
  const [lastKey] = [...inputMap].at(-1)

  let oldKey = firstKey;
  let updatedKey = firstKey;
  let ruleString;
  let counterBrackets = 0;
  let allUsedVariables = new Set();

  ruleString = openBracket;
  counterBrackets++;
  inputMap.forEach((value, key) => {

    // create all udfs
    const source = topLevel.get(key).get(`${key}.source`)
    const comparator = topLevel.get(key).get(`${key}.comparator`)
    const target = topLevel.get(key).get(`${key}.target`)

    const {conditionName, variableNames} = buildParts(source, comparator, target)
    allUsedVariables.add(variableNames);
    // const usedVariables = condition.split(' => ')
    // usedVariables.pop()

    // check for position
    if (key === oldKey && key.length === oldKey.length) {
      ruleString += `${conditionName}(${variableNames})`;

      if (updatedKey.startsWith('all')) {
        ruleString += ' && '
      } else {
        ruleString += ' || '
      }
    } else {
      // get correct position from key
      if (key.length !== oldKey.length) {
        updatedKey = key.slice(oldKey.length + 1);
      }

      // add brackets and operator
      // only if it's not the last key
      if(key !== lastKey) {
        ruleString += openBracket;
        ruleString += `${conditionName}(${variableNames})`;
        counterBrackets++;

        if (updatedKey.startsWith('all')) {
          ruleString += ' && '
        } else {
          ruleString += ' || '
        }
      } else {
        ruleString += `${conditionName}(${variableNames})`;
      }
    }

    // console.log(key)
    // console.log(oldKey)
    // console.log(updatedKey)
    // console.log(lastKey)
    // console.log('----------------')
    // console.log(ruleString)
    // console.log('----------------')

    oldKey = key;
  })

  // add the correct amount of brackets
  const brackets = closeBracket.repeat(counterBrackets);
  ruleString += brackets

  return `(${[...allUsedVariables].flat().join(',')})${functionCall}${ruleString}`
}

const createObjectMap = (data) => {

  let tempMidMap = new Map();
  let tempLowerObject = {};

  let oldName = Array.from(data.keys())[2].split('.');
  oldName.pop();
  oldName = oldName.join('.');

  for (const [key, value] of data.entries()) {
    const keys = key.split('.');
    keys.pop();

    const updatedAmount = keys.length;
    const updatedKey = keys[updatedAmount-1];
    const updatedName = keys.join('.');
    const checkName = key.slice(0, updatedName.length)
    const valueName = key.slice(updatedName.length + 1, key.length)

    if (updatedKey !== undefined) {
      if (isNumeric(updatedKey)) {
        // Set subobjects to top lvl map
        if (checkName === updatedName) {
          topLevel.set(updatedName, tempMidMap);
        }
        // Set comparator map
        if (valueName === 'comparator') {
          // tempLowerObject = new Map([[valueName, value]])
          tempLowerObject = {[valueName] : value};
          tempMidMap.set(key, tempLowerObject);
        }
      } else {
        if (checkName === updatedName) {
          // Set or updated submaps
          if (oldName !== updatedName) {
            // tempLowerObject = new Map([[valueName, value]]);
            tempLowerObject = {[valueName] : value};
            tempMidMap.set(updatedName, tempLowerObject);
          } else {
            // tempLowerObject.set(valueName, value);
            tempLowerObject[valueName] = value;
            tempMidMap = new Map([[updatedName, tempLowerObject]]);
          }
        }
      }
    }
    // necessary for usage of old/new map
    oldName = updatedName !== '' || updatedName !== undefined ? updatedName : oldName;
  }
}

const buildParts = (source, comparator, target) => {

  const comparatorString = comparator.comparator;

  const sourceString = convertGraphQLToFQL(source.value);
  const operatorString = getCorrectOperator(comparatorString);
  const targetString = getTargetString(operatorString, target);

  const collection = sourceString.split('.')[0];

  // Create function name - Object
  const udfSplit = sourceString.split('.');
  udfSplit.pop()
  let object = udfSplit.join('.');

  let searchParamSplit = object.split('(');
  searchParamSplit = searchParamSplit.at(searchParamSplit.length - 1).split(' ');

  const searchParams = []
  const variableNames = [];
  searchParamSplit.forEach(searchParamPart => {
    if(searchParamPart.includes('.')) {
      searchParams.push(capitalizeFirstLetter(searchParamPart.substring(1)));
    } else if (searchParamPart.includes('&&')) {
      searchParams.push('And');
    } else if (searchParamPart.includes('$')) {
      let tempName = searchParamPart.replace('$', '');
      tempName = tempName.replace(')', '');
      tempName = `${collection}${capitalizeFirstLetter(tempName)}`;
      variableNames.push(tempName);
    }
  })

  let objectName = `${udfSplit[0]}By${searchParams.join('')}`;
  objectName = objectName.replace(/ /g, '');

  // Create function names - Fact
  let factName = sourceString.split('.');
  const collectionCapitalized = capitalizeFirstLetter(factName[0]);
  const sourceType = capitalizeFirstLetter(factName[factName.length-1]);
  factName = `fact${collectionCapitalized}${sourceType}`;

  // Create function names - Condition
  const formattedComparator = capitalizeFirstLetter(comparatorString);
  const formattedTarget = capitalizeFirstLetter(removeQuotes(targetString));

  let conditionName;
  if (checkBool(target)) {
    conditionName = target.value ? `condition${collectionCapitalized}Has${sourceType}` : `condition${collectionCapitalized}HasNo${sourceType}`;
  } else {
    conditionName = `condition${collectionCapitalized}${sourceType}${formattedComparator}${formattedTarget}`;
  }

  let fact;
  let condition;

  // Check for variable usage in gql query
  let factValue = sourceString.split('.')
  factValue = factValue[factValue.length-1]

  if (variableNames.size === 0) {
    object = `()${functionCall}${object}`;
    fact = `()${functionCall}${objectName}().${factValue}`;
    condition = `()${functionCall}${factName}() ${operatorString} ${targetString}`;

  } else {
    const updatedVariableName = variableNames.join(',');
    const updatedObject = object.replaceAll('$', '')

    object = `(${updatedVariableName})${functionCall}${updatedObject}`;
    fact = `(${updatedVariableName})${functionCall}${objectName}(${updatedVariableName}).${factValue}`;
    condition = `(${updatedVariableName})${functionCall}${factName}(${updatedVariableName}) ${operatorString} ${targetString}`;

    // push only if it's a variable
    existingVariablesMap.set(objectName, object);
  }

  if(existingVariablesMap.has(objectName)) {
    objectMap.set(objectName, existingVariablesMap.get(objectName));

  } else {
    objectMap.set(objectName, object);

  }
  factMap.set(factName, fact)
  conditionMap.set(conditionName, condition);

  return { conditionName, condition, variableNames };
}

const createFunction = (functionName, functionBody) => {
  return `Function.create({
    name: '${functionName}',
    body: '${functionBody}'
  })`
}

buildRule(requestBody)

