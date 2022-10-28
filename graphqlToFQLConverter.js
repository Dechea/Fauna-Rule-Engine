const { parse } = require('graphql/language/parser');
const { capitalizeFirstLetter } = require("./helper");

const composeOperator = (stringArray) => {
  let result = stringArray[1];
  for (let index = 2; index < stringArray.length; index++) {
    result += capitalizeFirstLetter(stringArray[index]);
  }
  return result;
}

const getCollectionSortCriteria = (arg, collectionName) => {
  const [key, direction] = arg.value.value.split('_');
  return `order(${direction.toLowerCase()}(${collectionName} => ${collectionName}.${key}))`;
}

const buildCriteriaString = (fields, functionName) => {
  let criteriaString = '';
  for (let index = 0; index < fields.length; index++) {
    const splittedString = fields[index].name.value.split("_");
    const key = splittedString[0];

    if(index == 0){
      criteriaString += `${functionName} => `; 
    }

    if (splittedString.length === 1) {
      let value;
      if (fields[index].value.kind === 'Variable') {
        value = fields[index].value.name.value;
        criteriaString += `${functionName}.${key} == $${value}`;
      } else {
        value = fields[index].value.value;
        criteriaString += `${functionName}.${key} == "${value}"`;
      }
      // const value = fields[index].value.value;

    }
    else {
      const operator = composeOperator(splittedString);
      const value = fields[index].value.value;

      criteriaString += `${functionName}.${key}.${operator}("${value}")`;
    }
    criteriaString += index < fields.length - 1 ? ' && ' : '';
  }


  return criteriaString;
}

const getCollectionFilterCriteria = (arg, functionName) => {
  const { fields } = arg.value;
  const criteriaString = buildCriteriaString(fields, functionName);
  return `firstWhere(${criteriaString})`;
}

const getCollectionLevelCriteria = (args, collectionName) => {
  let sortCriteria = null;
  let filterCriteria = null;
  for (const arg of args) {
    const keyword = arg.name.value;
    if (keyword === 'orderBy') {
      sortCriteria = getCollectionSortCriteria(arg, collectionName);
    }
    else if (keyword === 'where') {
      filterCriteria = getCollectionFilterCriteria(arg, collectionName);
    }
  }
  return { sortCriteria, filterCriteria };
}

const buildArrayExpression = (name, args) => {
  const { fields } = args[0].value;
  const criteriaString = buildCriteriaString(fields, name);
  return `${name}.filter(${criteriaString}).at(0)`;
}

const getLastExpression = (input, result) => {
  if (!input) return result;
  result += '.';
  const selections = input.selections[0];
  const name = selections?.name?.value;
  const args = selections?.arguments;
  if (!args || args.length == 0) {
    result += name;
  }
  else {
    result += buildArrayExpression(name, args);
  }
  return getLastExpression(selections.selectionSet, result);
}

// TRP_TreatmentPlans.all.order(asc(.name)).firstWhere(.name.startsWith("Jamie"))
//.treatments.filter(.title.startsWith("Union")).at(0).selectedItems

const query = `
query MyQuery {
  TRP_TreatmentPlans(orderBy: name_ASC, where: {id: "ckadqdbhk00go0148zzxh4bbq", updatedAt: "", name_contains: ""}) {
    treatments(where: {title_starts_with: "Union"}) {
      selectedItems {
        quantity {
          items
        }
      }
    }
  }
}  
`;

const getBaseQuery = (query) => {
  let fqlString = '';
  const parsedQuery = parse(query);
  const selections = parsedQuery.definitions[0].selectionSet.selections[0];
  const collectionName = selections.name.value;
  const args = selections.arguments;

  fqlString += `${collectionName}.all`;
  const { sortCriteria, filterCriteria } = getCollectionLevelCriteria(args, collectionName);

  fqlString += sortCriteria ? `.${sortCriteria}` : '';
  fqlString += filterCriteria ? `.${filterCriteria}` : '';

  return fqlString;
}

const convertGraphQLToFQL = (query) => {
  let fqlString = '';
  const parsedQuery = parse(query);
  const selections = parsedQuery.definitions[0].selectionSet.selections[0];
  const collectionName = selections.name.value;
  const args = selections.arguments;

  fqlString += `${collectionName}.all`;
  const { sortCriteria, filterCriteria } = getCollectionLevelCriteria(args, collectionName);

  fqlString += sortCriteria ? `.${sortCriteria}` : '';
  fqlString += filterCriteria ? `.${filterCriteria}` : '';

  const input = selections.selectionSet;
  const lastExpression = getLastExpression(input, '');
  fqlString += lastExpression;

  return fqlString;
};

// console.log(convertGraphQLToFQL(query));

module.exports = {
  convertGraphQLToFQL,
  getCollectionLevelCriteria,
  getBaseQuery
}
