const source = 'TRP_TreatmentPlans.treatments[].selectedItems[].selection';
const comparator = 'Contains';
const target = 'Extraction';
const id = '340736561714824226';
const operatorMap = {
  contains: 'include'
}
const getComposeQuery = (source, comparator, target, id) => {
  const splittedString = source.split(".");
  const len = splittedString.length;
  const collection = splittedString[0];
  let right = getLastExpression(splittedString[len-1], comparator, target);
  for(let i=len-2; i>0; i--){
    const left = splittedString[i].slice(0, -2);
    right = splittedString[i].endsWith('[]') ? `.${left}.filter(${right})` : `.${left}${right}`;
  }
  return `${collection}.byId("${id}")${right}`;
}
const getLastExpression = (left, op, right) => {
  const operator = operatorMap[op.toLowerCase()] || op.toLowerCase();
  return `.${left}.${operator}("${right}")`
}
console.log(getComposeQuery(source, comparator, target, id));