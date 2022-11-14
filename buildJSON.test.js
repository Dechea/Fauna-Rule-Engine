const {createJSON} = require('./buildJSON');

let objectMap = new Map();
let factMap = new Map();
let conditionMap = new Map();

test('Create object and fact without variable', () => {
  objectMap.set('authorById', '() => author.all.firstWhere(a => a.id == "ckadqdbhk00go0148zzxh4bbq")');
  factMap.set('factAuthorNationality', '() => authorById().nationality');

  const result = createJSON(objectMap, factMap);

  expect(result).toEqual({
    type: 'Fact',
    name: 'nationality',
    value: 'query MyQuery { author(where: { id : "ckadqdbhk00go0148zzxh4bbq"} ) { nationality }}',
  });
});

test('Create object and fact with variable', () => {
  objectMap.set('postsByIdAndName', '(postsId,postsName) => posts.all.firstWhere(p => p.id == postsId && p.name == postsName)');
  factMap.set('factPostsIncome', '(postsId,postsName) => postsByIdAndName(postsId,postsName).income');

  const result = createJSON(objectMap, factMap);

  expect(result).toEqual({
    type: 'Fact',
    name: 'income',
    value: 'query MyQuery { posts(where: { id : $id , name : $name} ) { income }}',
  });
});

test('Create object, fact and condition without variable', () => {
  objectMap.set('authorById', '() => author.all.firstWhere(a => a.id == "ckadqdbhk00go0148zzxh4bbq")');
  factMap.set('factAuthorNationality', '() => authorById().nationality');
  conditionMap.set('conditionAuthorNationalityEqFrance', '() => factAuthorNationality() == "France"');

  const result = createJSON(objectMap, factMap, conditionMap);

  expect(result).toEqual({
    type: 'Condition',
    source: {
      type: 'Fact',
      name: 'nationality',
      value: 'query MyQuery { author(where: { id : "ckadqdbhk00go0148zzxh4bbq"} ) { nationality }}',
    },
    comparator: 'eq',
    target: {type: 'String', value: 'France'},
  });
});

test('Create object, fact and condition with variable', () => {
  objectMap.set('postsByIdAndName', '(postsId,postsName) => posts.all.firstWhere(p => p.id == postsId && p.name == postsName)');
  factMap.set('factPostsIncome', '(postsId,postsName) => postsByIdAndName(postsId,postsName).income');
  conditionMap.set('conditionPostsIncomeGt2000', '(postsId,postsName) => factPostsIncome(postsId,postsName) > 2000');


  const result = createJSON(objectMap, factMap, conditionMap);

  expect(result).toEqual({
    type: 'Condition',
    source: {
      type: 'Fact',
      name: 'income',
      value: 'query MyQuery { posts(where: { id : $id , name : $name} ) { income }}',
    },
    comparator: 'gt',
    target: {type: 'Number', value: 2000},
  });
});

test('Create rule', () => {
  objectMap.set('authorById', '() => author.all.firstWhere(a => a.id == "ckadqdbhk00go0148zzxh4bbq")');
  objectMap.set('postsByIdAndName', '(postsId,postsName) => posts.all.firstWhere(p => p.id == postsId && p.name == postsName)');
  objectMap.set('userById', '(userId) => user.all.firstWhere(u => u.id == userId)');

  factMap.set('factAuthorNationality', '() => authorById().nationality');
  factMap.set('factPostsIncome', '(postsId,postsName) => postsByIdAndName(postsId,postsName).income');
  factMap.set('factPostsJob', '(postsId,postsName) => postsByIdAndName(postsId,postsName).job');
  factMap.set('factUserIncome', '(userId) => userById(userId).income');
  factMap.set('factUserJob', '(userId) => userById(userId).job');

  conditionMap.set('conditionAuthorNationalityEqFrance', '() => factAuthorNationality() == "France"');
  conditionMap.set('conditionPostsIncomeGt2000', '(postsId,postsName) => factPostsIncome(postsId,postsName) > 2000');
  conditionMap.set('conditionPostsHasJob', '(postsId,postsName) => factPostsJob(postsId,postsName) == true');
  conditionMap.set('conditionUserIncomeGt2000', '(userId) => factUserIncome(userId) > 2000');
  conditionMap.set('conditionUserHasJob', '(userId) => factUserJob(userId) == true');

  const ruleMap = new Map([[
    'RuleIsEligibleForCredit', '(postsId,postsName,userId) => (conditionAuthorNationalityEqFrance() && (conditionPostsIncomeGt2000(postsId,postsName) || conditionPostsHasJob(postsId,postsName) || (conditionUserIncomeGt2000(userId) && conditionUserHasJob(userId))))',
  ]]);

  const result = createJSON(objectMap, factMap, conditionMap, ruleMap);

  expect(result.name).toEqual('isEligibleForCredit');
  expect(result.type).toEqual('Rule');
  expect(result.all).toEqual(
    [
      {
        comparator: 'eq',
        source: {
          name: 'nationality',
          type: 'Fact',
          value: 'query MyQuery { author(where: { id : "ckadqdbhk00go0148zzxh4bbq"} ) { nationality }}',
        },
        target: {
          type: 'String',
          value: 'France',
        },
        type: 'Condition',
      },
      {
        any: [
          {
            comparator: 'gt',
            source: {
              name: 'income',
              type: 'Fact',
              value: 'query MyQuery { posts(where: { id : $id , name : $name} ) { income }}',
            },
            target: {
              type: 'Number',
              value: 2000,
            },
            type: 'Condition',
          },
          {
            comparator: 'eq',
            source: {
              name: 'job',
              type: 'Fact',
              value: 'query MyQuery { posts(where: { id : $id , name : $name} ) { job }}',
            },
            target: {
              type: 'Boolean',
              value: true,
            },
            type: 'Condition',
          },
          {
            all: [
              {
                comparator: 'gt',
                source: {
                  name: 'income',
                  type: 'Fact',
                  value: 'query MyQuery { user(where: { id : $id} ) { income }}',
                },
                target: {
                  type: 'Number',
                  value: 2000,
                },
                type: 'Condition',
              },
              {
                comparator: 'eq',
                source: {
                  name: 'job',
                  type: 'Fact',
                  value: 'query MyQuery { user(where: { id : $id} ) { job }}',
                },
                target: {
                  type: 'Boolean',
                  value: true,
                },
                type: 'Condition',
              },
            ],
          },
        ],
      },
    ],
  );
});