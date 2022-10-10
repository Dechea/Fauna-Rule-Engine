const source = 'TRP_TreatmentPlans.treatments[].selectedItems[].selection';
const comparator = 'Contains';
const target = 'Extraction';
const operatorMap = {
  contains: 'include'
}
const id = '340736561714824226';
const queryCriteria = { keyword: 'firstWhere', key: 'id', value: '340736561714824226' };
const sortCriteria = { direction: 'asc', key: 'date' };
const defaultSortCriteria = { direction: 'asc', key: 'id' }

const getComposeQuery = (source, comparator, target, queryCriteria, sortCriteria = defaultSortCriteria) => {
  const splittedString = source.split(".");
  const len = splittedString.length;
  const collection = splittedString[0];
  let right = getLastExpression(splittedString[len - 1], comparator, target);
  for (let i = len - 2; i > 0; i--) {
    const left = splittedString[i].slice(0, -2);
    right = splittedString[i].endsWith('[]') ? `.${left}.filter(${right})` : `.${left}${right}`;
  }

  const buildQuery = buildFilterCriteria(queryCriteria);
  const sortQuery = buildSortCriteria(sortCriteria);

  return `${collection}.all.${sortQuery}.${buildQuery}${right}`;
}

const buildFilterCriteria = (queryCriteria) => {
  const { keyword, key, value } = queryCriteria;
  return keyword == 'first' ? `${keyword}()` :`${keyword}(.${key} == "${value}")`;
}

const buildSortCriteria = (sortCriteria) => {
  const { direction, key } = sortCriteria;
  return `order(${direction}(.${key}))`;
}

const getLastExpression = (left, op, right) => {
  const operator = operatorMap[op.toLowerCase()] || op.toLowerCase();
  return `.${left}.${operator}("${right}")`
}

console.log(getComposeQuery(source, comparator, target, queryCriteria, sortCriteria));
