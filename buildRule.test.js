const { build } = require("./buildRule");

let requestBody = {};

test("Build fact with variable", () => {
  requestBody = {
    "type": "Fact",
    "name": "nationality",
    "value": 'query User {author(where: {id: $id}) {nationality}}'
  };

  const result = build(requestBody);

  expect(result.get('object')).toEqual({ authorById: '(authorId) => author.all.firstWhere(a => a.id == authorId)' });
  expect(result.get('fact')).toEqual({ factAuthorNationality: '(authorId) => authorById(authorId).nationality' });
  expect(result.get('variable')).toEqual(Array.of('authorId'));
})

test("Build fact without variable", () => {
  requestBody = {
    "type": "Fact",
    "name": "job",
    "value": 'query User {posts(where: {id: "ckadqdbhk00go0148zzxh4bbq", name: "Micha", something: "bla"}) {job}}'
  };

  const result = build(requestBody);

  expect(result.get('object')).toEqual({ 'postsById-ckadqdbhk00go0148zzxh4bbqAndName-MichaAndSomething-bla': '() => posts.all.firstWhere(p => p.id == "ckadqdbhk00go0148zzxh4bbq" && p.name == "Micha" && p.something == "bla")' });
  expect(result.get('fact')).toEqual({ factPostsJob: '() => postsById-ckadqdbhk00go0148zzxh4bbqAndName-MichaAndSomething-bla().job' });
  expect(result.get('variable')).toEqual([]);
})

test("Build condition with variable", () => {
  requestBody = {
    "type": "Condition",
    "source": {
      "type": "Fact",
      "name": "nationality",
      "value": 'query User {author(where: {id: $id}) {nationality}}'
    },
    "comparator": "eq",
    "target": {
      "type": "Boolean",
      "value": true
    }
  }

  const result = build(requestBody);

  expect(result.get('object')).toEqual({ authorById: '(authorId) => author.all.firstWhere(a => a.id == authorId)' });
  expect(result.get('fact')).toEqual({ factAuthorNationality: '(authorId) => authorById(authorId).nationality' });
  expect(result.get('variable')).toEqual(Array.of('authorId'));
  expect(result.get('condition')).toEqual({ conditionAuthorHasNationality: '(authorId) => factAuthorNationality(authorId) == true' });
})

test("Build condition without variable", () => {
  requestBody = {
    "type": "Condition",
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

  const result = build(requestBody);

  expect(result.get('object')).toEqual({ 'postsById-ckadqdbhk00go0148zzxh4bbqAndName-MichaAndSomething-bla': '() => posts.all.firstWhere(p => p.id == "ckadqdbhk00go0148zzxh4bbq" && p.name == "Micha" && p.something == "bla")' });
  expect(result.get('fact')).toEqual({ factPostsJob: '() => postsById-ckadqdbhk00go0148zzxh4bbqAndName-MichaAndSomething-bla().job' });
  expect(result.get('variable')).toEqual([]);
  expect(result.get('condition')).toEqual({ conditionPostsIncomeGt2000: '() => factPostsJob() > 2000' });
})

test("Build complete rule", () => {
  requestBody = {
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
  };

  const result = build(requestBody);

  expect(result.get('object')).toEqual({
    "authorById-ckadqdbhk00go0148zzxh4bbq": "() => author.all.firstWhere(a => a.id == \"ckadqdbhk00go0148zzxh4bbq\")",
    "postsById-ckadqdbhk00go0148zzxh4bbqAndName-Micha": "() => posts.all.firstWhere(p => p.id == \"ckadqdbhk00go0148zzxh4bbq\" && p.name == \"Micha\")",
    postsByIdAndName: "(postsId,postsName) => posts.all.firstWhere(p => p.id == postsId && p.name == postsName)",
    userById: "(userId) => user.all.firstWhere(u => u.id == userId)",
    "userById-ckadqdbhk00go0148zzxh4bbq": "() => user.all.firstWhere(u => u.id == \"ckadqdbhk00go0148zzxh4bbq\")",
  });

  expect(result.get('fact')).toEqual({
    factAuthorNationality: "() => authorById-ckadqdbhk00go0148zzxh4bbq().nationality",
    factPostsIncome: "(postsId,postsName) => postsByIdAndName(postsId,postsName).income",
    factPostsJob: "() => postsById-ckadqdbhk00go0148zzxh4bbqAndName-Micha().job",
    factUserIncome: "() => userById-ckadqdbhk00go0148zzxh4bbq().income",
    factUserJob: "(userId) => userById(userId).job",
  });

  expect(result.get('condition')).toEqual({
    conditionAuthorNationalityEqFrance: "() => factAuthorNationality() == \"France\"",
    conditionPostsHasJob: "() => factPostsJob() == true",
    conditionPostsIncomeGt2000: "(postsId,postsName) => factPostsIncome(postsId,postsName) > 2000",
    conditionUserHasJob: "(userId) => factUserJob(userId) == true",
    conditionUserIncomeGt2000: "() => factUserIncome() > 2000",
  });

  expect(result.get('rule')).toEqual({
    RE_RuleIsEligibleForCredit: "(postsId,postsName,userId) => (conditionAuthorNationalityEqFrance() && (conditionPostsIncomeGt2000(postsId,postsName) || conditionPostsHasJob() || (conditionUserIncomeGt2000() && conditionUserHasJob(userId))))"
  });
})