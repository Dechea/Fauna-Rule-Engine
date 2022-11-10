const flatten = require('flat');
const {
  buildFactPart,
  buildConditionPart,
  buildRulePart,
  createObjectMap
} = require("./buildParts");

const requestBodyFact = {
  "type": "Fact",
  "name": "nationality",
  "value": 'query User {author(where: {id: $id}) {nationality}}'
}
const requestBodyFact2 = {
  "type": "Fact",
  "name": "job",
  "value": 'query User {posts(where: {id: "ckadqdbhk00go0148zzxh4bbq", name: "Micha", something: "bla"}) {job}}'
}
const requestBodyCondition = {
  "type": "Condition",
  "name": "isIncomeHigherThan2000",
  "source": {
    "type": "Fact",
    "name": "income",
    "value": 'query User {posts(where: {id: "ckadqdbhk00go0148zzxh4bbq", name: "Micha", something: "bla"}) {job}}'
  },
  "comparator": "gt",
  "target": {
    "type": "Number",
    "value": 2000
  }
}
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

const build = (obj) => {

  if (typeof obj !== "object" || obj === null) {
    return 0;
  }

  const flatt = flatten(obj);
  const flattMap = new Map(Object.entries(flatt));

  switch (flattMap.get('type')) {
    case 'Fact':
      return buildFact(obj)
      break;
    case 'Condition':
      return buildCondition(obj)
      break;
    case 'Rule':
      return buildRule(obj, flattMap)
      break;
  }

  // TODO: create/update UDF from output
  // objectMap.forEach((value, key) =>{
  //   console.log(createFunction(key, value))
  // })
  // factMap.forEach((value, key) =>{
  //   console.log(createFunction(key, value))
  // })
  // ruleMap.forEach((value, key) =>{
  //   console.log(createFunction(key, value))
  // })

}
const buildFact = (inputObject) => {

  return buildFactPart(inputObject);
}

const buildCondition = (inputObject) => {

  const map = buildFactPart(inputObject.source);

  return buildConditionPart(map, inputObject);
}

const buildRule = (inputObject, flattMap) => {

  const ruleName = flattMap.get('name');
  const topLevelMap = createObjectMap(flattMap);

  return buildRulePart(topLevelMap, ruleName);
}

module.exports = {
  build
}

build(requestBody);
// build(requestBodyFact)
// build(requestBodyFact2)
// build(requestBodyCondition)